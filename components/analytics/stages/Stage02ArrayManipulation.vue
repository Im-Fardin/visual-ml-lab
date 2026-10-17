<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RotateCcw, Play, StepForward, Layers, ArrowDown, ArrowRight, RefreshCw } from 'lucide-vue-next'
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

// 2x3 Array A and Array B
const dataA = [
  [1, 2, 3],
  [4, 5, 6]
]
const dataB = [
  [7, 8, 9],
  [10, 11, 12]
]

type OpMode = 'concat_axis0' | 'concat_axis1' | 'transpose'
const activeOp = ref<OpMode>('concat_axis0')

const progress = ref(0) // 0 = initial separated state, 1 = manipulated/docked
const isPlaying = ref(false)
let playTimer: ReturnType<typeof setInterval> | null = null

interface ManipNode {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  array: 'A' | 'B'
  r: number
  c: number
  val: number
  pos0: THREE.Vector3
  posTarget: THREE.Vector3
  targetOpacity: number
}

const allNodes: ManipNode[] = []
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animFrameId = 0
let axesGroup: THREE.Group | null = null
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2(-999, -999)

const initialCameraPos = new THREE.Vector3(5.2, 4.5, 7.8)
const initialTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

// Color palettes
const palA = { bg: '#ffffff', text: '#1e40af', border: '#3b82f6' } // Blue
const palB = { bg: '#ffffff', text: '#065f46', border: '#10b981' } // Green

// Metadata & Code representation
const opMetadata = computed(() => {
  if (activeOp.value === 'concat_axis0') {
    return {
      title: 'Vertical Concatenation: np.vstack() / axis=0',
      origShape: 'A: (2, 3) + B: (2, 3)',
      resShape: progress.value >= 0.5 ? '(4, 3)' : 'Separated (2, 3)',
      invariant: 'axis=0 stacks along rows (columns must match)',
      code: `# Vertical Concatenation along axis=0
import numpy as np

A = np.array([[1, 2, 3], [4, 5, 6]])
B = np.array([[7, 8, 9], [10, 11, 12]])

# Stacks rows vertically
C = np.concatenate([A, B], axis=0) # or np.vstack((A, B))
print("Result Shape:", C.shape)    # (4, 3)`
    }
  } else if (activeOp.value === 'concat_axis1') {
    return {
      title: 'Horizontal Concatenation: np.hstack() / axis=1',
      origShape: 'A: (2, 3) + B: (2, 3)',
      resShape: progress.value >= 0.5 ? '(2, 6)' : 'Separated (2, 3)',
      invariant: 'axis=1 glues columns horizontally (rows must match)',
      code: `# Horizontal Concatenation along axis=1
import numpy as np

A = np.array([[1, 2, 3], [4, 5, 6]])
B = np.array([[7, 8, 9], [10, 11, 12]])

# Glues columns horizontally
C = np.concatenate([A, B], axis=1) # or np.hstack((A, B))
print("Result Shape:", C.shape)    # (2, 6)`
    }
  } else {
    return {
      title: 'Transposition: A.T (Swapping Axes 0 and 1)',
      origShape: 'A: (2, 3)',
      resShape: progress.value >= 0.5 ? '(3, 2)' : '(2, 3)',
      invariant: 'A.T reflects elements across the diagonal: (i, j) -> (j, i)',
      code: `# Transpose A.T
import numpy as np

A = np.array([
    [1, 2, 3],
    [4, 5, 6]
])

AT = A.T # Swaps axis 0 and axis 1
print("A Shape:", A.shape)   # (2, 3)
print("A.T Shape:", AT.shape) # (3, 2)`
    }
  }
})

