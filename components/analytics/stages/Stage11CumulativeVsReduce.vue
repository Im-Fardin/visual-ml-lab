<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Play, Pause, StepForward, RotateCcw, Activity, Layers, ArrowRight, CheckCircle2 } from 'lucide-vue-next'
import { createNumberTexture, createBoldArrow, createTextSprite } from '~/utils/threeTexture'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', data: { title: string; details: Record<string, any> }): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

// 5-element array
const inputData = [2, 5, 1, 4, 3]
const N = inputData.length

// Operation Mode: 'accumulate' (cumsum) vs 'reduce' (sum)
type ModeType = 'accumulate' | 'reduce'
const currentMode = ref<ModeType>('accumulate')

// Math Operator: 'add' (sum/cumsum) vs 'mul' (prod/cumprod)
type OperatorType = 'add' | 'mul'
const currentOp = ref<OperatorType>('add')

// Step Index: 0 to 4
const currentStep = ref<number>(0)
const isPlaying = ref<boolean>(false)
const selectedIdx = ref<number>(0)

// Compute values for cumsum/cumprod and reduce
const stepValues = computed(() => {
  const isMul = currentOp.value === 'mul'
  const cumVals: number[] = []
  let acc = isMul ? 1 : 0

  for (let i = 0; i < N; i++) {
    acc = isMul ? acc * inputData[i] : acc + inputData[i]
    cumVals.push(acc)
  }

  const reduceTotal = cumVals[N - 1]
  return { cumVals, reduceTotal }
})

// Three.js instances
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animFrameId = 0
let floatingAxesGroup: THREE.Group | null = null
let connectorLinesGroup: THREE.Group | null = null

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2(-999, -999)

const initialCameraPos = new THREE.Vector3(0.8, 1.0, 9.0)
const initialCameraTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

// Color palettes
const palInput = { bg: '#ffffff', text: '#1e40af', border: '#2563eb' } // Blue Input
const palAccumulator = { bg: '#ecfdf5', text: '#065f46', border: '#10b981' } // Emerald Accumulator
const palEmpty = { bg: '#f8fafc', text: '#64748b', border: '#cbd5e1' } // Slate Empty Slot
const palReduced = { bg: '#fef3c7', text: '#9a3412', border: '#ea580c' } // Amber Collapsed

interface CubeItem {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  type: 'in' | 'out' | 'reduce'
  idx: number
  val: number
}

let inCubes: CubeItem[] = []
let outCubes: CubeItem[] = []
let reduceCubes: CubeItem[] = []
let allMeshes: THREE.Mesh[] = []

const initThree = () => {
  if (!containerRef.value || !canvasRef.value) return

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight

  scene = new THREE.Scene()
  const bgCol = isDark.value ? 0x151a22 : 0xfbfaf7
  scene.background = new THREE.Color(bgCol)

  camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100)
  camera.position.copy(initialCameraPos)

  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  controls = new OrbitControls(camera, canvasRef.value)
  controls.enableDamping = true
  controls.dampingFactor = 0.05
  controls.minPolarAngle = 0.2
  controls.maxPolarAngle = Math.PI / 2 + 0.1
  controls.target.copy(initialCameraTarget)

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.3)
  scene.add(ambientLight)

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.1)
  dirLight1.position.set(8, 14, 10)
  scene.add(dirLight1)

  const dirLight2 = new THREE.DirectionalLight(0xbfdbfe, 0.45)
  dirLight2.position.set(-8, -4, -6)
  scene.add(dirLight2)

  // Ground Grid
  const gridHelper = new THREE.GridHelper(18, 18, isDark.value ? 0x334155 : 0xcbd5e1, isDark.value ? 0x1e293b : 0xe2ded4)
  gridHelper.position.y = -2.6
  scene.add(gridHelper)

  floatingAxesGroup = new THREE.Group()
  scene.add(floatingAxesGroup)

  connectorLinesGroup = new THREE.Group()
  scene.add(connectorLinesGroup)

  buildSceneForMode()
  updateStepVisuals()

  let lastTime = performance.now()
  let timerAccumulator = 0

  const animate = (time: number) => {
    animFrameId = requestAnimationFrame(animate)
    const dt = (time - lastTime) / 1000
    lastTime = time

    if (isPlaying.value) {
      timerAccumulator += dt
      if (timerAccumulator >= 0.85) {
        timerAccumulator = 0
        if (currentStep.value < N - 1) {
          currentStep.value++
          updateStepVisuals()
          emitInspection()
        } else {
          isPlaying.value = false
        }
      }
    }

    if (controls) controls.update()
    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  animate(performance.now())
  emitInspection()
}

