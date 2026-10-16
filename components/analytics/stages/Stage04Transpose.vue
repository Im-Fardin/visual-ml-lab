<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Play, Pause, StepForward, RotateCcw } from 'lucide-vue-next'
import { createNumberTexture } from '~/utils/threeTexture'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', data: { title: string; details: Record<string, any> }): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

// Transpose State
const progress = ref(0) // 0 = X (4x3), 1 = X^T (3x4)
const isPlaying = ref(false)
const selectedCell = ref<{ r: number; c: number; val: number }>({
  r: 1,
  c: 2,
  val: 19
})

// Three.js instances
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animFrameId = 0
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2(-999, -999)

const ROWS = 4
const COLS = 3

// Initial Matrix Values (4 rows x 3 cols)
const matrixData = [
  [12, 45, 28],
  [34, 62, 19],
  [51, 88, 30],
  [27, 53, 42]
]

// Distinct color styling per row for visual tracking
const rowStyles = [
  { bg: '#ffffff', text: '#1e40af', border: '#2563eb' }, // Row 0: Blue
  { bg: '#ffffff', text: '#5b21b6', border: '#7c3aed' }, // Row 1: Purple
  { bg: '#ffffff', text: '#14532d', border: '#16a34a' }, // Row 2: Green
  { bg: '#ffffff', text: '#9a3412', border: '#ea580c' }  // Row 3: Amber/Orange
]

// Diagonal style (Amber/Gold)
const diagStyle = { bg: '#fffbeb', text: '#78350f', border: '#d97706' }

interface MatrixCellNode {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  row: number
  col: number
  value: number
  isDiagonal: boolean
  x0: number
  z0: number
}

const cellNodes: MatrixCellNode[] = []
const initialCameraPos = new THREE.Vector3(1.0, 3.2, 7.8)
const initialCameraTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

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

  // Controls (360° Free Orbit)
  controls = new OrbitControls(camera, canvasRef.value)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minPolarAngle = 0.2
  controls.maxPolarAngle = Math.PI / 2 + 0.1
  controls.target.copy(initialCameraTarget)

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, isDark.value ? 1.5 : 1.3)
  scene.add(ambientLight)

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.0)
  dirLight1.position.set(8, 14, 10)
  scene.add(dirLight1)

  // Ground Grid
  const gridHelper = new THREE.GridHelper(16, 16, isDark.value ? 0x2b3340 : 0xd1d5db, isDark.value ? 0x1f242e : 0xe5e7eb)
  gridHelper.position.y = -2.8
  scene.add(gridHelper)

  // Geometry
  const boxGeom = new THREE.BoxGeometry(0.85, 0.5, 0.85)
  const edgesGeom = new THREE.EdgesGeometry(boxGeom)
  const spacing = 1.35

  // Golden Main Diagonal Line (x = z)
  const diagLineGeom = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-2.8, 0, -2.8),
    new THREE.Vector3(2.8, 0, 2.8)
  ])
  const diagLineMat = new THREE.LineDashedMaterial({
    color: 0xd97706,
    dashSize: 0.25,
    gapSize: 0.15,
    linewidth: 2
  })
  const diagLine = new THREE.Line(diagLineGeom, diagLineMat)
  diagLine.computeLineDistances()
  diagLine.position.y = -0.26
  scene.add(diagLine)

  // Instantiate Cells
  // Origin centered on diagonal center index (1, 1):
  // x0 = (c - 1) * spacing
  // z0 = (r - 1) * spacing
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const isDiag = r === c
      const style = isDiag ? diagStyle : rowStyles[r]
      const val = matrixData[r][c]
      const numberTex = createNumberTexture(val, style.bg, style.text, style.border)

      const mat = new THREE.MeshBasicMaterial({
        map: numberTex,
        transparent: false
      })

      const mesh = new THREE.Mesh(boxGeom, mat)
      const wireMat = new THREE.LineBasicMaterial({
        color: isDark.value ? 0xffffff : 0x1b2430,
        transparent: true,
        opacity: isDiag ? 0.7 : 0.25
      })
      const wireframe = new THREE.LineSegments(edgesGeom, wireMat)
      mesh.add(wireframe)

      const x0 = (c - 1) * spacing
      const z0 = (r - 1) * spacing

      mesh.position.set(x0, 0, z0)
      mesh.userData = { row: r, col: c, value: val, isDiag }
      scene.add(mesh)

      cellNodes.push({
        mesh,
        wireframe,
        row: r,
        col: c,
        value: val,
        isDiagonal: isDiag,
        x0,
        z0
      })
    }
  }

  updateInterpolation(progress.value)

  // Animation Loop
  let playDirection = 1
  const animate = () => {
    animFrameId = requestAnimationFrame(animate)

    if (isPlaying.value) {
      progress.value += 0.012 * playDirection
      if (progress.value >= 1) {
        progress.value = 1
        playDirection = -1
        isPlaying.value = false // Strict no auto-run
      } else if (progress.value <= 0) {
        progress.value = 0
        playDirection = 1
        isPlaying.value = false
      }
      updateInterpolation(progress.value)
    }

    controls?.update()
    renderer?.render(scene!, camera!)
  }

  animate()
}

