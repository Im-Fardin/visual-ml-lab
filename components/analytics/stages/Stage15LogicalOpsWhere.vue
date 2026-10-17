<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Play, Pause, StepForward, RotateCcw, GitBranch, CheckCircle2, ShieldCheck, Zap, ArrowRight } from 'lucide-vue-next'
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

// 3x4 Matrix Dimensions
const ROWS = 3
const COLS = 4

// Array A (Blue primary signal)
const matrixA = [
  [15, 85, 40, 92],
  [74, 10, 65, 33],
  [58, 22, 88, 47]
]

// Array B (Amber fallback / zeros)
const matrixB = [
  [0, 0, 0, 0],
  [0, 0, 0, 0],
  [0, 0, 0, 0]
]

// Logical Condition Selection
type ConditionType = 'and' | 'or' | 'not'
const activeCondition = ref<ConditionType>('and')

// Animation progress: 0 = source arrays with multiplexer gate, 1 = assembled output matrix
const progress = ref(0)
const isPlaying = ref(false)
const selectedCell = ref<{ r: number; c: number; valA: number; valB: number; isTrue: boolean; outVal: number } | null>(null)

// Evaluate condition grid
const evaluatedCondition = computed(() => {
  const condMatrix: boolean[][] = []
  const outMatrix: number[][] = []
  let trueCount = 0

  for (let r = 0; r < ROWS; r++) {
    const condRow: boolean[] = []
    const outRow: number[] = []
    for (let c = 0; c < COLS; c++) {
      const a = matrixA[r][c]
      const b = matrixB[r][c]
      let isTrue = false

      if (activeCondition.value === 'and') {
        // (A > 20) & (A < 80)
        isTrue = a > 20 && a < 80
      } else if (activeCondition.value === 'or') {
        // (A < 25) | (A > 75)
        isTrue = a < 25 || a > 75
      } else {
        // ~(A > 50) => A <= 50
        isTrue = !(a > 50)
      }

      if (isTrue) trueCount++
      condRow.push(isTrue)
      outRow.push(isTrue ? a : b)
    }
    condMatrix.push(condRow)
    outMatrix.push(outRow)
  }

  return { condMatrix, outMatrix, trueCount }
})

// Condition metadata
const conditionMetadata = computed(() => {
  switch (activeCondition.value) {
    case 'and':
      return {
        label: 'AND (&)',
        expr: '(A > 20) & (A < 80)',
        fullCall: 'np.where((A > 20) & (A < 80), A, 0)',
        desc: 'In-Range filter: Values strictly between 20 and 80 are kept from A; others routed to 0.'
      }
    case 'or':
      return {
        label: 'OR (|)',
        expr: '(A < 25) | (A > 75)',
        fullCall: 'np.where((A < 25) | (A > 75), A, 0)',
        desc: 'Tails / Outliers filter: Extremes (<25 or >75) are kept from A; central values routed to 0.'
      }
    case 'not':
      return {
        label: 'NOT (~)',
        expr: '~(A > 50)',
        fullCall: 'np.where(~(A > 50), A, 0)',
        desc: 'Inversion filter: Values <= 50 are kept from A; higher values routed to 0.'
      }
  }
})

// Three.js instances
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animFrameId = 0
let floatingAxesGroup: THREE.Group | null = null
let labelSpritesGroup: THREE.Group | null = null
let connectorLinesGroup: THREE.Group | null = null

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2(-999, -999)

const initialCameraPos = new THREE.Vector3(0.0, 1.3, 12.5)
const initialCameraTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

// Color palettes
const palA = { bg: '#ffffff', text: '#1e40af', border: '#2563eb' } // Blue Array A
const palB = { bg: '#ffffff', text: '#64748b', border: '#94a3b8' } // Slate Array B
const palPickedA = { bg: '#ecfdf5', text: '#065f46', border: '#10b981' } // Green Picked A
const palPickedB = { bg: '#fef3c7', text: '#9a3412', border: '#ea580c' } // Amber Picked B

interface NodeItem {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  source: 'A' | 'B' | 'OUT'
  r: number
  c: number
  val: number
  pos0: THREE.Vector3
  posTarget: THREE.Vector3
  isChosen: boolean
}