// Build Scene objects depending on mode
const buildSceneForMode = () => {
  if (!scene) return

  const clearGroup = (list: CubeItem[]) => {
    list.forEach((item) => {
      scene?.remove(item.mesh)
      item.mesh.geometry.dispose()
      ;(item.mesh.material as THREE.Material).dispose()
      item.wireframe.geometry.dispose()
    })
  }

  clearGroup(inCubes)
  clearGroup(outCubes)
  clearGroup(reduceCubes)
  inCubes = []
  outCubes = []
  reduceCubes = []
  allMeshes = []

  const cubeGeo = new THREE.BoxGeometry(0.95, 0.95, 0.95)
  const wireGeo = new THREE.EdgesGeometry(cubeGeo)
  const spacing = 1.45

  if (currentMode.value === 'accumulate') {
    // Mode 1: Accumulate (Two rows)
    // Row 1 (Input, y = +1.15): Input elements
    // Row 2 (Output cumsum, y = -1.15): Output elements
    for (let i = 0; i < N; i++) {
      const val = inputData[i]
      const tex = createNumberTexture(val, palInput.bg, palInput.text, palInput.border)
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: 1
      })
      const mesh = new THREE.Mesh(cubeGeo, mat)
      const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(palInput.border), linewidth: 1.5 })
      const wireframe = new THREE.LineSegments(wireGeo, wireMat)
      mesh.add(wireframe)

      const x = (i - (N - 1) / 2) * spacing
      mesh.position.set(x, 1.15, 0)
      mesh.userData = { type: 'in', idx: i, val }
      scene.add(mesh)
      allMeshes.push(mesh)
      inCubes.push({ mesh, wireframe, type: 'in', idx: i, val })
    }

    // Output slots (y = -1.15)
    for (let i = 0; i < N; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: isDark.value ? 0x1e293b : 0xe2e8f0,
        transparent: true,
        opacity: 0.35
      })
      const mesh = new THREE.Mesh(cubeGeo, mat)
      const wireMat = new THREE.LineBasicMaterial({
        color: isDark.value ? 0x475569 : 0x94a3b8,
        transparent: true,
        opacity: 0.5
      })
      const wireframe = new THREE.LineSegments(wireGeo, wireMat)
      mesh.add(wireframe)

      const x = (i - (N - 1) / 2) * spacing
      mesh.position.set(x, -1.15, 0)
      mesh.userData = { type: 'out', idx: i, val: 0 }
      scene.add(mesh)
      allMeshes.push(mesh)
      outCubes.push({ mesh, wireframe, type: 'out', idx: i, val: 0 })
    }
  } else {
    // Mode 2: Reduce Mode (Single row progressively merging)
    for (let i = 0; i < N; i++) {
      const val = inputData[i]
      const tex = createNumberTexture(val, palInput.bg, palInput.text, palInput.border)
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: 1
      })
      const mesh = new THREE.Mesh(cubeGeo, mat)
      const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(palInput.border), linewidth: 1.5 })
      const wireframe = new THREE.LineSegments(wireGeo, wireMat)
      mesh.add(wireframe)

      const x = (i - (N - 1) / 2) * spacing
      mesh.position.set(x, 0, 0)
      mesh.userData = { type: 'reduce', idx: i, val }
      scene.add(mesh)
      allMeshes.push(mesh)
      reduceCubes.push({ mesh, wireframe, type: 'reduce', idx: i, val })
    }
  }

  updateFloatingAxes()
}