/**
 * True 180° continuous spatial rotation around the main diagonal axis x = z.
 * Ensures zero cube collision and exact final alignment at t = 1.0!
 */
const updateInterpolation = (t: number) => {
  const theta = Math.PI * t
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)

  // Diagonal axis rotation quaternion
  const diagAxis = new THREE.Vector3(1, 0, 1).normalize()
  const rotQuat = new THREE.Quaternion().setFromAxisAngle(diagAxis, theta)

  for (const node of cellNodes) {
    if (node.isDiagonal) {
      // Anchored strictly on the diagonal line x = z
      node.mesh.position.set(node.x0, 0, node.z0)
      node.mesh.quaternion.identity()
      continue
    }

    // Mathematical Rodrigues rotation around diagonal axis
    const xMid = (node.x0 + node.z0) / 2
    const xDiff = (node.x0 - node.z0) / 2

    const curX = xMid + xDiff * cosT
    const curZ = xMid - xDiff * cosT
    const curY = (node.x0 - node.z0) * 0.7071 * sinT // (x0 - z0) / sqrt(2) * sin(theta)

    node.mesh.position.set(curX, curY, curZ)
    node.mesh.quaternion.copy(rotQuat)
  }

  emitInspection()
}

const emitInspection = () => {
  if (!selectedCell.value) return
  const { r, c, val } = selectedCell.value
  const isDiag = r === c
  const pct = Math.round(progress.value * 100)

  emit('inspect', {
    title: `Matrix Element X[${r}, ${c}] → Xᵀ[${c}, ${r}]`,
    details: {
      'Source Matrix Coord': `X[${r}, ${c}] = ${val}`,
      'Transposed Target': `Xᵀ[${c}, ${r}] = ${val}`,
      'Diagonal Invariant': isDiag ? 'Main Diagonal Fixed (i = j)' : '180° Continuous Orbit',
      'Row-to-Col Shift': `Row ${r} ➔ Column ${r}`,
      'Transposition Stage': `${pct}% (${progress.value < 0.5 ? 'Matrix X' : 'Matrix Xᵀ'})`,
      'Mathematical Equivalence': `Xᵀ[${c}, ${r}] == X[${r}, ${c}]`
    }
  })
}

// Raycaster Cell Selection
const onCanvasPointerDown = (event: MouseEvent) => {
  if (!canvasRef.value || !camera || !scene) return

  const rect = canvasRef.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(cellNodes.map((n) => n.mesh))

  if (intersects.length > 0) {
    const hit = intersects[0].object as THREE.Mesh
    const data = hit.userData
    if (data) {
      selectedCell.value = {
        r: data.row,
        c: data.col,
        val: data.value
      }
      emitInspection()
    }
  }
}

// Controls
const togglePlay = () => {
  isPlaying.value = !isPlaying.value
}

const stepTranspose = () => {
  isPlaying.value = false
  if (progress.value >= 0.99) {
    progress.value = 0
  } else if (progress.value < 0.5) {
    progress.value = 0.5
  } else {
    progress.value = 1.0
  }
  updateInterpolation(progress.value)
}

const resetSimulation = () => {
  isPlaying.value = false
  progress.value = 0
  updateInterpolation(0)
}

const resetCamera = () => {
  if (!camera || !controls) return
  camera.position.copy(initialCameraPos)
  controls.target.copy(initialCameraTarget)
  controls.update()
}

const handleResize = () => {
  if (!containerRef.value || !renderer || !camera) return
  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
}

onMounted(() => {
  initThree()
  window.addEventListener('resize', handleResize)
  canvasRef.value?.addEventListener('pointerdown', onCanvasPointerDown)
  emitInspection()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animFrameId)
  window.removeEventListener('resize', handleResize)
  canvasRef.value?.removeEventListener('pointerdown', onCanvasPointerDown)

  for (const node of cellNodes) {
    node.mesh.geometry.dispose()
    ;(node.mesh.material as THREE.Material).dispose()
    node.wireframe.geometry.dispose()
    ;(node.wireframe.material as THREE.Material).dispose()
  }
  controls?.dispose()
  renderer?.dispose()
})