const initThree = () => {
  if (!containerRef.value || !canvasRef.value) return

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight

  scene = new THREE.Scene()
  const bgCol = isDark.value ? 0x12161d : 0xf6f4ef
  scene.background = new THREE.Color(bgCol)

  camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100)
  camera.position.copy(initialCameraPos)

  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
    powerPreference: 'high-performance'
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  controls = new OrbitControls(camera, canvasRef.value)
  controls.enableDamping = true
  controls.dampingFactor = 0.06
  controls.minPolarAngle = 0.2
  controls.maxPolarAngle = Math.PI / 2 + 0.1
  controls.target.copy(initialTarget)

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, isDark.value ? 1.4 : 1.2)
  scene.add(ambientLight)

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2)
  dirLight1.position.set(10, 14, 12)
  scene.add(dirLight1)

  axesGroup = new THREE.Group()
  scene.add(axesGroup)

  buildNodes()
  updateTargets()
  renderAxes()

  const animate = () => {
    animFrameId = requestAnimationFrame(animate)

    const t = progress.value
    for (const node of allNodes) {
      node.mesh.position.lerpVectors(node.pos0, node.posTarget, t)
      const mat = node.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = THREE.MathUtils.lerp(1, node.targetOpacity, t)
    }

    controls?.update()
    renderer?.render(scene!, camera!)
  }

  animate()
  emitInspectInfo()
}

// Build 6 cubes for Array A and 6 cubes for Array B
const buildNodes = () => {
  if (!scene) return

  allNodes.forEach(n => {
    scene?.remove(n.mesh)
    n.mesh.geometry.dispose()
    ;(n.mesh.material as THREE.Material).dispose()
    n.wireframe.geometry.dispose()
  })
  allNodes.length = 0

  const boxGeom = new THREE.BoxGeometry(0.85, 0.85, 0.85)
  const edgesGeom = new THREE.EdgesGeometry(boxGeom)

  // Array A: 2 rows x 3 cols
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const val = dataA[r][c]
      const tex = createNumberTexture(val, palA.bg, palA.text, palA.border)
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95 })
      const mesh = new THREE.Mesh(boxGeom, mat)

      const wireMat = new THREE.LineBasicMaterial({ color: 0x1e40af, transparent: true, opacity: 0.3 })
      const wireframe = new THREE.LineSegments(edgesGeom, wireMat)
      mesh.add(wireframe)
      scene.add(mesh)

      allNodes.push({
        mesh,
        wireframe,
        array: 'A',
        r,
        c,
        val,
        pos0: new THREE.Vector3(),
        posTarget: new THREE.Vector3(),
        targetOpacity: 1
      })
    }
  }

  // Array B: 2 rows x 3 cols
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const val = dataB[r][c]
      const tex = createNumberTexture(val, palB.bg, palB.text, palB.border)
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95 })
      const mesh = new THREE.Mesh(boxGeom, mat)

      const wireMat = new THREE.LineBasicMaterial({ color: 0x065f46, transparent: true, opacity: 0.3 })
      const wireframe = new THREE.LineSegments(edgesGeom, wireMat)
      mesh.add(wireframe)
      scene.add(mesh)

      allNodes.push({
        mesh,
        wireframe,
        array: 'B',
        r,
        c,
        val,
        pos0: new THREE.Vector3(),
        posTarget: new THREE.Vector3(),
        targetOpacity: 1
      })
    }
  }
}

// Update initial and target positions
const updateTargets = () => {
  const dX = 1.05
  const dY = 1.05

  if (activeOp.value === 'concat_axis0') {
    // Array A sits top-center, Array B sits far below, target docks B directly under A
    allNodes.forEach(node => {
      node.targetOpacity = 1
      if (node.array === 'A') {
        const x = (node.c - 1) * dX
        const y = (1 - node.r) * dY + 0.6
        node.pos0.set(x, y, 0)
        node.posTarget.set(x, y, 0)
      } else {
        const x = (node.c - 1) * dX
        const yInit = -node.r * dY - 1.8
        const yTarget = (1 - (node.r + 2)) * dY + 0.6 // rows 2 & 3
        node.pos0.set(x, yInit, 0)
        node.posTarget.set(x, yTarget, 0)
      }
    })
  } else if (activeOp.value === 'concat_axis1') {
    // Array A sits left, Array B sits far right, target docks B alongside A
    allNodes.forEach(node => {
      node.targetOpacity = 1
      if (node.array === 'A') {
        const xInit = (node.c - 1) * dX - 1.5
        const xTarget = (node.c - 2.5) * dX
        const y = (1 - node.r) * dY - 0.5
        node.pos0.set(xInit, y, 0)
        node.posTarget.set(xTarget, y, 0)
      } else {
        const xInit = (node.c - 1) * dX + 2.5
        const xTarget = (node.c + 0.5) * dX
        const y = (1 - node.r) * dY - 0.5
        node.pos0.set(xInit, y, 0)
        node.posTarget.set(xTarget, y, 0)
      }
    })
  } else {
    // Transpose of Array A:
    // A starts at (2 rows, 3 cols) and rotates/reflects to (3 rows, 2 cols)
    allNodes.forEach(node => {
      if (node.array === 'A') {
        node.targetOpacity = 1
        const x0 = (node.c - 1) * dX
        const y0 = (1 - node.r) * dY
        node.pos0.set(x0, y0, 0)

        // Target: row r becomes col r, col c becomes row c (swapping r and c)
        // new rows: 3 (c in 0, 1, 2), new cols: 2 (r in 0, 1)
        const xTarget = (node.r - 0.5) * dX
        const yTarget = (1 - node.c) * dY
        node.posTarget.set(xTarget, yTarget, 0)
      } else {
        // Fade out Array B in transpose mode
        node.targetOpacity = 0.05
        node.pos0.set(0, -3, 0)
        node.posTarget.set(0, -3, 0)
      }
    })
  }
}

