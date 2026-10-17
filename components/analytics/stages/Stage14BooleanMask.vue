<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Play, Pause, StepForward, RotateCcw, Filter, CheckCircle2, XCircle, Sliders, Layers } from 'lucide-vue-next'
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

// 3x4 Matrix Base Data
const ROWS = 3
const COLS = 4
const matrixData = [
  [12, 64, 45, 88],
  [95, 23, 71, 38],
  [52, 16, 83, 30]
]

// Threshold Slider (Condition: X > threshold)
const threshold = ref<number>(50)
const conditionOp = ref<'>' | '<'>('>')

// Animation progress: 0 = 2D matrix with mask overlay, 1 = 1D collapsed extracted vector
const progress = ref(0)
const isPlaying = ref(false)
const selectedCell = ref<{ r: number; c: number; val: number; isTrue: boolean } | null>(null)

// Evaluate mask
const maskMatrix = computed(() => {
  const mask: boolean[][] = []
  let trueCount = 0
  for (let r = 0; r < ROWS; r++) {
    const row: boolean[] = []
    for (let c = 0; c < COLS; c++) {
      const isMatch = conditionOp.value === '>' ? matrixData[r][c] > threshold.value : matrixData[r][c] < threshold.value
      if (isMatch) trueCount++
      row.push(isMatch)
    }
    mask.push(row)
  }
  return { mask, trueCount }
})

// Three.js instances
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animFrameId = 0
let floatingAxesGroup: THREE.Group | null = null
let labelSpritesGroup: THREE.Group | null = null

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2(-999, -999)

const initialCameraPos = new THREE.Vector3(0.0, 1.2, 10.5)
const initialCameraTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

// Color palettes
const palTrue = { bg: '#ecfdf5', text: '#065f46', border: '#10b981' } // Emerald True Match
const palFalse = { bg: '#f1f5f9', text: '#94a3b8', border: '#cbd5e1' } // Muted Grey False
const palOutput = { bg: '#fef3c7', text: '#9a3412', border: '#ea580c' } // Amber Collapsed 1D

interface MaskNode {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  r: number
  c: number
  val: number
  isTrue: boolean
  pos2D: THREE.Vector3
  pos1D: THREE.Vector3
  trueIndex: number // order in 1D output vector
}

let activeNodes: MaskNode[] = []
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

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.35)
  scene.add(ambientLight)

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.1)
  dirLight1.position.set(8, 14, 10)
  scene.add(dirLight1)

  const dirLight2 = new THREE.DirectionalLight(0xbfdbfe, 0.45)
  dirLight2.position.set(-8, -4, -6)
  scene.add(dirLight2)

  // Ground Grid
  const gridHelper = new THREE.GridHelper(20, 20, isDark.value ? 0x334155 : 0xcbd5e1, isDark.value ? 0x1e293b : 0xe2ded4)
  gridHelper.position.y = -2.8
  scene.add(gridHelper)

  floatingAxesGroup = new THREE.Group()
  scene.add(floatingAxesGroup)

  labelSpritesGroup = new THREE.Group()
  scene.add(labelSpritesGroup)

  buildMaskScene()

  const animate = () => {
    animFrameId = requestAnimationFrame(animate)

    if (isPlaying.value) {
      progress.value += 0.009
      if (progress.value >= 1) {
        progress.value = 1
        isPlaying.value = false
      }
      applyProgressInterpolation(progress.value)
    }

    if (controls) controls.update()
    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  animate()
  emitInspection()
}