let activeNodes: NodeItem[] = []
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
  const gridHelper = new THREE.GridHelper(26, 26, isDark.value ? 0x334155 : 0xcbd5e1, isDark.value ? 0x1e293b : 0xe2ded4)
  gridHelper.position.y = -2.8
  scene.add(gridHelper)

  floatingAxesGroup = new THREE.Group()
  scene.add(floatingAxesGroup)

  labelSpritesGroup = new THREE.Group()
  scene.add(labelSpritesGroup)

  connectorLinesGroup = new THREE.Group()
  scene.add(connectorLinesGroup)

  buildWhereScene()

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
const buildWhereScene = () => {
  if (!scene) return

  // Dispose previous
  activeNodes.forEach((n) => {
    scene?.remove(n.mesh)
    n.mesh.geometry.dispose()
    ;(n.mesh.material as THREE.Material).dispose()
    n.wireframe.geometry.dispose()
  })
  activeNodes = []
  allMeshes = []

  // Dispose labels
  while (labelSpritesGroup && labelSpritesGroup.children.length > 0) {
    const child = labelSpritesGroup.children[0]
    labelSpritesGroup.remove(child)
  }

  // Dispose connectors
  while (connectorLinesGroup && connectorLinesGroup.children.length > 0) {
    const child = connectorLinesGroup.children[0]
    connectorLinesGroup.remove(child)
  }

  const spacing = 1.25
  const cubeGeo = new THREE.BoxGeometry(0.92, 0.92, 0.92)
  const wireGeo = new THREE.EdgesGeometry(cubeGeo)

  const { condMatrix } = evaluatedCondition.value

  // Non-overlapping spatial layout:
  // Array A (Left): X = -4.8  (Columns from -6.675 to -2.925)
  // Output Grid (Center): X = 0 (Columns from -1.875 to +1.875)
  // Array B (Right): X = +4.8 (Columns from +2.925 to +6.675)
  // Generous 1.05 unit visual gutter prevents any spatial collision or overlap!
  const offsetA_X = -4.8
  const offsetB_X = +4.8
  const offsetOut_X = 0

  // 1. Array A (Left)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const val = matrixA[r][c]
      const isChosen = condMatrix[r][c]
      const tex = createNumberTexture(val, palA.bg, palA.text, palA.border)
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: 1
      })
      const mesh = new THREE.Mesh(cubeGeo, mat)
      const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(palA.border), linewidth: 1.5 })
      const wireframe = new THREE.LineSegments(wireGeo, wireMat)
      mesh.add(wireframe)

      const x0 = offsetA_X + (c - 1.5) * spacing
      const y0 = -(r - 1.0) * spacing
      const z0 = 0

      // Target pos in center output matrix
      const xTarget = offsetOut_X + (c - 1.5) * spacing
      const yTarget = y0

      mesh.position.set(x0, y0, z0)
      mesh.userData = { source: 'A', r, c, val, isChosen }
      scene.add(mesh)

      activeNodes.push({
        mesh,
        wireframe,
        source: 'A',
        r,
        c,
        val,
        pos0: new THREE.Vector3(x0, y0, z0),
        posTarget: new THREE.Vector3(xTarget, yTarget, 0),
        isChosen
      })
      allMeshes.push(mesh)
    }
  }

  // 2. Array B (Right)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const val = matrixB[r][c]
      const isChosen = !condMatrix[r][c]
      const tex = createNumberTexture(val, palB.bg, palB.text, palB.border)
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: 1
      })
      const mesh = new THREE.Mesh(cubeGeo, mat)
      const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(palB.border), linewidth: 1.5 })
      const wireframe = new THREE.LineSegments(wireGeo, wireMat)
      mesh.add(wireframe)

      const x0 = offsetB_X + (c - 1.5) * spacing
      const y0 = -(r - 1.0) * spacing
      const z0 = 0

      const xTarget = offsetOut_X + (c - 1.5) * spacing
      const yTarget = y0

      mesh.position.set(x0, y0, z0)
      mesh.userData = { source: 'B', r, c, val, isChosen }
      scene.add(mesh)

      activeNodes.push({
        mesh,
        wireframe,
        source: 'B',
        r,
        c,
        val,
        pos0: new THREE.Vector3(x0, y0, z0),
        posTarget: new THREE.Vector3(xTarget, yTarget, 0),
        isChosen
      })
      allMeshes.push(mesh)
    }
  }

  // 3. Text Labels perfectly centered above each subgrid
  if (labelSpritesGroup) {
    const labelA = createTextSprite('Array A (True Source)', isDark.value ? '#93c5fd' : '#1d4ed8', 34)
    labelA.position.set(offsetA_X, 2.3, 0)
    labelA.scale.set(3.2, 0.8, 1)
    labelSpritesGroup.add(labelA)

    const labelOut = createTextSprite('np.where Routing Grid', isDark.value ? '#fdba74' : '#c2410c', 34)
    labelOut.position.set(offsetOut_X, 2.3, 0)
    labelOut.scale.set(3.2, 0.8, 1)
    labelSpritesGroup.add(labelOut)

    const labelB = createTextSprite('Array B = 0 (False Source)', isDark.value ? '#cbd5e1' : '#475569', 34)
    labelB.position.set(offsetB_X, 2.3, 0)
    labelB.scale.set(3.2, 0.8, 1)
    labelSpritesGroup.add(labelB)
  }

  updateFloatingAxes()
  applyProgressInterpolation(progress.value)
}