// Update visuals for active step index
const updateStepVisuals = () => {
  const step = currentStep.value
  const { cumVals, reduceTotal } = stepValues.value

  if (connectorLinesGroup) {
    while (connectorLinesGroup.children.length > 0) {
      const child = connectorLinesGroup.children[0]
      connectorLinesGroup.remove(child)
      if (child instanceof THREE.Line) {
        child.geometry.dispose()
        ;(child.material as THREE.Material).dispose()
      }
    }
  }

  if (currentMode.value === 'accumulate') {
    // Mode 1: Accumulate
    outCubes.forEach((slot, i) => {
      const mat = slot.mesh.material as THREE.MeshStandardMaterial
      const wire = slot.wireframe.material as THREE.LineBasicMaterial

      if (i <= step) {
        const val = cumVals[i]
        const tex = createNumberTexture(val, palAccumulator.bg, palAccumulator.text, palAccumulator.border)
        mat.map = tex
        mat.needsUpdate = true
        mat.transparent = false
        mat.opacity = 1
        wire.color.set(new THREE.Color(palAccumulator.border))
        wire.opacity = 1
        slot.mesh.scale.set(1.08, 1.08, 1.08)

        // Draw connecting trajectory line from input to output slot
        if (connectorLinesGroup) {
          const ptInput = inCubes[i].mesh.position.clone()
          const ptOutput = slot.mesh.position.clone()
          const lineGeo = new THREE.BufferGeometry().setFromPoints([ptInput, ptOutput])
          const lineMat = new THREE.LineDashedMaterial({
            color: 0x10b981,
            dashSize: 0.15,
            gapSize: 0.08,
            linewidth: 2
          })
          const line = new THREE.Line(lineGeo, lineMat)
          line.computeLineDistances()
          connectorLinesGroup.add(line)

          // If i > 0, also link previous accumulated total to current output
          if (i > 0) {
            const ptPrevAccum = outCubes[i - 1].mesh.position.clone()
            const linkGeo = new THREE.BufferGeometry().setFromPoints([ptPrevAccum, ptOutput])
            const linkMat = new THREE.LineDashedMaterial({
              color: 0x059669,
              dashSize: 0.18,
              gapSize: 0.08,
              linewidth: 2.5
            })
            const prevLink = new THREE.Line(linkGeo, linkMat)
            prevLink.computeLineDistances()
            connectorLinesGroup.add(prevLink)
          }
        }
      } else {
        mat.map = null
        mat.needsUpdate = true
        mat.transparent = true
        mat.opacity = 0.25
        wire.color.set(isDark.value ? 0x475569 : 0x94a3b8)
        wire.opacity = 0.4
        slot.mesh.scale.set(0.95, 0.95, 0.95)
      }
    })
  } else {
    // Mode 2: Progressive Reduce Collapse
    // At step k, elements 0..k have collapsed into element k
    const spacing = 1.45
    reduceCubes.forEach((cube, i) => {
      const mat = cube.mesh.material as THREE.MeshStandardMaterial
      const wire = cube.wireframe.material as THREE.LineBasicMaterial

      if (i < step) {
        // Already merged into right neighbor: hide/fade
        mat.opacity = 0
        wire.opacity = 0
        cube.mesh.scale.set(0.1, 0.1, 0.1)
      } else if (i === step) {
        // Active accumulator cube showing running total
        const val = cumVals[step]
        const tex = createNumberTexture(val, palReduced.bg, palReduced.text, palReduced.border)
        mat.map = tex
        mat.needsUpdate = true
        mat.opacity = 1
        wire.color.set(new THREE.Color(palReduced.border))
        wire.opacity = 1
        cube.mesh.scale.set(1.15, 1.15, 1.15)
      } else {
        // Unmerged waiting element
        const val = inputData[i]
        const tex = createNumberTexture(val, palInput.bg, palInput.text, palInput.border)
        mat.map = tex
        mat.needsUpdate = true
        mat.opacity = 1
        wire.color.set(new THREE.Color(palInput.border))
        wire.opacity = 1
        cube.mesh.scale.set(1, 1, 1)
      }
    })
  }
}