// Build 3D mesh nodes
const buildMaskScene = () => {
  if (!scene) return

  // Dispose existing
  activeNodes.forEach((n) => {
    scene?.remove(n.mesh)
    n.mesh.geometry.dispose()
    ;(n.mesh.material as THREE.Material).dispose()
    n.wireframe.geometry.dispose()
  })
  activeNodes = []
  allMeshes = []

  while (labelSpritesGroup && labelSpritesGroup.children.length > 0) {
    const child = labelSpritesGroup.children[0]
    labelSpritesGroup.remove(child)
  }

  const spacing = 1.32
  const cubeGeo = new THREE.BoxGeometry(0.95, 0.95, 0.95)
  const wireGeo = new THREE.EdgesGeometry(cubeGeo)

  const { mask, trueCount } = maskMatrix.value
  let currentTrueIndex = 0

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const val = matrixData[r][c]
      const isTrue = mask[r][c]
      const pal = isTrue ? palTrue : palFalse

      const tex = createNumberTexture(val, pal.bg, pal.text, pal.border)
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: isTrue ? 1.0 : 0.45
      })
      const mesh = new THREE.Mesh(cubeGeo, mat)
      const wireMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(pal.border),
        linewidth: isTrue ? 2 : 1,
        transparent: true,
        opacity: isTrue ? 1.0 : 0.4
      })
      const wireframe = new THREE.LineSegments(wireGeo, wireMat)
      mesh.add(wireframe)

      // 2D Matrix Position
      const x2D = (c - 1.5) * spacing
      const y2D = -(r - 1.0) * spacing
      const z2D = 0

      // 1D Target Position (if true, placed linearly along X centered at Y = -1.6)
      let x1D = x2D
      let y1D = y2D
      let trueIdx = -1

      if (isTrue) {
        trueIdx = currentTrueIndex
        // Center the trueCount elements along X
        x1D = (trueIdx - (trueCount - 1) / 2) * spacing
        y1D = -1.6
        currentTrueIndex++
      }

      mesh.position.set(x2D, y2D, z2D)
      mesh.userData = { r, c, val, isTrue, trueIdx }
      scene.add(mesh)

      activeNodes.push({
        mesh,
        wireframe,
        r,
        c,
        val,
        isTrue,
        pos2D: new THREE.Vector3(x2D, y2D, z2D),
        pos1D: new THREE.Vector3(x1D, y1D, z2D),
        trueIndex: trueIdx
      })
      allMeshes.push(mesh)
    }
  }

  // Header Title Sprite
  if (labelSpritesGroup) {
    const title = `Predicate: arr ${conditionOp.value} ${threshold.value} • Matches: ${trueCount} / 12`
    const titleSprite = createTextSprite(title, isDark.value ? '#34d399' : '#059669', 36)
    titleSprite.position.set(0, 2.3, 0)
    titleSprite.scale.set(5.2, 1.3, 1)
    labelSpritesGroup.add(titleSprite)
  }

  updateFloatingAxes()
  applyProgressInterpolation(progress.value)
}

// Progress Interpolation
const applyProgressInterpolation = (t: number) => {
  const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

  activeNodes.forEach((node) => {
    const mat = node.mesh.material as THREE.MeshStandardMaterial
    const wire = node.wireframe.material as THREE.LineBasicMaterial

    if (node.isTrue) {
      // True nodes interpolate from 2D pos to 1D compact vector
      node.mesh.position.lerpVectors(node.pos2D, node.pos1D, eased)

      if (t >= 0.7) {
        // Output palette
        const tex = createNumberTexture(node.val, palOutput.bg, palOutput.text, palOutput.border)
        mat.map = tex
        mat.needsUpdate = true
        wire.color.set(new THREE.Color(palOutput.border))
        node.mesh.scale.set(1.06, 1.06, 1.06)
      } else {
        const tex = createNumberTexture(node.val, palTrue.bg, palTrue.text, palTrue.border)
        mat.map = tex
        mat.needsUpdate = true
        wire.color.set(new THREE.Color(palTrue.border))
        node.mesh.scale.set(1, 1, 1)
      }
      mat.opacity = 1
      wire.opacity = 1
    } else {
      // False nodes dissolve and shrink
      const fade = Math.max(0, 1 - t * 2)
      mat.opacity = fade * 0.45
      wire.opacity = fade * 0.4
      const s = Math.max(0.1, 1 - t * 0.8)
      node.mesh.scale.set(s, s, s)
    }
  })
}

