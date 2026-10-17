<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Play, Pause, StepForward, RotateCcw, Zap, Clock, Cpu, CheckCircle2, AlertCircle } from 'lucide-vue-next'
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

// 8 elements race
const inputValues = [1, 2, 3, 4, 5, 6, 7, 8]
const N = inputValues.length

// Simulation State
const isPlaying = ref(false)
const speedMultiplier = ref<number>(1) // 1x, 2x, 4x

// Python Loop Lane State
const pyCurrentIdx = ref<number>(-1) // -1 = not started, 0..7 = processing, 8 = done
const pyProcessedCount = ref<number>(0)
const pyTimerMs = ref<number>(0)

// SIMD Vectorized Lane State
const simdDone = ref<boolean>(false)
const simdWaveProgress = ref<number>(0) // 0 to 1
const simdTimerMs = ref<number>(0)

// Selected Element for inspection
const selectedElement = ref<{ lane: 'py' | 'simd'; idx: number; val: number; result: number }>({
  lane: 'py',
  idx: 0,
  val: 1,
  result: 1
})

// Three.js instances
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animFrameId = 0
let floatingAxesGroup: THREE.Group | null = null

// Meshes & Visual Groups
interface CubeNode {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  lane: 'py' | 'simd'
  idx: number
  val: number
  result: number
  isDone: boolean
}

let pyCubes: CubeNode[] = []
let simdCubes: CubeNode[] = []
let allCubes: CubeNode[] = []

let interpreterPointerMesh: THREE.Mesh | null = null
let simdWaveMesh: THREE.Mesh | null = null

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2(-999, -999)

const initialCameraPos = new THREE.Vector3(0.8, 1.0, 9.2)
const initialCameraTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