// Bounding-Frame Coordinate Axes
const updateFloatingAxes = () => {
  if (!floatingAxesGroup) return

  while (floatingAxesGroup.children.length > 0) {
    const child = floatingAxesGroup.children[0]
    floatingAxesGroup.remove(child)
  }

  const referenceList = currentMode.value === 'accumulate' ? inCubes.concat(outCubes) : reduceCubes
  if (referenceList.length === 0) return

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  for (const node of referenceList) {
    const pos = node.mesh.position
    minX = Math.min(minX, pos.x)
    maxX = Math.max(maxX, pos.x)
    minY = Math.min(minY, pos.y)
    maxY = Math.max(maxY, pos.y)
    minZ = Math.min(minZ, pos.z)
    maxZ = Math.max(maxZ, pos.z)
  }

  const halfW = 0.475
  const clearance = 0.38

  const originX = minX - halfW - clearance
  const originY = minY - halfW - clearance
  const originZ = minZ - halfW - clearance

  floatingAxesGroup.position.set(originX, originY, originZ)

  const marginExtra = 0.65
  const lenX = Math.max(1.8, maxX - minX + halfW * 2 + clearance + marginExtra)
  const lenY = Math.max(1.8, maxY - minY + halfW * 2 + clearance + marginExtra)

  // X Axis (Elements): Red
  const arrowX = createBoldArrow(new THREE.Vector3(1, 0, 0), lenX, 0xef4444, 'axis X (Elements)', 0.055, 0.16, 0.35)
  floatingAxesGroup.add(arrowX)

  // Y Axis (Lanes/Output): Green
  if (currentMode.value === 'accumulate') {
    const arrowY = createBoldArrow(new THREE.Vector3(0, 1, 0), lenY, 0x10b981, 'axis Y (Accumulator Slots)', 0.055, 0.16, 0.35)
    floatingAxesGroup.add(arrowY)
  }
}

// User Actions
const setMode = (mode: ModeType) => {
  currentMode.value = mode
  currentStep.value = 0
  isPlaying.value = false
  buildSceneForMode()
  updateStepVisuals()
  emitInspection()
}

const setOperator = (op: OperatorType) => {
  currentOp.value = op
  updateStepVisuals()
  emitInspection()
}

const togglePlay = () => {
  if (currentStep.value >= N - 1) currentStep.value = 0
  isPlaying.value = !isPlaying.value
}

const stepNext = () => {
  isPlaying.value = false
  if (currentStep.value < N - 1) {
    currentStep.value++
  } else {
    currentStep.value = 0
  }
  updateStepVisuals()
  emitInspection()
}

const resetSimulation = () => {
  isPlaying.value = false
  currentStep.value = 0
  updateStepVisuals()
  resetCamera()
  emitInspection()
}

const resetCamera = () => {
  if (!camera || !controls) return
  camera.position.copy(initialCameraPos)
  controls.target.copy(initialCameraTarget)
  controls.update()
}

// Raycaster interaction
const onPointerDown = (event: MouseEvent) => {
  if (!canvasRef.value || !camera) return

  const rect = canvasRef.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(allMeshes, false)

  if (intersects.length > 0) {
    const hitMesh = intersects[0].object as THREE.Mesh
    const data = hitMesh.userData
    if (data && data.idx !== undefined) {
      selectedIdx.value = data.idx
      emitInspection()
    }
  }
}