// Bounding-Frame Coordinate Axes
const updateFloatingAxes = () => {
  if (!floatingAxesGroup) return

  while (floatingAxesGroup.children.length > 0) {
    const child = floatingAxesGroup.children[0]
    floatingAxesGroup.remove(child)
  }

  if (activeNodes.length === 0) return

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  for (const node of activeNodes) {
    const pos = progress.value > 0.5 && node.isTrue ? node.pos1D : node.pos2D
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
  const lenX = Math.max(2.2, maxX - minX + halfW * 2 + clearance + marginExtra)
  const lenY = Math.max(2.2, maxY - minY + halfW * 2 + clearance + marginExtra)

  // X Axis (Cols / Vector elements)
  const arrowX = createBoldArrow(new THREE.Vector3(1, 0, 0), lenX, 0xef4444, progress.value > 0.7 ? 'axis 0 (1D Length)' : 'axis 1 (Cols)', 0.055, 0.16, 0.35)
  floatingAxesGroup.add(arrowX)

  // Y Axis (Rows - only during 2D matrix phase)
  if (progress.value < 0.7) {
    const arrowY = createBoldArrow(new THREE.Vector3(0, 1, 0), lenY, 0x10b981, 'axis 0 (Rows)', 0.055, 0.16, 0.35)
    floatingAxesGroup.add(arrowY)
  }
}

// User Actions
const setConditionOp = (op: '>' | '<') => {
  conditionOp.value = op
  progress.value = 0
  isPlaying.value = false
  buildMaskScene()
  emitInspection()
}

const onThresholdChange = () => {
  progress.value = 0
  isPlaying.value = false
  buildMaskScene()
  emitInspection()
}

const togglePlay = () => {
  if (progress.value >= 1) progress.value = 0
  isPlaying.value = !isPlaying.value
}

const stepNext = () => {
  isPlaying.value = false
  if (progress.value < 1) {
    progress.value = Math.min(1, Math.round((progress.value + 0.25) * 100) / 100)
  } else {
    progress.value = 0
  }
  applyProgressInterpolation(progress.value)
  updateFloatingAxes()
  emitInspection()
}

const resetSimulation = () => {
  isPlaying.value = false
  progress.value = 0
  buildMaskScene()
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
    if (data) {
      selectedCell.value = {
        r: data.r,
        c: data.c,
        val: data.val,
        isTrue: data.isTrue
      }
      emitInspection()
    }
  }
}