// Color palettes
const palInitial = { bg: '#ffffff', text: '#334155', border: '#94a3b8' } // Slate uncomputed
const palActive = { bg: '#fef3c7', text: '#9a3412', border: '#ea580c' }  // Amber active
const palSuccessPy = { bg: '#dbeafe', text: '#1e40af', border: '#2563eb' } // Blue completed Python
const palSuccessSimd = { bg: '#ecfdf5', text: '#065f46', border: '#10b981' } // Emerald completed SIMD

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
  gridHelper.position.y = -2.7
  scene.add(gridHelper)

  floatingAxesGroup = new THREE.Group()
  scene.add(floatingAxesGroup)

  buildRaceLanes()
  buildVisualDecorators()
  updateFloatingAxes()

  let lastTimestamp = performance.now()
  let pyAccumulatedTime = 0

  const animate = (timestamp: number) => {
    animFrameId = requestAnimationFrame(animate)
    const dt = (timestamp - lastTimestamp) / 1000
    lastTimestamp = timestamp

    if (isPlaying.value) {
      const rate = speedMultiplier.value

      // 1. SIMD Vectorized Lane sweeps quickly (~0.35s total)
      if (!simdDone.value) {
        simdWaveProgress.value += dt * 3.0 * rate
        simdTimerMs.value = Math.min(0.22, Math.round(simdWaveProgress.value * 0.22 * 100) / 100)

        if (simdWaveMesh) {
          const waveX = (simdWaveProgress.value - 0.5) * 11.0
          simdWaveMesh.position.x = waveX
          simdWaveMesh.visible = true
        }

        // Complete SIMD elements as wave sweeps across
        simdCubes.forEach((cube) => {
          if (!cube.isDone && simdWaveProgress.value >= (cube.idx + 0.5) / N) {
            cube.isDone = true
            setCubeVisual(cube, cube.result, palSuccessSimd)
          }
        })

        if (simdWaveProgress.value >= 1) {
          simdDone.value = true
          simdTimerMs.value = 0.22
          if (simdWaveMesh) simdWaveMesh.visible = false
        }
      }

      // 2. Python Loop Lane crawls item-by-item (~0.7s per element -> ~5.6s total)
      if (pyProcessedCount.value < N) {
        pyAccumulatedTime += dt * rate
        pyTimerMs.value = Math.round(pyTimerMs.value * 100 + dt * rate * 140) / 100

        const elementDuration = 0.7
        const currentActive = Math.min(N - 1, Math.floor(pyAccumulatedTime / elementDuration))

        if (currentActive !== pyCurrentIdx.value) {
          // If previous was active, finalize it
          if (pyCurrentIdx.value >= 0 && pyCurrentIdx.value < N) {
            const prevCube = pyCubes[pyCurrentIdx.value]
            prevCube.isDone = true
            setCubeVisual(prevCube, prevCube.result, palSuccessPy)
            pyProcessedCount.value++
          }

          pyCurrentIdx.value = currentActive

          if (currentActive < N) {
            const currCube = pyCubes[currentActive]
            setCubeVisual(currCube, currCube.val, palActive)
            updatePointerPosition(currentActive)
          }
        }

        // Check if finished
        if (pyAccumulatedTime >= N * elementDuration) {
          if (pyCurrentIdx.value >= 0 && pyCurrentIdx.value < N) {
            const lastCube = pyCubes[pyCurrentIdx.value]
            lastCube.isDone = true
            setCubeVisual(lastCube, lastCube.result, palSuccessPy)
            pyProcessedCount.value = N
          }
          pyCurrentIdx.value = N
          pyTimerMs.value = 8.45
          if (interpreterPointerMesh) interpreterPointerMesh.visible = false
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

// Build 8 cubes for Python loop (upper) and 8 cubes for SIMD (lower)
const buildRaceLanes = () => {
  if (!scene) return

  allCubes.forEach((node) => {
    scene?.remove(node.mesh)
    node.mesh.geometry.dispose()
    ;(node.mesh.material as THREE.Material).dispose()
    node.wireframe.geometry.dispose()
  })
  pyCubes = []
  simdCubes = []
  allCubes = []

  const cubeGeo = new THREE.BoxGeometry(0.95, 0.95, 0.95)
  const wireGeo = new THREE.EdgesGeometry(cubeGeo)
  const spacing = 1.3
  const yUpper = 1.35
  const yLower = -1.35

  // Lane A: Python Loop (Upper)
  for (let i = 0; i < N; i++) {
    const val = inputValues[i]
    const tex = createNumberTexture(val, palInitial.bg, palInitial.text, palInitial.border)
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.3,
      metalness: 0.1,
      transparent: true,
      opacity: 1
    })
    const mesh = new THREE.Mesh(cubeGeo, mat)
    const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(palInitial.border), linewidth: 1.5 })
    const wireframe = new THREE.LineSegments(wireGeo, wireMat)
    mesh.add(wireframe)

    const x = (i - (N - 1) / 2) * spacing
    mesh.position.set(x, yUpper, 0)
    mesh.userData = { lane: 'py', idx: i, val, result: val * val }
    scene.add(mesh)

    const entry: CubeNode = {
      mesh,
      wireframe,
      lane: 'py',
      idx: i,
      val,
      result: val * val,
      isDone: false
    }
    pyCubes.push(entry)
    allCubes.push(entry)
  }

  // Lane B: NumPy SIMD (Lower)
  for (let i = 0; i < N; i++) {
    const val = inputValues[i]
    const tex = createNumberTexture(val, palInitial.bg, palInitial.text, palInitial.border)
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.3,
      metalness: 0.1,
      transparent: true,
      opacity: 1
    })
    const mesh = new THREE.Mesh(cubeGeo, mat)
    const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(palInitial.border), linewidth: 1.5 })
    const wireframe = new THREE.LineSegments(wireGeo, wireMat)
    mesh.add(wireframe)

    const x = (i - (N - 1) / 2) * spacing
    mesh.position.set(x, yLower, 0)
    mesh.userData = { lane: 'simd', idx: i, val, result: val * val }
    scene.add(mesh)

    const entry: CubeNode = {
      mesh,
      wireframe,
      lane: 'simd',
      idx: i,
      val,
      result: val * val,
      isDone: false
    }
    simdCubes.push(entry)
    allCubes.push(entry)
  }
}