const emitInspection = () => {
  const idx = selectedIdx.value
  const { cumVals, reduceTotal } = stepValues.value
  const opSymbol = currentOp.value === 'mul' ? '×' : '+'
  const fnName = currentMode.value === 'accumulate'
    ? (currentOp.value === 'mul' ? 'np.cumprod(x)' : 'np.cumsum(x)')
    : (currentOp.value === 'mul' ? 'np.prod(x)' : 'np.sum(x)')

  const partialFormula = inputData.slice(0, currentStep.value + 1).join(` ${opSymbol} `)

  emit('inspect', {
    title: `${fnName} Step [${currentStep.value} / ${N - 1}]`,
    details: {
      'Active Operation': fnName,
      'Current Step Index': `Index ${currentStep.value} (Input: ${inputData[currentStep.value]})`,
      'Accumulator Register': `${partialFormula} = ${cumVals[currentStep.value]}`,
      'Output Topology': currentMode.value === 'accumulate' ? '(5,) Array (History Preserved)' : '() Scalar (Full Reduction)',
      'Time-Series Use Case': currentMode.value === 'accumulate' ? 'Cumulative Return / Running Balance' : 'Total Aggregated Balance',
      'Memory Strategy': currentMode.value === 'accumulate' ? 'New (N,) array allocated with progressive prefix state' : 'Collapses buffer to single scalar register'
    }
  })
}

const onWindowResize = () => {
  if (!containerRef.value || !renderer || !camera) return
  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight
  camera.aspect = width / height
  camera.updateProjectionMatrix()
  renderer.setSize(width, height)
}

watch(isDark, (dark) => {
  if (scene) {
    scene.background = new THREE.Color(dark ? 0x151a22 : 0xfbfaf7)
    updateFloatingAxes()
    updateStepVisuals()
  }
})

onMounted(() => {
  initThree()
  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  cancelAnimationFrame(animFrameId)

  if (controls) controls.dispose()
  if (renderer) renderer.dispose()

  const clearList = (list: CubeItem[]) => {
    list.forEach((item) => {
      item.mesh.geometry.dispose()
      ;(item.mesh.material as THREE.Material).dispose()
      item.wireframe.geometry.dispose()
    })
  }
  clearList(inCubes)
  clearList(outCubes)
  clearList(reduceCubes)
  inCubes = []
  outCubes = []
  reduceCubes = []
  allMeshes = []

  scene = null
  camera = null
  renderer = null
  controls = null
})
</script>

