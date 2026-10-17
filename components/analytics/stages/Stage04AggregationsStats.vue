<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Play, Pause, StepForward, RotateCcw, ArrowDown, ArrowRight, Maximize2, CheckCircle2, ShieldCheck } from 'lucide-vue-next'
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
  [2, 4, 1, 5],
  [3, 1, 4, 2],
  [1, 5, 3, 3]
]

// Reduction Operators
type OperatorKey = 'sum' | 'mean' | 'min' | 'max'
const activeOp = ref<OperatorKey>('sum')

// Reduction Axis: null (Global), 0 (Collapse Rows), 1 (Collapse Columns)
type AxisSelection = null | 0 | 1
const activeAxis = ref<AxisSelection>(0)

// keepdims Toggle
const keepdims = ref<boolean>(false)

// Animation & Transitions
const progress = ref(0) // 0 = full unreduced matrix, 1 = collapsed reduction
const isPlaying = ref(false)
const selectedCell = ref<{ r: number; c: number; val: number }>({ r: 0, c: 0, val: 2 })

// Precompute reduction results
const computeReductionValues = (op: OperatorKey) => {
  // Axis 0: collapse rows -> 4 columns
  const axis0Vals = [0, 1, 2, 3].map((c) => {
    const colItems = [matrixData[0][c], matrixData[1][c], matrixData[2][c]]
    if (op === 'sum') return colItems.reduce((a, b) => a + b, 0)
    if (op === 'mean') return Math.round((colItems.reduce((a, b) => a + b, 0) / ROWS) * 10) / 10
    if (op === 'min') return Math.min(...colItems)
    return Math.max(...colItems)
  })

  // Axis 1: collapse cols -> 3 rows
  const axis1Vals = [0, 1, 2].map((r) => {
    const rowItems = matrixData[r]
    if (op === 'sum') return rowItems.reduce((a, b) => a + b, 0)
    if (op === 'mean') return Math.round((rowItems.reduce((a, b) => a + b, 0) / COLS) * 10) / 10
    if (op === 'min') return Math.min(...rowItems)
    return Math.max(...rowItems)
  })

  // Global reduction -> single scalar
  const allItems = matrixData.flat()
  let globalVal = 0
  if (op === 'sum') globalVal = allItems.reduce((a, b) => a + b, 0)
  else if (op === 'mean') globalVal = Math.round((allItems.reduce((a, b) => a + b, 0) / (ROWS * COLS)) * 10) / 10
  else if (op === 'min') globalVal = Math.min(...allItems)
  else globalVal = Math.max(...allItems)

  return { axis0Vals, axis1Vals, globalVal }
}

const reductionData = computed(() => computeReductionValues(activeOp.value))

// Three.js instances
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animFrameId = 0
let floatingAxesGroup: THREE.Group | null = null
let phantomSlotsGroup: THREE.Group | null = null

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2(-999, -999)

const initialCameraPos = new THREE.Vector3(0.8, 0.9, 8.8)
const initialCameraTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

// Color palettes per row
const rowPalettes = [
  { bg: '#ffffff', text: '#1e40af', border: '#2563eb' }, // Row 0: Blue
  { bg: '#ffffff', text: '#7c3aed', border: '#8b5cf6' }, // Row 1: Purple
  { bg: '#ffffff', text: '#059669', border: '#10b981' }  // Row 2: Green
]
const palAggregated = { bg: '#fef3c7', text: '#9a3412', border: '#ea580c' } // Amber Output

interface MatrixNode {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  r: number
  c: number
  val: number
  pos0: THREE.Vector3
  posTarget: THREE.Vector3
  aggVal: number
  isRepresentative: boolean // the one cube that displays the reduction value when collapsed
}

let activeNodes: MatrixNode[] = []

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

  floatingAxesGroup = new THREE.Group()
  scene.add(floatingAxesGroup)

  phantomSlotsGroup = new THREE.Group()
  scene.add(phantomSlotsGroup)

  buildMatrixStructure()
  computeCollapseTargets()
  applyCollapseInterpolation(0)

  const animate = () => {
    animFrameId = requestAnimationFrame(animate)

    if (isPlaying.value) {
      // 1.8s smooth transition (0.01 per frame)
      progress.value += 0.01
      if (progress.value >= 1) {
        progress.value = 1
        isPlaying.value = false
      }
      applyCollapseInterpolation(progress.value)
    }

    if (controls) controls.update()
    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  animate()
  emitInspection()
}