// Visual decorators: Lane titles, Interpreter pointer, SIMD wave plane
const buildVisualDecorators = () => {
  if (!scene) return

  // Upper Label Sprite
  const pyLabel = createTextSprite('Python for Loop (Scalar Pointer: 1-by-1)', isDark.value ? '#93c5fd' : '#1e40af', 32)
  pyLabel.position.set(0, 2.35, 0)
  pyLabel.scale.set(4.2, 0.9, 1)
  scene.add(pyLabel)

  // Lower Label Sprite
  const simdLabel = createTextSprite('NumPy SIMD Vector Wave (AVX-512 Parallel)', isDark.value ? '#6ee7b7' : '#047857', 32)
  simdLabel.position.set(0, -0.35, 0)
  simdLabel.scale.set(4.2, 0.9, 1)
  scene.add(simdLabel)

  // Interpreter Pointer Chevron (glowing amber cone pointing downward)
  const coneGeo = new THREE.ConeGeometry(0.28, 0.55, 16)
  coneGeo.rotateX(Math.PI) // point downwards
  const coneMat = new THREE.MeshBasicMaterial({ color: 0xea580c })
  interpreterPointerMesh = new THREE.Mesh(coneGeo, coneMat)
  interpreterPointerMesh.position.set(pyCubes[0].mesh.position.x, 2.05, 0)
  interpreterPointerMesh.visible = false
  scene.add(interpreterPointerMesh)

  // SIMD Wave Beam (vertical glowing cyan planar beam)
  const waveGeo = new THREE.BoxGeometry(0.65, 1.45, 1.2)
  const waveMat = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    transparent: true,
    opacity: 0.65
  })
  simdWaveMesh = new THREE.Mesh(waveGeo, waveMat)
  simdWaveMesh.position.set(-6, -1.35, 0)
  simdWaveMesh.visible = false
  scene.add(simdWaveMesh)
}

const updatePointerPosition = (idx: number) => {
  if (!interpreterPointerMesh || idx < 0 || idx >= N) return
  interpreterPointerMesh.position.x = pyCubes[idx].mesh.position.x
  interpreterPointerMesh.visible = true
}

const setCubeVisual = (node: CubeNode, text: number | string, style: { bg: string; text: string; border: string }) => {
  const tex = createNumberTexture(text, style.bg, style.text, style.border)
  const mat = node.mesh.material as THREE.MeshStandardMaterial
  mat.map = tex
  mat.needsUpdate = true
  ;(node.wireframe.material as THREE.LineBasicMaterial).color.set(new THREE.Color(style.border))
}

// Bounding-Frame Coordinate Axes
const updateFloatingAxes = () => {
  if (!floatingAxesGroup) return

  while (floatingAxesGroup.children.length > 0) {
    const child = floatingAxesGroup.children[0]
    floatingAxesGroup.remove(child)
  }

  if (allCubes.length === 0) return

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  for (const node of allCubes) {
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

  // X Axis (Elements): Red / Coral pointing Right (+X)
  const arrowX = createBoldArrow(new THREE.Vector3(1, 0, 0), lenX, 0xef4444, 'axis X (Elements)', 0.055, 0.16, 0.35)
  floatingAxesGroup.add(arrowX)

  // Y Axis (Lanes): Green / Emerald pointing Up (+Y)
  const arrowY = createBoldArrow(new THREE.Vector3(0, 1, 0), lenY, 0x10b981, 'axis Y (Execution Lanes)', 0.055, 0.16, 0.35)
  floatingAxesGroup.add(arrowY)
}

// Actions
const startRace = () => {
  if (pyProcessedCount.value >= N && simdDone.value) {
    resetSimulation()
  }
  isPlaying.value = true
  if (interpreterPointerMesh && pyCurrentIdx.value < 0) {
    updatePointerPosition(0)
  }
}

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
}

const stepSingleElement = () => {
  isPlaying.value = false
  if (pyProcessedCount.value >= N) return

  const nextIdx = pyCurrentIdx.value < 0 ? 0 : pyCurrentIdx.value + 1
  if (nextIdx < N) {
    // Finalize previous if exists
    if (pyCurrentIdx.value >= 0 && pyCurrentIdx.value < N) {
      const prev = pyCubes[pyCurrentIdx.value]
      prev.isDone = true
      setCubeVisual(prev, prev.result, palSuccessPy)
      pyProcessedCount.value++
    }

    pyCurrentIdx.value = nextIdx
    const curr = pyCubes[nextIdx]
    setCubeVisual(curr, curr.val, palActive)
    updatePointerPosition(nextIdx)
    pyTimerMs.value = Math.round((pyTimerMs.value + 1.05) * 100) / 100

    selectedElement.value = {
      lane: 'py',
      idx: nextIdx,
      val: curr.val,
      result: curr.result
    }
    emitInspection()
  } else {
    // Final element completed
    const last = pyCubes[N - 1]
    last.isDone = true
    setCubeVisual(last, last.result, palSuccessPy)
    pyProcessedCount.value = N
    pyCurrentIdx.value = N
    if (interpreterPointerMesh) interpreterPointerMesh.visible = false
  }
}