const emitInspection = () => {
  const { trueCount } = maskMatrix.value
  const cell = selectedCell.value

  const details: Record<string, any> = {
    'Predicate Condition': `arr ${conditionOp.value} ${threshold.value}`,
    'Total Elements': `12 items (3 rows × 4 cols)`,
    'Matches Passing Filter': `${trueCount} / 12 elements (${Math.round((trueCount / 12) * 100)}%)`,
    'Output Array Topology': `1D Vector (${trueCount},) contiguous`,
    'Dimensionality Collapse': '(3, 4) Matrix → (K,) Vector',
    'Architectural Insight': 'Boolean indexing ALWAYS flattens to 1D because rows contain differing match counts.',
    'Memory Mechanism': 'COPY (Non-uniform scattered indices cannot share strided view)'
  }

  if (cell) {
    details['Inspected Cell'] = `arr[${cell.r}, ${cell.c}] = ${cell.val}`
    details['Predicate Evaluation'] = `${cell.val} ${conditionOp.value} ${threshold.value} → ${cell.isTrue ? 'True (Retained)' : 'False (Discarded)'}`
  }

  emit('inspect', {
    title: `Boolean Indexing: arr[arr ${conditionOp.value} ${threshold.value}]`,
    details
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
    buildMaskScene()
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

  activeNodes.forEach((n) => {
    n.mesh.geometry.dispose()
    ;(n.mesh.material as THREE.Material).dispose()
    n.wireframe.geometry.dispose()
  })
  activeNodes = []
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
        <!-- Top Status Bar: Threshold Slider & Predicate Controls -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <!-- Predicate Selector & Threshold Slider -->
          <div class="flex items-center gap-2 bg-card/90 backdrop-blur-md p-1.5 rounded-md border border-line shadow-xs pointer-events-auto text-xs font-mono">
            <span class="text-muted font-bold">Filter:</span>
            <div class="flex items-center border border-line rounded bg-card-subtle p-0.5">
              <button
                type="button"
                @click="setConditionOp('>')"
                class="px-2 py-0.5 rounded font-bold transition-colors"
                :class="conditionOp === '>' ? 'bg-brand-blue text-white shadow-xs' : 'text-muted hover:text-ink'"
              >
                &gt;
              </button>
              <button
                type="button"
                @click="setConditionOp('<')"
                class="px-2 py-0.5 rounded font-bold transition-colors"
                :class="conditionOp === '<' ? 'bg-brand-blue text-white shadow-xs' : 'text-muted hover:text-ink'"
              >
                &lt;
              </button>
            </div>

            <div class="flex items-center gap-1.5 pl-1">
              <input
                id="thresholdSlider"
                type="range"
                min="15"
                max="85"
                step="5"
                v-model.number="threshold"
                @input="onThresholdChange"
                class="w-24 accent-brand-blue cursor-pointer"
              />
              <span class="font-bold text-brand-blue w-6 text-center">{{ threshold }}</span>
            </div>
          </div>

          <!-- Matching Count Badge -->
          <div class="flex items-center gap-2 pointer-events-auto text-xs font-mono">
            <span class="px-2.5 py-1 rounded-md bg-card/90 backdrop-blur-md border border-line shadow-xs font-bold text-emerald-600 dark:text-emerald-400">
              Matches: {{ maskMatrix.trueCount }} / 12 True
            </span>
          </div>
        </div>

        <!-- Bottom Overlay: Active Instruction Note -->
        <div class="flex items-center justify-between text-[0.68rem] text-muted">
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full" :class="progress > 0.5 ? 'bg-brand-amber' : 'bg-emerald-500'" />
            <span v-if="progress < 0.5">
              Phase 1 (Mask Projection): True cells glow emerald; False cells muted grey.
            </span>
            <span v-else>
              Phase 2 (1D Extraction): Matrix collapses (3, 4) → ({{ maskMatrix.trueCount }},) 1D contiguous vector!
            </span>
          </div>
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono hidden sm:block">
            Drag: Orbit 360° • Click: Inspect Cell Predicate
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
          <span>{{ isPlaying ? 'Pause' : 'Extract Masked Values' }}</span>
        </button>

        <button
          type="button"
          @click="stepNext"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono font-medium text-ink transition-colors"
          title="Step extraction animation"
        >
          <StepForward class="w-3.5 h-3.5 text-muted" />
          <span>Step (+25%)</span>
        </button>

        <button
          type="button"
          @click="resetSimulation"
          class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono text-muted hover:text-ink transition-colors"
          title="Reset to 2D matrix"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>

        <!-- Progress Slider -->
        <div class="flex items-center gap-1.5 text-xs font-mono text-muted pl-1">
          <input
            id="extractProgress"
            type="range"
            min="0"
            max="1"
            step="0.01"
            v-model.number="progress"
            @input="isPlaying = false; applyProgressInterpolation(progress); updateFloatingAxes(); emitInspection()"
            class="w-24 accent-brand-blue cursor-pointer"
          />
          <span class="font-bold text-brand-blue w-11 text-right">{{ Math.round(progress * 100) }}%</span>
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

      <!-- Quick Summary Status -->
      <div class="flex items-center gap-2 text-xs font-mono">
        <span class="text-muted">Topology Transition:</span>
        <span class="font-bold text-brand-purple">
          (3, 4) → ({{ maskMatrix.trueCount }},) 1D Vector
        </span>
      </div>
    </div>

    <!-- Fluid Telemetry HUD Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Boolean Predicate</div>
        <div class="font-bold text-brand-blue truncate" title="Mask condition">
          mask = arr {{ conditionOp }} {{ threshold }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Filter Ratio</div>
        <div class="font-bold text-emerald-600 dark:text-emerald-400 truncate">
          {{ maskMatrix.trueCount }} Passed / {{ 12 - maskMatrix.trueCount }} Dropped
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Shape Compaction</div>
        <div class="font-bold text-brand-purple truncate" title="(3, 4) -> (K,)">
          (3, 4) → ({{ maskMatrix.trueCount }},) [1D Output]
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Memory Allocation</div>
        <div class="font-bold text-brand-green truncate" title="Scattered indices allocate new buffer">
          Always COPY in RAM ✓
        </div>
      </div>
    </div>
  </div>
</template>