const renderAxes = () => {
  if (!scene || !axesGroup) return

  while (axesGroup.children.length > 0) {
    const obj = axesGroup.children[0]
    axesGroup.remove(obj)
  }

  const origin = new THREE.Vector3(-3.2, -2.0, -1.0)
  const arrowX = createBoldArrow(origin, new THREE.Vector3(1, 0, 0), 3.0, 0x2563eb)
  axesGroup.add(arrowX)
  const labelX = createTextSprite('axis 1 (cols)', 0x2563eb)
  labelX.position.set(origin.x + 3.4, origin.y, origin.z)
  axesGroup.add(labelX)

  const arrowY = createBoldArrow(origin, new THREE.Vector3(0, 1, 0), 2.5, 0x10b981)
  axesGroup.add(arrowY)
  const labelY = createTextSprite('axis 0 (rows)', 0x10b981)
  labelY.position.set(origin.x, origin.y + 2.7, origin.z)
  axesGroup.add(labelY)
}

const emitInspectInfo = () => {
  const meta = opMetadata.value
  emit('inspect', {
    title: meta.title,
    details: {
      'Operation': activeOp.value,
      'Input Shapes': meta.origShape,
      'Result Shape': meta.resShape,
      'Progress': `${Math.round(progress.value * 100)}%`,
      'Rule Invariant': meta.invariant,
      'Memory Strides': activeOp.value === 'transpose' ? 'Transposition modifies strides (shares data buffer)' : 'Concatenation allocates a new contiguous memory array'
    }
  })
}

const setOp = (op: OpMode) => {
  activeOp.value = op
  progress.value = 0
  isPlaying.value = false
  if (playTimer) clearInterval(playTimer)
  updateTargets()
  emitInspectInfo()
}

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) {
    if (progress.value >= 1) progress.value = 0
    playTimer = setInterval(() => {
      if (progress.value < 1) {
        progress.value = Math.min(1, progress.value + 0.05)
        emitInspectInfo()
      } else {
        isPlaying.value = false
        if (playTimer) clearInterval(playTimer)
      }
    }, 50)
  } else if (playTimer) {
    clearInterval(playTimer)
  }
}

const resetSimulation = () => {
  isPlaying.value = false
  if (playTimer) clearInterval(playTimer)
  progress.value = 0
  emitInspectInfo()
}

const resetCamera = () => {
  if (!camera || !controls) return
  camera.position.copy(initialCameraPos)
  controls.target.copy(initialTarget)
  controls.update()
}