watch(isDark, (dark) => {
  if (scene) {
    scene.background = new THREE.Color(dark ? 0x151a22 : 0xfbfaf7)
  }
})
</script>

<template>
  <div class="flex flex-col gap-2.5 w-full select-none">
    <!-- 3D Canvas Stage Card: Strictly clamped height -->
    <div class="relative bg-card border border-line rounded-lg p-1.5 flex flex-col shadow-xs">
      <div
        ref="containerRef"
        class="w-full h-[300px] sm:h-[330px] lg:h-[360px] max-h-[46vh] rounded-md bg-stage border border-line overflow-hidden relative cursor-grab active:cursor-grabbing"
      >
        <canvas ref="canvasRef" class="w-full h-full block outline-none" />

        <!-- Top Legend Badge -->
        <div class="absolute top-2.5 left-2.5 z-10 flex items-center gap-2 bg-card/90 backdrop-blur-md px-2.5 py-1 rounded-md border border-line shadow-xs text-xs font-mono">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded bg-brand-amber inline-block" />
            <span class="text-ink font-semibold">Diagonal (i=j)</span>
          </div>
          <span class="text-line">|</span>
          <span class="text-muted text-[11px]">Rows 0-3 Color-Coded</span>
        </div>

        <!-- 360 Orbit Hint -->
        <div class="absolute top-2.5 right-2.5 text-[0.68rem] text-muted bg-card/90 border border-line px-2 py-0.5 rounded select-none pointer-events-none hidden sm:block">
          Drag: Orbit 360° • Click: Inspect
        </div>
      </div>
    </div>

    <!-- Compact Execution Control Toolbar: Positioned IMMEDIATELY below stage -->
    <div class="bg-card border border-line rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="togglePlay"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors shadow-xs"
          :class="isPlaying ? 'bg-brand-amber text-white' : 'bg-brand-blue hover:bg-brand-blue-hover text-white'"
        >
          <Pause v-if="isPlaying" class="w-3.5 h-3.5 fill-current" />
          <Play v-else class="w-3.5 h-3.5 fill-current" />
          <span>{{ isPlaying ? 'Pause' : 'Play Orbit' }}</span>
        </button>

        <button
          type="button"
          @click="stepTranspose"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono font-medium text-ink transition-colors"
          title="Step transposition state"
        >
          <StepForward class="w-3.5 h-3.5 text-muted" />
          <span>Step</span>
        </button>

        <button
          type="button"
          @click="resetSimulation"
          class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono text-muted hover:text-ink transition-colors"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      <!-- Continuous Progress Slider -->
      <div class="flex items-center gap-2 text-xs font-mono text-muted">
        <label for="stepSlider">Progress</label>
        <input
          id="stepSlider"
          type="range"
          min="0"
          max="1"
          step="0.005"
          v-model.number="progress"
          @input="isPlaying = false; updateInterpolation(progress)"
          class="w-28 accent-brand-blue cursor-pointer"
        />
        <span class="font-bold text-brand-blue pl-0.5">{{ progress.toFixed(2) }}</span>
      </div>

      <!-- Reset Camera -->
      <button
        type="button"
        @click="resetCamera"
        class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono text-muted hover:text-ink transition-colors"
        title="Reset 3D camera angle"
      >
        <span>↺ View</span>
      </button>
    </div>

    <!-- Fluid Telemetry HUD Grid with Formula Invariant -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Shape</div>
        <div class="font-bold text-brand-blue truncate">{{ progress < 0.5 ? 'X: (4, 3)' : 'Xᵀ: (3, 4)' }}</div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Formula Invariant</div>
        <div class="font-bold text-ink truncate" title="Xᵀ[j, i] = X[i, j]">Xᵀ[j, i] = X[i, j]</div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Diagonal</div>
        <div class="font-bold text-brand-green truncate">3 Anchored (i = j)</div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Selection</div>
        <div class="font-bold text-brand-amber truncate" :title="`X[${selectedCell.r}, ${selectedCell.c}] = ${selectedCell.val}`">
          X[{{ selectedCell.r }}, {{ selectedCell.c }}] = {{ selectedCell.val }}
        </div>
      </div>
    </div>
  </div>
</template>