const resetSimulation = () => {
  isPlaying.value = false
  pyCurrentIdx.value = -1
  pyProcessedCount.value = 0
  pyTimerMs.value = 0
  simdDone.value = false
  simdWaveProgress.value = 0
  simdTimerMs.value = 0

  if (interpreterPointerMesh) interpreterPointerMesh.visible = false
  if (simdWaveMesh) simdWaveMesh.visible = false

  pyCubes.forEach((cube) => {
    cube.isDone = false
    setCubeVisual(cube, cube.val, palInitial)
  })

  simdCubes.forEach((cube) => {
    cube.isDone = false
    setCubeVisual(cube, cube.val, palInitial)
  })

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
  const intersects = raycaster.intersectObjects(allCubes.map((n) => n.mesh), false)

  if (intersects.length > 0) {
    const hitMesh = intersects[0].object as THREE.Mesh
    const data = hitMesh.userData
    if (data) {
      selectedElement.value = {
        lane: data.lane,
        idx: data.idx,
        val: data.val,
        result: data.result
      }
      emitInspection()
    }
  }
}

const speedupFactor = computed(() => {
  if (simdTimerMs.value <= 0) return '38.4x'
  const pyTime = pyTimerMs.value > 0 ? pyTimerMs.value : 8.45
  const factor = (pyTime / (simdTimerMs.value || 0.22)).toFixed(1)
  return `${factor}x`
})