// Build 3x4 Matrix structure in vertical X-Y plane
const buildMatrixStructure = () => {
  if (!scene) return

  activeNodes.forEach((node) => {
    scene?.remove(node.mesh)
    node.mesh.geometry.dispose()
    ;(node.mesh.material as THREE.Material).dispose()
    node.wireframe.geometry.dispose()
  })
  activeNodes = []

  const cubeGeo = new THREE.BoxGeometry(0.95, 0.95, 0.95)
  const wireGeo = new THREE.EdgesGeometry(cubeGeo)
  const spacing = 1.32

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const val = matrixData[r][c]
      const pal = rowPalettes[r]
      const tex = createNumberTexture(val, pal.bg, pal.text, pal.border)

      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: 1
      })
      const mesh = new THREE.Mesh(cubeGeo, mat)
      const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(pal.border), linewidth: 1.5 })
      const wireframe = new THREE.LineSegments(wireGeo, wireMat)
      mesh.add(wireframe)

      const x0 = (c - 1.5) * spacing
      const y0 = -(r - 1.0) * spacing
      const z0 = 0
      mesh.position.set(x0, y0, z0)
      mesh.userData = { r, c, val }
      scene.add(mesh)

      activeNodes.push({
        mesh,
        wireframe,
        r,
        c,
        val,
        pos0: new THREE.Vector3(x0, y0, z0),
        posTarget: new THREE.Vector3(x0, y0, z0),
        aggVal: val,
        isRepresentative: false
      })
    }
  }

  updateFloatingAxes()
}

// Compute Target Coordinates for Reduction
const computeCollapseTargets = () => {
  const { axis0Vals, axis1Vals, globalVal } = reductionData.value
  const axis = activeAxis.value

  if (axis === null) {
    // Global Reduction: all cubes merge into center (0, 0, 0)
    activeNodes.forEach((node) => {
      node.posTarget.set(0, 0, 0)
      node.aggVal = globalVal
      node.isRepresentative = node.r === 1 && node.c === 1
    })
  } else if (axis === 0) {
    // Axis 0 Reduction: collapse rows vertically -> preserves columns along X
    // target Y is 0 (or row 1's position: y = 0)
    activeNodes.forEach((node) => {
      node.posTarget.set(node.pos0.x, 0, 0)
      node.aggVal = axis0Vals[node.c]
      node.isRepresentative = node.r === 1
    })
  } else if (axis === 1) {
    // Axis 1 Reduction: collapse cols horizontally -> preserves rows along Y
    // target X is 0 (or center of columns)
    activeNodes.forEach((node) => {
      node.posTarget.set(0, node.pos0.y, 0)
      node.aggVal = axis1Vals[node.r]
      node.isRepresentative = node.c === 1
    })
  }

  updatePhantomSlots()
}

// Update Phantom wireframes for keepdims=True representation
const updatePhantomSlots = () => {
  if (!phantomSlotsGroup) return

  while (phantomSlotsGroup.children.length > 0) {
    const child = phantomSlotsGroup.children[0]
    phantomSlotsGroup.remove(child)
    if (child instanceof THREE.LineSegments) {
      child.geometry.dispose()
      ;(child.material as THREE.Material).dispose()
    }
  }

  if (!keepdims.value || progress.value < 0.2) return

  const spacing = 1.32
  const cubeGeo = new THREE.BoxGeometry(0.95, 0.95, 0.95)
  const wireGeo = new THREE.EdgesGeometry(cubeGeo)
  const wireMat = new THREE.LineDashedMaterial({
    color: isDark.value ? 0x94a3b8 : 0x64748b,
    dashSize: 0.2,
    gapSize: 0.1,
    linewidth: 1.5,
    transparent: true,
    opacity: 0.6
  })

  // In keepdims=True mode, display phantom slots representing the preserved dimension of length 1
  if (activeAxis.value === 0) {
    // Shape is (1, 4): show phantom slot outline around the uncollapsed outer rows
    for (let r of [0, 2]) {
      for (let c = 0; c < COLS; c++) {
        const line = new THREE.LineSegments(wireGeo, wireMat)
        line.computeLineDistances()
        line.position.set((c - 1.5) * spacing, -(r - 1.0) * spacing, 0)
        phantomSlotsGroup.add(line)
      }
    }
  } else if (activeAxis.value === 1) {
    // Shape is (3, 1): show phantom slot outline around uncollapsed outer columns
    for (let r = 0; r < ROWS; r++) {
      for (let c of [0, 2, 3]) {
        const line = new THREE.LineSegments(wireGeo, wireMat)
        line.computeLineDistances()
        line.position.set((c - 1.5) * spacing, -(r - 1.0) * spacing, 0)
        phantomSlotsGroup.add(line)
      }
    }
  }
}