<template>
  <div class="flex flex-col gap-2.5 w-full">
    <!-- Viewport Container strictly clamped to 46vh -->
    <div
      ref="containerRef"
      class="relative w-full h-[46vh] max-h-[46vh] min-h-[300px] rounded-lg border border-line bg-stage overflow-hidden shadow-xs select-none"
    >
      <canvas
        ref="canvasRef"
        @pointerdown="onPointerDown"
        class="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      <!-- Stage Overlays -->
      <div class="absolute inset-0 pointer-events-none p-3 flex flex-col justify-between">
        <!-- Top Status Bar: Method Toggle & Active Math Badge -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <!-- Mode Switcher -->
          <div class="flex items-center gap-1.5 bg-card/90 backdrop-blur-md p-1 rounded-md border border-line shadow-xs pointer-events-auto text-xs font-mono">
            <button
              type="button"
              @click="setMode('accumulate')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="currentMode === 'accumulate' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="np.cumsum: Preserves full array history and length"
            >
              Accumulate (cumsum)
            </button>
            <button
              type="button"
              @click="setMode('reduce')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="currentMode === 'reduce' ? 'bg-brand-amber text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="np.sum: Collapses entire array into scalar"
            >
              Reduce (sum)
            </button>
          </div>

          <!-- Operator Switcher (+ vs ×) -->
          <div class="flex items-center gap-2 pointer-events-auto text-xs font-mono">
            <div class="flex items-center gap-1 bg-card/90 backdrop-blur-md p-1 rounded-md border border-line shadow-xs">
              <button
                type="button"
                @click="setOperator('add')"
                class="px-2 py-0.5 rounded font-bold transition-colors"
                :class="currentOp === 'add' ? 'bg-brand-blue text-white shadow-xs' : 'text-muted hover:text-ink'"
              >
                Sum (+)
              </button>
              <button
                type="button"
                @click="setOperator('mul')"
                class="px-2 py-0.5 rounded font-bold transition-colors"
                :class="currentOp === 'mul' ? 'bg-brand-blue text-white shadow-xs' : 'text-muted hover:text-ink'"
              >
                Prod (×)
              </button>
            </div>

            <span class="px-2.5 py-1 rounded-md bg-card/90 backdrop-blur-md border border-line shadow-xs font-bold text-ink">
              Register: {{ stepValues.cumVals[currentStep] }}
            </span>
          </div>
        </div>

        <!-- Bottom Overlay: Active Instruction Note -->
        <div class="flex items-center justify-between text-[0.68rem] text-muted">
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full" :class="currentMode === 'accumulate' ? 'bg-emerald-500' : 'bg-brand-amber'" />
            <span v-if="currentMode === 'accumulate'">
              Accumulate Wave: Output preserves vector shape (5,) with partial sum trace lines.
            </span>
            <span v-else>
              Reduce Collapse: Array collapses into a single scalar register (5,) → ().
            </span>
          </div>
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono hidden sm:block">
            Drag: Orbit 360° • Click: Inspect Register
          </div>
        </div>
      </div>
    </div>

    <!-- Execution & Step Toolbar -->
    <div class="bg-card border border-line rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
      <!-- Playback Controls -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="togglePlay"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors shadow-xs"
          :class="isPlaying ? 'bg-brand-amber text-white' : 'bg-brand-blue hover:bg-brand-blue-hover text-white'"
        >
          <Pause v-if="isPlaying" class="w-3.5 h-3.5 fill-current" />
          <Play v-else class="w-3.5 h-3.5 fill-current" />
          <span>{{ isPlaying ? 'Pause' : 'Animate Wave' }}</span>
        </button>

        <button
          type="button"
          @click="stepNext"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono font-medium text-ink transition-colors"
          title="Advance to next accumulation step"
        >
          <StepForward class="w-3.5 h-3.5 text-muted" />
          <span>Step Next</span>
        </button>

        <button
          type="button"
          @click="resetSimulation"
          class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono text-muted hover:text-ink transition-colors"
          title="Reset to step 0"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>

        <!-- Step Slider -->
        <div class="flex items-center gap-1.5 text-xs font-mono text-muted pl-1">
          <input
            id="waveProgress"
            type="range"
            min="0"
            :max="N - 1"
            step="1"
            v-model.number="currentStep"
            @input="isPlaying = false; updateStepVisuals(); emitInspection()"
            class="w-20 accent-brand-blue cursor-pointer"
          />
          <span class="font-bold text-brand-blue w-10 text-right">{{ currentStep + 1 }} / {{ N }}</span>
        </div>

        <button
          type="button"
          @click="resetCamera"
          class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono text-muted hover:text-ink transition-colors"
          title="Reset 3D camera angle"
        >
          <span>↺ View</span>
        </button>
      </div>
    </div>

    <!-- Fluid Telemetry HUD Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Active Method</div>
        <div class="font-bold text-brand-blue truncate">
          {{ currentMode === 'accumulate' ? (currentOp === 'mul' ? 'np.cumprod(x)' : 'np.cumsum(x)') : (currentOp === 'mul' ? 'np.prod(x)' : 'np.sum(x)') }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Output Topology</div>
        <div class="font-bold text-brand-purple truncate">
          {{ currentMode === 'accumulate' ? '(5,) Array (Preserved)' : '() Scalar (Collapsed)' }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Accumulator State</div>
        <div class="font-bold text-emerald-600 dark:text-emerald-400 truncate">
          Register = {{ stepValues.cumVals[currentStep] }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Invariant Guarantee</div>
        <div class="font-bold text-brand-green truncate" title="Running history preserved vs total collapsed">
          {{ currentMode === 'accumulate' ? 'History Vector Preserved ✓' : 'Scalar Collapsed ✓' }}
        </div>
      </div>
    </div>
  </div>
</template>