const handleResize = () => {
  if (!containerRef.value || !camera || !renderer) return
  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

watch(isDark, (val) => {
  if (scene) {
    scene.background = new THREE.Color(val ? 0x12161d : 0xf6f4ef)
  }
})

onMounted(() => {
  initThree()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (animFrameId) cancelAnimationFrame(animFrameId)
  if (playTimer) clearInterval(playTimer)
  renderer?.dispose()
})
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <!-- Top Action Toolbar -->
    <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
      <!-- Operation Selectors -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">Manipulation:</span>
        <button
          type="button"
          @click="setOp('concat_axis0')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeOp === 'concat_axis0' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <ArrowDown class="w-3.5 h-3.5" />
          <span>vstack (axis=0)</span>
        </button>
        <button
          type="button"
          @click="setOp('concat_axis1')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeOp === 'concat_axis1' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <ArrowRight class="w-3.5 h-3.5" />
          <span>hstack (axis=1)</span>
        </button>
        <button
          type="button"
          @click="setOp('transpose')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeOp === 'transpose' ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <RefreshCw class="w-3.5 h-3.5" />
          <span>Transpose (arr.T)</span>
        </button>
      </div>

      <!-- Result Shape Badge -->
      <div class="flex items-center gap-2 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <span class="w-2 h-2 rounded-full" :class="progress >= 0.5 ? 'bg-emerald-500' : 'bg-brand-blue'" />
        <span class="font-bold text-ink">{{ opMetadata.resShape }}</span>
      </div>
    </div>

    <!-- Main 3D Viewport -->
    <div class="relative w-full rounded-lg border border-line bg-stage shadow-xs min-h-[420px] h-[460px] overflow-hidden select-none">
      <div ref="containerRef" class="w-full h-full relative cursor-grab active:cursor-grabbing">
        <canvas ref="canvasRef" class="w-full h-full block" />

        <!-- Floating Camera Reset & Hint -->
        <div class="absolute bottom-3 right-3 flex items-center gap-2">
          <button
            type="button"
            @click="resetCamera"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-card/90 backdrop-blur-sm border border-line text-xs font-mono text-muted hover:text-ink shadow-xs cursor-pointer"
            title="Reset Isometric View"
          >
            <RotateCcw class="w-3.5 h-3.5" />
            <span>Reset Camera</span>
          </button>
        </div>

        <!-- Floating HUD Overlay (Top-Left) -->
        <div class="absolute top-3 left-3 flex flex-col gap-1.5 bg-card/85 backdrop-blur-sm border border-line p-2.5 rounded-md shadow-xs text-xs font-mono">
          <div class="flex items-center justify-between gap-4 border-b border-line/60 pb-1">
            <span class="text-muted text-[11px]">Inputs:</span>
            <span class="font-bold text-ink">{{ opMetadata.origShape }}</span>
          </div>
          <div class="flex items-center justify-between gap-4 border-b border-line/60 pb-1">
            <span class="text-muted text-[11px]">Target Shape:</span>
            <span class="font-bold text-brand-blue">{{ opMetadata.resShape }}</span>
          </div>
          <div class="flex items-center justify-between gap-4">
            <span class="text-muted text-[11px]">Progress:</span>
            <span class="font-bold text-emerald-600 dark:text-emerald-400">{{ Math.round(progress * 100) }}%</span>
          </div>
        </div>
      </div>

      <!-- Bottom Interactive Playback Slider -->
      <div class="absolute bottom-3 left-3 right-36 flex items-center gap-2 bg-card/90 backdrop-blur-sm border border-line px-3 py-1.5 rounded-md text-xs font-mono">
        <button
          type="button"
          @click="togglePlay"
          class="flex items-center gap-1 px-2 py-1 rounded bg-brand-blue text-white font-bold cursor-pointer"
        >
          <Play class="w-3.5 h-3.5 fill-current" v-if="!isPlaying" />
          <span v-else>||</span>
          <span>{{ isPlaying ? 'Pause' : 'Animate' }}</span>
        </button>

        <button
          type="button"
          @click="resetSimulation"
          class="px-2 py-1 rounded border border-line text-muted hover:text-ink cursor-pointer"
          title="Reset"
        >
          Reset
        </button>

        <span class="text-muted text-[11px] ml-1">Step:</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          v-model.number="progress"
          @input="emitInspectInfo"
          class="flex-1 accent-brand-blue cursor-pointer h-1.5 bg-line rounded-lg"
        />
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active Array Manipulation Command:</span>
        <span class="text-brand-blue font-semibold">{{ opMetadata.invariant }}</span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ opMetadata.code }}</code></pre>
    </div>
  </div>
</template>