// Interpolation
const applyCollapseInterpolation = (t: number) => {
  const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

  activeNodes.forEach((node) => {
    node.mesh.position.lerpVectors(node.pos0, node.posTarget, eased)

    const mat = node.mesh.material as THREE.MeshStandardMaterial
    const wire = node.wireframe.material as THREE.LineBasicMaterial

    if (t >= 0.75) {
      if (node.isRepresentative) {
        // Representative shows aggregated value in amber
        const tex = createNumberTexture(node.aggVal, palAggregated.bg, palAggregated.text, palAggregated.border)
        mat.map = tex
        mat.needsUpdate = true
        mat.opacity = 1
        wire.color.set(new THREE.Color(palAggregated.border))
        wire.opacity = 1
        node.mesh.scale.set(1.12, 1.12, 1.12)
      } else {
        // Collapsed non-representative cubes fade out
        mat.opacity = Math.max(0, (1 - t) * 4)
        wire.opacity = Math.max(0, (1 - t) * 4)
        node.mesh.scale.set(0.2, 0.2, 0.2)
      }
    } else {
      // Reverting / in-progress
      const pal = rowPalettes[node.r]
      const tex = createNumberTexture(node.val, pal.bg, pal.text, pal.border)
      mat.map = tex
      mat.needsUpdate = true
      mat.opacity = 1
      wire.color.set(new THREE.Color(pal.border))
      wire.opacity = 1
      node.mesh.scale.set(1, 1, 1)
    }
  })

  updatePhantomSlots()
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
    const pos = node.pos0
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

  // X Axis (Columns)
  const arrowX = createBoldArrow(new THREE.Vector3(1, 0, 0), lenX, 0xef4444, 'axis 1 (Cols)', 0.055, 0.16, 0.35)
  floatingAxesGroup.add(arrowX)

  // Y Axis (Rows)
  const arrowY = createBoldArrow(new THREE.Vector3(0, 1, 0), lenY, 0x10b981, 'axis 0 (Rows)', 0.055, 0.16, 0.35)
  floatingAxesGroup.add(arrowY)
}

// User Actions
const setReductionAxis = (axis: AxisSelection) => {
  activeAxis.value = axis
  progress.value = 0
  isPlaying.value = false
  computeCollapseTargets()
  applyCollapseInterpolation(0)
  emitInspection()
}

const setOperator = (op: OperatorKey) => {
  activeOp.value = op
  computeCollapseTargets()
  applyCollapseInterpolation(progress.value)
  emitInspection()
}

const toggleKeepdims = () => {
  keepdims.value = !keepdims.value
  updatePhantomSlots()
  emitInspection()
}

const togglePlay = () => {
  if (progress.value >= 1) progress.value = 0
  isPlaying.value = !isPlaying.value
}

const stepAnimation = () => {
  isPlaying.value = false
  progress.value = Math.min(1, Math.round((progress.value + 0.25) * 100) / 100)
  applyCollapseInterpolation(progress.value)
  emitInspection()
}

const resetSimulation = () => {
  isPlaying.value = false
  progress.value = 0
  computeCollapseTargets()
  applyCollapseInterpolation(0)
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
  const intersects = raycaster.intersectObjects(activeNodes.map((n) => n.mesh), false)

  if (intersects.length > 0) {
    const hitMesh = intersects[0].object as THREE.Mesh
    const data = hitMesh.userData
    if (data) {
      selectedCell.value = {
        r: data.r,
        c: data.c,
        val: data.val
      }
      emitInspection()
    }
  }
}