// Progress interpolation: Chosen cells glide to center output grid; unchosen cleanly dim back in place
const applyProgressInterpolation = (t: number) => {
  const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

  activeNodes.forEach((node) => {
    const mat = node.mesh.material as THREE.MeshStandardMaterial
    const wire = node.wireframe.material as THREE.LineBasicMaterial

    if (node.isChosen) {
      // Slides smoothly from pos0 to posTarget in the center
      node.mesh.position.lerpVectors(node.pos0, node.posTarget, eased)

      if (t >= 0.75) {
        // Assembled into output matrix
        const pal = node.source === 'A' ? palPickedA : palPickedB
        const tex = createNumberTexture(node.val, pal.bg, pal.text, pal.border)
        mat.map = tex
        mat.needsUpdate = true
        wire.color.set(new THREE.Color(pal.border))
        node.mesh.scale.set(1.04, 1.04, 1.04)
      } else {
        const pal = node.source === 'A' ? palA : palB
        const tex = createNumberTexture(node.val, pal.bg, pal.text, pal.border)
        mat.map = tex
        mat.needsUpdate = true
        wire.color.set(new THREE.Color(pal.border))
        node.mesh.scale.set(1, 1, 1)
      }
      mat.opacity = 1
      wire.opacity = 1
      node.mesh.visible = true
    } else {
      // Unchosen cubes stay securely at their source position (zero spatial overlap)
      // and dim cleanly to emphasize the chosen routes
      node.mesh.position.copy(node.pos0)
      const fade = Math.max(0.12, 1 - t * 0.88)
      mat.opacity = fade
      wire.opacity = fade
      const scaleDim = Math.max(0.9, 1 - t * 0.1)
      node.mesh.scale.set(scaleDim, scaleDim, scaleDim)
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
    const pos = node.pos0
    minX = Math.min(minX, pos.x)
    maxX = Math.max(maxX, pos.x)
    minY = Math.min(minY, pos.y)
    maxY = Math.max(maxY, pos.y)
    minZ = Math.min(minZ, pos.z)
    maxZ = Math.max(maxZ, pos.z)
  }

  const halfW = 0.46
  const clearance = 0.38

  const originX = minX - halfW - clearance
  const originY = minY - halfW - clearance
  const originZ = minZ - halfW - clearance

  floatingAxesGroup.position.set(originX, originY, originZ)

  const marginExtra = 0.65
  const lenX = Math.max(2.2, maxX - minX + halfW * 2 + clearance + marginExtra)
  const lenY = Math.max(2.2, maxY - minY + halfW * 2 + clearance + marginExtra)

  // X Axis (Cols)
  const arrowX = createBoldArrow(new THREE.Vector3(1, 0, 0), lenX, 0xef4444, 'axis 1 (Cols)', 0.055, 0.16, 0.35)
  floatingAxesGroup.add(arrowX)

  // Y Axis (Rows)
  const arrowY = createBoldArrow(new THREE.Vector3(0, 1, 0), lenY, 0x10b981, 'axis 0 (Rows)', 0.055, 0.16, 0.35)
  floatingAxesGroup.add(arrowY)
}

// User Actions
const setCondition = (cond: ConditionType) => {
  activeCondition.value = cond
  progress.value = 0
  isPlaying.value = false
  buildWhereScene()
  emitInspection()
}

const togglePlay = () => {
  if (progress.value >= 1) {
    progress.value = 0
    applyProgressInterpolation(0)
  }
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
  emitInspection()
}

const resetSimulation = () => {
  isPlaying.value = false
  progress.value = 0
  buildWhereScene()
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
      const r = data.r
      const c = data.c
      const isTrue = evaluatedCondition.value.condMatrix[r][c]
      const outVal = isTrue ? matrixA[r][c] : matrixB[r][c]

      selectedCell.value = {
        r,
        c,
        valA: matrixA[r][c],
        valB: matrixB[r][c],
        isTrue,
        outVal
      }
      emitInspection()
    }
  }
}