const emitInspection = () => {
  const el = selectedElement.value
  const isPy = el.lane === 'py'

  emit('inspect', {
    title: `Execution Analysis: Index [${el.idx}] (${isPy ? 'Python Loop' : 'NumPy SIMD'})`,
    details: {
      'Array Element': `x[${el.idx}] = ${el.val}`,
      'Computed Result': `x² = ${el.result}`,
      'Execution Mode': isPy ? 'Python Bytecode Scalar Iteration' : 'AVX-512 SIMD Parallel Hardware Vector',
      'Memory Traversal': isPy ? 'Dynamic PyObject* Pointer Chasing (Scattered)' : 'Contiguous C Buffer (L1 Cache Streaming)',
      'Type Overhead': isPy ? 'Explicit PyObject Type Check per element' : 'Zero (Pre-compiled homogeneous int64)',
      'GIL Lock Status': isPy ? 'Bound to GIL (Single thread locked)' : 'GIL Released inside C-extension kernel',
      'SIMD Speedup': speedupFactor.value
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

  allCubes.forEach((node) => {
    node.mesh.geometry.dispose()
    ;(node.mesh.material as THREE.Material).dispose()
    node.wireframe.geometry.dispose()
  })
  allCubes = []

  if (interpreterPointerMesh) {
    interpreterPointerMesh.geometry.dispose()
    ;(interpreterPointerMesh.material as THREE.Material).dispose()
  }
  if (simdWaveMesh) {
    simdWaveMesh.geometry.dispose()
    ;(simdWaveMesh.material as THREE.Material).dispose()
  }

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
        <!-- Top Status Bar: Timer Badges -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <!-- Timers Comparison -->
          <div class="flex items-center gap-2 bg-card/90 backdrop-blur-md p-1 rounded-md border border-line shadow-xs pointer-events-auto text-xs font-mono">
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 font-bold text-blue-600 dark:text-blue-400">
              <Clock class="w-3.5 h-3.5" />
              <span>Python: {{ pyTimerMs.toFixed(2) }} ms</span>
            </span>
            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 font-bold text-emerald-600 dark:text-emerald-400">
              <Zap class="w-3.5 h-3.5" />
              <span>SIMD: {{ simdTimerMs.toFixed(2) }} ms</span>
            </span>
          </div>

          <!-- Speedup Pill -->
          <div class="flex items-center gap-2 pointer-events-auto text-xs font-mono">
            <span class="px-2.5 py-1 rounded-md bg-brand-amber/15 border border-brand-amber/30 text-brand-amber font-bold flex items-center gap-1 shadow-xs">
              <Cpu class="w-3.5 h-3.5" />
              <span>{{ speedupFactor }} Hardware Speedup</span>
            </span>
          </div>
        </div>

        <!-- Bottom Overlay: Active Instruction Note -->
        <div class="flex items-center justify-between text-[0.68rem] text-muted">
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full" :class="isPlaying ? 'bg-brand-amber animate-pulse' : 'bg-emerald-500'" />
            <span v-if="pyCurrentIdx >= 0 && pyCurrentIdx < N">
              Interpreter: checking PyObject* for element [{{ pyCurrentIdx }}]...
            </span>
            <span v-else-if="pyProcessedCount >= N">
              Race complete: SIMD finished 38x faster than Python loop.
            </span>
            <span v-else>
              Static Ready State. Click "Start Race" or "Step Element".
            </span>
          </div>
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono hidden sm:block">
            Drag: Orbit 360° • Click: Inspect Bytecode
          </div>
        </div>
      </div>
    </div>

    <!-- Execution & Race Toolbar -->
    <div class="bg-card border border-line rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
      <!-- Race & Playback Controls -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="startRace"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors shadow-xs"
          :class="isPlaying ? 'bg-brand-amber text-white' : 'bg-brand-blue hover:bg-brand-blue-hover text-white'"
        >
          <Pause v-if="isPlaying" class="w-3.5 h-3.5 fill-current" />
          <Play v-else class="w-3.5 h-3.5 fill-current" />
          <span>{{ isPlaying ? 'Pause' : 'Start Race' }}</span>
        </button>

        <button
          type="button"
          @click="stepSingleElement"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono font-medium text-ink transition-colors"
          title="Manually advance Python loop iterator by 1 element"
        >
          <StepForward class="w-3.5 h-3.5 text-muted" />
          <span>Step Single Element</span>
        </button>

        <button
          type="button"
          @click="resetSimulation"
          class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono text-muted hover:text-ink transition-colors"
          title="Reset both execution lanes"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      <!-- Speed Multiplier Pills -->
      <div class="flex items-center gap-1 bg-card-subtle p-1 rounded-md border border-line text-xs font-mono">
        <span class="text-[10px] text-muted font-bold px-1 uppercase">Pace:</span>
        <button
          type="button"
          @click="speedMultiplier = 1"
          class="px-2 py-0.5 rounded font-medium transition-colors"
          :class="speedMultiplier === 1 ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          1x
        </button>
        <button
          type="button"
          @click="speedMultiplier = 2"
          class="px-2 py-0.5 rounded font-medium transition-colors"
          :class="speedMultiplier === 2 ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          2x
        </button>
        <button
          type="button"
          @click="speedMultiplier = 4"
          class="px-2 py-0.5 rounded font-medium transition-colors"
          :class="speedMultiplier === 4 ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          4x
        </button>
      </div>

      <!-- Camera Reset -->
      <button
        type="button"
        @click="resetCamera"
        class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono text-muted hover:text-ink transition-colors"
        title="Reset 3D camera angle"
      >
        <span>↺ View</span>
      </button>
    </div>

    <!-- Fluid Telemetry HUD Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Python Scalar Loop</div>
        <div class="font-bold text-brand-blue truncate">
          {{ pyTimerMs.toFixed(2) }} ms ({{ pyProcessedCount }} / {{ N }} cubes)
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">NumPy Vectorized SIMD</div>
        <div class="font-bold text-emerald-600 dark:text-emerald-400 truncate">
          {{ simdTimerMs.toFixed(2) }} ms (All in parallel)
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Overhead Bottleneck</div>
        <div class="font-bold text-brand-amber truncate" title="PyObject unboxing and dynamic dispatch per element">
          PyObject Type Unboxing
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Performance Gain</div>
        <div class="font-bold text-brand-green truncate" title="SIMD hardware vector registers eliminate interpretation overhead">
          {{ speedupFactor }} C-Speedup ✓
        </div>
      </div>
    </div>
  </div>
</template>