// Output shape display helper
const outputShapeText = computed(() => {
  if (activeAxis.value === null) {
    return keepdims.value ? '(1, 1)' : '()'
  }
  if (activeAxis.value === 0) {
    return keepdims.value ? '(1, 4)' : '(4,)'
  }
  return keepdims.value ? '(3, 1)' : '(3,)'
})

const emitInspection = () => {
  const cell = selectedCell.value
  const { axis0Vals, axis1Vals, globalVal } = reductionData.value

  let targetSummary = ''
  if (activeAxis.value === null) {
    targetSummary = `Global ${activeOp.value} = ${globalVal}`
  } else if (activeAxis.value === 0) {
    targetSummary = `Col ${cell.c} ${activeOp.value} = ${axis0Vals[cell.c]}`
  } else {
    targetSummary = `Row ${cell.r} ${activeOp.value} = ${axis1Vals[cell.r]}`
  }

  emit('inspect', {
    title: `Reduction Inspection: Element X[${cell.r}, ${cell.c}] = ${cell.val}`,
    details: {
      'Source Matrix Coordinate': `X[${cell.r}, ${cell.c}] = ${cell.val}`,
      'Active Reduction Axis': activeAxis.value === null ? 'None (Global scalar aggregation)' : `Axis ${activeAxis.value}`,
      'Operator Function': `np.${activeOp.value}(X, axis=${activeAxis.value}, keepdims=${keepdims.value})`,
      'Output Result Shape': outputShapeText.value,
      'keepdims Invariant': keepdims.value ? 'Preserves 2D rank (Dimension length = 1)' : 'Drops aggregated axis (Rank reduced)',
      'Aggregated Value': targetSummary,
      'Broadcasting Compatibility': keepdims.value ? 'Safe for (3, 4) - output without reshape' : 'Requires trailing axis alignment'
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
    updatePhantomSlots()
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

  activeNodes.forEach((node) => {
    node.mesh.geometry.dispose()
    ;(node.mesh.material as THREE.Material).dispose()
    node.wireframe.geometry.dispose()
  })
  activeNodes = []

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
        <!-- Top Status Bar: Reduction Axis & keepdims Switcher -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <!-- Reduction Axis Selector -->
          <div class="flex items-center gap-1.5 bg-card/90 backdrop-blur-md p-1 rounded-md border border-line shadow-xs pointer-events-auto text-xs font-mono">
            <span class="text-[10px] text-muted font-bold px-1 uppercase">Axis:</span>
            <button
              type="button"
              @click="setReductionAxis(0)"
              class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="activeAxis === 0 ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="np.sum(X, axis=0): Collapses rows downward into row vector"
            >
              <ArrowDown class="w-3 h-3" />
              <span>axis=0 (Rows)</span>
            </button>
            <button
              type="button"
              @click="setReductionAxis(1)"
              class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="activeAxis === 1 ? 'bg-brand-blue text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="np.sum(X, axis=1): Collapses columns horizontally into col vector"
            >
              <ArrowRight class="w-3 h-3" />
              <span>axis=1 (Cols)</span>
            </button>
            <button
              type="button"
              @click="setReductionAxis(null)"
              class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="activeAxis === null ? 'bg-brand-amber text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="np.sum(X, axis=None): Collapses entire matrix into scalar"
            >
              <span>Global (None)</span>
            </button>
          </div>

          <!-- keepdims Toggle Switch -->
          <div class="flex items-center gap-2 pointer-events-auto text-xs font-mono">
            <button
              type="button"
              @click="toggleKeepdims"
              class="px-2.5 py-1 rounded-md border transition-all flex items-center gap-1.5 shadow-xs font-bold"
              :class="keepdims
                ? 'bg-purple-500/15 border-purple-500/40 text-purple-600 dark:text-purple-400'
                : 'bg-card/90 border-line text-muted hover:text-ink'"
              title="keepdims preserves reduced axes as dimensions of size 1"
            >
              <ShieldCheck class="w-3.5 h-3.5" />
              <span>keepdims={{ keepdims }}</span>
            </button>

            <!-- Result Shape Badge -->
            <span class="px-2.5 py-1 rounded-md bg-card/90 backdrop-blur-md border border-line shadow-xs font-bold text-ink">
              Shape: {{ outputShapeText }}
            </span>
          </div>
        </div>

        <!-- Bottom Overlay: Interactive Hint -->
        <div class="flex items-center justify-between text-[0.68rem] text-muted">
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full" :class="activeAxis === 0 ? 'bg-emerald-500' : activeAxis === 1 ? 'bg-brand-blue' : 'bg-brand-amber'" />
            <span v-if="activeAxis === 0">
              Axis 0 Reduction: {{ keepdims ? '(3, 4) → (1, 4) [phantom rows visible]' : '(3, 4) → (4,) [row axis dropped]' }}
            </span>
            <span v-else-if="activeAxis === 1">
              Axis 1 Reduction: {{ keepdims ? '(3, 4) → (3, 1) [phantom cols visible]' : '(3, 4) → (3,) [col axis dropped]' }}
            </span>
            <span v-else>
              Global Reduction: {{ keepdims ? '(3, 4) → (1, 1)' : '(3, 4) → () scalar' }}
            </span>
          </div>
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono hidden sm:block">
            Drag: Orbit 360° • Click: Inspect Element
          </div>
        </div>
      </div>
    </div>

    <!-- Toolbar: Reduction Operators & Controls -->
    <div class="bg-card border border-line rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
      <!-- Operator Selection Pills -->
      <div class="flex items-center gap-1.5 bg-card-subtle p-1 rounded-md border border-line overflow-x-auto text-xs font-mono">
        <button
          type="button"
          @click="setOperator('sum')"
          class="px-2.5 py-1 rounded font-medium transition-colors"
          :class="activeOp === 'sum' ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          Sum (∑)
        </button>
        <button
          type="button"
          @click="setOperator('mean')"
          class="px-2.5 py-1 rounded font-medium transition-colors"
          :class="activeOp === 'mean' ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          Mean (μ)
        </button>
        <button
          type="button"
          @click="setOperator('min')"
          class="px-2.5 py-1 rounded font-medium transition-colors"
          :class="activeOp === 'min' ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          Min (↓)
        </button>
        <button
          type="button"
          @click="setOperator('max')"
          class="px-2.5 py-1 rounded font-medium transition-colors"
          :class="activeOp === 'max' ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          Max (↑)
        </button>
      </div>

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
          <span>{{ isPlaying ? 'Pause' : 'Collapse' }}</span>
        </button>

        <button
          type="button"
          @click="stepAnimation"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono font-medium text-ink transition-colors"
          title="Step collapse motion"
        >
          <StepForward class="w-3.5 h-3.5 text-muted" />
          <span>Step</span>
        </button>

        <button
          type="button"
          @click="resetSimulation"
          class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono text-muted hover:text-ink transition-colors"
          title="Reset to full matrix"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>

        <!-- Progress Scrub Slider -->
        <div class="flex items-center gap-1.5 text-xs font-mono text-muted pl-1">
          <input
            id="collapseProgress"
            type="range"
            min="0"
            max="1"
            step="0.01"
            v-model.number="progress"
            @input="isPlaying = false; applyCollapseInterpolation(progress)"
            class="w-20 accent-brand-blue cursor-pointer"
          />
          <span class="font-bold text-brand-blue w-8 text-right">{{ Math.round(progress * 100) }}%</span>
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
        <div class="text-[0.68rem] uppercase text-muted font-semibold">NumPy Reduction</div>
        <div class="font-bold text-brand-blue truncate">
          np.{{ activeOp }}(X, axis={{ activeAxis !== null ? activeAxis : 'None' }})
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Shape Transition</div>
        <div class="font-bold text-brand-purple truncate">
          (3, 4) ➔ {{ outputShapeText }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Dimensional Invariant</div>
        <div class="font-bold text-ink truncate">
          {{ keepdims ? 'Dimension preserved as size 1' : 'Aggregated dimension dropped' }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Broadcasting Safety</div>
        <div class="font-bold text-brand-green truncate" title="keepdims ensures broadcast alignment without manual reshape">
          {{ keepdims ? 'Alignment Guaranteed ✓' : 'Requires Alignment' }}
        </div>
      </div>
    </div>
  </div>
</template>