const emitInspection = () => {
  const meta = conditionMetadata.value
  const { trueCount } = evaluatedCondition.value
  const cell = selectedCell.value

  const details: Record<string, any> = {
    'Active Expression': meta.fullCall,
    'Condition Logic': meta.desc,
    'Truth Ratio': `${trueCount} True (from A) | ${12 - trueCount} False (from B)`,
    'Shape Invariant': '(3, 4) preserved exactly! (Shape is never flattened)',
    'Branchless SIMD': 'Hardware uses SIMD blendv instruction (no branch mispredictions)',
    'Memory Policy': 'Allocates new array C of shape (3, 4) with evaluated elements'
  }

  if (cell) {
    details['Inspected Cell Coordinate'] = `Position [r=${cell.r}, c=${cell.c}]`
    details['Condition Evaluation'] = `${meta.expr} on A[${cell.r}, ${cell.c}]=${cell.valA} → ${cell.isTrue ? 'True' : 'False'}`
    details['Selected Route'] = cell.isTrue
      ? `TRUE → Routed from Array A (value: ${cell.valA})`
      : `FALSE → Routed from Array B (value: ${cell.valB})`
  }

  emit('inspect', {
    title: `np.where: ${meta.expr}`,
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
    buildWhereScene()
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
        <!-- Top Status Bar: Logical Condition Switcher & Expression Badge -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <!-- Logical Condition Toggle -->
          <div class="flex items-center gap-1.5 bg-card/90 backdrop-blur-md p-1 rounded-md border border-line shadow-xs pointer-events-auto text-xs font-mono">
            <button
              type="button"
              @click="setCondition('and')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="activeCondition === 'and' ? 'bg-brand-blue text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="AND: (A > 20) & (A < 80)"
            >
              AND: (20 &lt; A &lt; 80)
            </button>
            <button
              type="button"
              @click="setCondition('or')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="activeCondition === 'or' ? 'bg-brand-purple text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="OR: (A < 25) | (A > 75)"
            >
              OR: (A &lt; 25 | A &gt; 75)
            </button>
            <button
              type="button"
              @click="setCondition('not')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="activeCondition === 'not' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="NOT: ~(A > 50)"
            >
              NOT: ~(A &gt; 50)
            </button>
          </div>

          <!-- Formula Badge -->
          <div class="flex items-center gap-2 pointer-events-auto text-xs font-mono">
            <span class="px-2.5 py-1 rounded-md bg-card/90 backdrop-blur-md border border-line shadow-xs font-bold text-ink">
              {{ conditionMetadata.expr }}
            </span>
          </div>
        </div>

        <!-- Bottom Overlay: Active Instruction Note -->
        <div class="flex items-center justify-between text-[0.68rem] text-muted">
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-brand-blue" />
            <span>
              {{ conditionMetadata.desc }}
            </span>
          </div>
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono hidden sm:block">
            Drag: Orbit 360° • Click: Inspect Multiplexer Cell
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
          <span>{{ isPlaying ? 'Pause' : 'Multiplex (np.where)' }}</span>
        </button>

        <button
          type="button"
          @click="stepNext"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono font-medium text-ink transition-colors"
          title="Step through multiplexing"
        >
          <StepForward class="w-3.5 h-3.5 text-muted" />
          <span>Step (+25%)</span>
        </button>

        <button
          type="button"
          @click="resetSimulation"
          class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono text-muted hover:text-ink transition-colors"
          title="Reset to initial state"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>

        <!-- Progress Slider -->
        <div class="flex items-center gap-1.5 text-xs font-mono text-muted pl-1">
          <input
            id="multiplexProgress"
            type="range"
            min="0"
            max="1"
            step="0.01"
            v-model.number="progress"
            @input="isPlaying = false; applyProgressInterpolation(progress); emitInspection()"
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

      <!-- Multiplexing Outcome Counter -->
      <div class="flex items-center gap-2 text-xs font-mono">
        <span class="text-muted">Routing Outcome:</span>
        <span class="font-bold text-emerald-600 dark:text-emerald-400">{{ evaluatedCondition.trueCount }} from A</span>
        <span class="text-muted">|</span>
        <span class="font-bold text-brand-amber">{{ 12 - evaluatedCondition.trueCount }} from B</span>
      </div>
    </div>

    <!-- Fluid Telemetry HUD Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Active Syntax</div>
        <div class="font-bold text-brand-blue truncate" :title="conditionMetadata.fullCall">
          {{ conditionMetadata.fullCall }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Truth Ratio</div>
        <div class="font-bold text-brand-purple truncate">
          {{ evaluatedCondition.trueCount }} True / {{ 12 - evaluatedCondition.trueCount }} False
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Output Topology</div>
        <div class="font-bold text-emerald-600 dark:text-emerald-400 truncate">
          (3, 4) Preserved Exactly ✓
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Execution Model</div>
        <div class="font-bold text-brand-green truncate" title="Branchless SIMD vector blend">
          Branchless SIMD Blend ✓
        </div>
      </div>
    </div>
  </div>
</template>

