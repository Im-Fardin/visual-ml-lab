<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Play, Pause, StepForward, RotateCcw, AlertTriangle, CheckCircle2, Copy, Zap, ArrowRight, Layers } from 'lucide-vue-next'
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

// Preset Selection
type PresetKey = 'matrix_row' | 'col_row' | 'incompatible'
const activePreset = ref<PresetKey>('matrix_row')

// View Mode: 'operands' (Inputs with Ghost Clones) vs 'result' (Result Matrix C)
type ViewMode = 'operands' | 'result'
const viewMode = ref<ViewMode>('operands')

// Animation & Playback
const progress = ref(0) // 0 = original arrays, 0.5 = ghost clones expanded, 1 = computed
const isPlaying = ref(false)
const selectedCell = ref<{ arrayName: string; r: number; c: number; val: number } | null>(null)

// Base Arrays Data
const matrixA_3x4 = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 1, 2, 3]
]

const vectorB_1x4 = [
  [10, 20, 30, 40]
]

const vectorA_3x1 = [
  [10],
  [20],
  [30]
]

const vectorB_incomp_3 = [
  [10, 20, 30] // (3,)
]

// Dimensions and configuration based on active preset
const presetConfig = computed(() => {
  if (activePreset.value === 'matrix_row') {
    return {
      shapeA: [3, 4] as [number, number],
      shapeB: [1, 4] as [number, number],
      outShape: [3, 4] as [number, number],
      isCompatible: true,
      dataA: matrixA_3x4,
      dataB: vectorB_1x4,
      expandColsA: 1,
      expandRowsA: 1,
      expandColsB: 1,
      expandRowsB: 3,
      stridesA: '(32, 8) bytes',
      stridesB: '(0, 8) bytes [Stride 0!]',
      ruleDesc: 'Trailing dimensions match (4 == 4). Leading dimension 1 expands to 3 without copying memory.'
    }
  } else if (activePreset.value === 'col_row') {
    return {
      shapeA: [3, 1] as [number, number],
      shapeB: [1, 4] as [number, number],
      outShape: [3, 4] as [number, number],
      isCompatible: true,
      dataA: vectorA_3x1,
      dataB: vectorB_1x4,
      expandColsA: 4,
      expandRowsA: 1,
      expandColsB: 1,
      expandRowsB: 3,
      stridesA: '(8, 0) bytes [Col Stride 0!]',
      stridesB: '(0, 8) bytes [Row Stride 0!]',
      ruleDesc: 'Both arrays stretch: A expands columns (1 → 4) and B expands rows (1 → 3). Output is (3, 4).'
    }
  } else {
    return {
      shapeA: [3, 4] as [number, number],
      shapeB: [3] as unknown as [number, number],
      outShape: null,
      isCompatible: false,
      dataA: matrixA_3x4,
      dataB: vectorB_incomp_3,
      expandColsA: 1,
      expandRowsA: 1,
      expandColsB: 1,
      expandRowsB: 1,
      stridesA: '(32, 8) bytes',
      stridesB: '(8,) bytes',
      ruleDesc: 'ERROR: Trailing dimension 4 of A does not match trailing dimension 3 of B (4 ≠ 3, neither is 1)!'
    }
  }
})

// Compute Result Matrix (3x4)
const computedResultData = computed(() => {
  if (!presetConfig.value.isCompatible) return null
  const out: number[][] = []
  for (let r = 0; r < 3; r++) {
    const row: number[] = []
    for (let c = 0; c < 4; c++) {
      let valA = 0
      let valB = 0
      if (activePreset.value === 'matrix_row') {
        valA = matrixA_3x4[r][c]
        valB = vectorB_1x4[0][c]
      } else if (activePreset.value === 'col_row') {
        valA = vectorA_3x1[r][0]
        valB = vectorB_1x4[0][c]
      }
      row.push(valA + valB)
    }
    out.push(row)
  }
  return out
})

// Three.js instances
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animFrameId = 0
let floatingAxesGroup: THREE.Group | null = null
let labelSpritesGroup: THREE.Group | null = null
let ghostCubesGroup: THREE.Group | null = null
let connectorLinesGroup: THREE.Group | null = null

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2(-999, -999)

const initialCameraPos = new THREE.Vector3(0.0, 1.2, 10.8)
const initialCameraTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

// Color palettes
const palArrayA = { bg: '#ffffff', text: '#1e40af', border: '#2563eb' } // Blue A
const palArrayB = { bg: '#ffffff', text: '#7c3aed', border: '#8b5cf6' } // Purple B
const palGhost = { bg: '#f1f5f9', text: '#64748b', border: '#94a3b8' } // Ghost Clone
const palResult = { bg: '#fef3c7', text: '#9a3412', border: '#ea580c' } // Amber Output
const palError = { bg: '#fee2e2', text: '#991b1b', border: '#dc2626' } // Red Error

interface CubeItem {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  arrayKey: 'A' | 'B' | 'result'
  r: number
  c: number
  val: number
  isGhost: boolean
  basePos: THREE.Vector3
}

let activeCubes: CubeItem[] = []
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

  ghostCubesGroup = new THREE.Group()
  scene.add(ghostCubesGroup)

  connectorLinesGroup = new THREE.Group()
  scene.add(connectorLinesGroup)

  buildSceneForPreset()

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

// Build 3D meshes based on current preset and viewMode
const buildSceneForPreset = () => {
  if (!scene) return

  // Clean old active cubes
  activeCubes.forEach((c) => {
    scene?.remove(c.mesh)
    ghostCubesGroup?.remove(c.mesh)
    c.mesh.geometry.dispose()
    ;(c.mesh.material as THREE.Material).dispose()
    c.wireframe.geometry.dispose()
  })
  activeCubes = []
  allMeshes = []

  // Clean labels
  while (labelSpritesGroup && labelSpritesGroup.children.length > 0) {
    const child = labelSpritesGroup.children[0]
    labelSpritesGroup.remove(child)
  }

  // Clean connectors
  while (connectorLinesGroup && connectorLinesGroup.children.length > 0) {
    const child = connectorLinesGroup.children[0]
    connectorLinesGroup.remove(child)
  }

  const spacing = 1.25
  const cubeGeo = new THREE.BoxGeometry(0.92, 0.92, 0.92)
  const wireGeo = new THREE.EdgesGeometry(cubeGeo)

  if (viewMode.value === 'result' && presetConfig.value.isCompatible) {
    // Show Single Result Matrix C (3x4) in center
    const resData = computedResultData.value!
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const val = resData[r][c]
        const tex = createNumberTexture(val, palResult.bg, palResult.text, palResult.border)
        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.25,
          metalness: 0.1,
          transparent: true,
          opacity: 1
        })
        const mesh = new THREE.Mesh(cubeGeo, mat)
        const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(palResult.border), linewidth: 2 })
        const wireframe = new THREE.LineSegments(wireGeo, wireMat)
        mesh.add(wireframe)

        const x = (c - 1.5) * spacing
        const y = -(r - 1.0) * spacing
        const z = 0
        mesh.position.set(x, y, z)
        mesh.userData = { arrayKey: 'result', r, c, val }
        scene.add(mesh)

        const item: CubeItem = {
          mesh,
          wireframe,
          arrayKey: 'result',
          r,
          c,
          val,
          isGhost: false,
          basePos: new THREE.Vector3(x, y, z)
        }
        activeCubes.push(item)
        allMeshes.push(mesh)
      }
    }

    // Top Label for Result Matrix
    const titleSprite = createTextSprite('Result Matrix C = A + B : shape (3, 4)', isDark.value ? '#fdba74' : '#c2410c', 36)
    titleSprite.position.set(0, 2.3, 0)
    titleSprite.scale.set(4.5, 1.3, 1)
    labelSpritesGroup?.add(titleSprite)

    updateFloatingAxes()
    return
  }

  // --- Operands View: Array A on Left, Array B on Right ---
  const offsetA_X = -3.2
  const offsetB_X = +3.2

  // 1. Array A
  const dataA = presetConfig.value.dataA
  const rowsA = activePreset.value === 'col_row' ? 3 : 3
  const colsA = activePreset.value === 'col_row' ? 1 : 4

  for (let r = 0; r < rowsA; r++) {
    for (let c = 0; c < colsA; c++) {
      const val = dataA[r][c]
      const tex = createNumberTexture(val, palArrayA.bg, palArrayA.text, palArrayA.border)
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: 1
      })
      const mesh = new THREE.Mesh(cubeGeo, mat)
      const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(palArrayA.border), linewidth: 1.5 })
      const wireframe = new THREE.LineSegments(wireGeo, wireMat)
      mesh.add(wireframe)

      const colOffset = colsA === 1 ? 0 : (c - 1.5) * spacing
      const x = offsetA_X + colOffset
      const y = -(r - 1.0) * spacing
      const z = 0
      mesh.position.set(x, y, z)
      mesh.userData = { arrayKey: 'A', r, c, val }
      scene.add(mesh)

      const item: CubeItem = {
        mesh,
        wireframe,
        arrayKey: 'A',
        r,
        c,
        val,
        isGhost: false,
        basePos: new THREE.Vector3(x, y, z)
      }
      activeCubes.push(item)
      allMeshes.push(mesh)
    }
  }

  // If A is (3, 1) in Preset 2, spawn 3 ghost columns (c = 1, 2, 3)
  if (activePreset.value === 'col_row') {
    for (let r = 0; r < 3; r++) {
      for (let c = 1; c < 4; c++) {
        const val = dataA[r][0]
        const tex = createNumberTexture(val, palGhost.bg, palGhost.text, palGhost.border)
        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.5,
          metalness: 0.05,
          transparent: true,
          opacity: 0
        })
        const mesh = new THREE.Mesh(cubeGeo, mat)
        const wireMat = new THREE.LineBasicMaterial({
          color: new THREE.Color(palGhost.border),
          linewidth: 1.5,
          transparent: true,
          opacity: 0
        })
        const wireframe = new THREE.LineSegments(wireGeo, wireMat)
        mesh.add(wireframe)

        const x = offsetA_X + (c - 1.5) * spacing
        const y = -(r - 1.0) * spacing
        const z = 0
        mesh.position.set(x, y, z)
        mesh.userData = { arrayKey: 'A', r, c, val, isGhost: true }
        ghostCubesGroup?.add(mesh)

        const item: CubeItem = {
          mesh,
          wireframe,
          arrayKey: 'A',
          r,
          c,
          val,
          isGhost: true,
          basePos: new THREE.Vector3(x, y, z)
        }
        activeCubes.push(item)
        allMeshes.push(mesh)
      }
    }
  }

  // 2. Array B
  if (activePreset.value === 'incompatible') {
    // Array B is (3,) with 3 cubes horizontally
    const dataB = vectorB_incomp_3[0]
    for (let c = 0; c < 3; c++) {
      const val = dataB[c]
      const tex = createNumberTexture(val, palError.bg, palError.text, palError.border)
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: 1
      })
      const mesh = new THREE.Mesh(cubeGeo, mat)
      const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(palError.border), linewidth: 2 })
      const wireframe = new THREE.LineSegments(wireGeo, wireMat)
      mesh.add(wireframe)

      const x = offsetB_X + (c - 1.0) * spacing
      const y = 0
      const z = 0
      mesh.position.set(x, y, z)
      mesh.userData = { arrayKey: 'B', r: 0, c, val }
      scene.add(mesh)

      activeCubes.push({
        mesh,
        wireframe,
        arrayKey: 'B',
        r: 0,
        c,
        val,
        isGhost: false,
        basePos: new THREE.Vector3(x, y, z)
      })
      allMeshes.push(mesh)
    }
  } else {
    // Array B is (1, 4) — row vector
    const dataB = vectorB_1x4[0]
    // The base row sits at row 1 (y = 0)
    for (let c = 0; c < 4; c++) {
      const val = dataB[c]
      const tex = createNumberTexture(val, palArrayB.bg, palArrayB.text, palArrayB.border)
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: 1
      })
      const mesh = new THREE.Mesh(cubeGeo, mat)
      const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(palArrayB.border), linewidth: 1.5 })
      const wireframe = new THREE.LineSegments(wireGeo, wireMat)
      mesh.add(wireframe)

      const x = offsetB_X + (c - 1.5) * spacing
      const y = 0 // row 1 position
      const z = 0
      mesh.position.set(x, y, z)
      mesh.userData = { arrayKey: 'B', r: 1, c, val }
      scene.add(mesh)

      activeCubes.push({
        mesh,
        wireframe,
        arrayKey: 'B',
        r: 1,
        c,
        val,
        isGhost: false,
        basePos: new THREE.Vector3(x, y, z)
      })
      allMeshes.push(mesh)
    }

    // Spawn Ghost Rows for B: row 0 (y = +1.25) and row 2 (y = -1.25)
    for (const r of [0, 2]) {
      for (let c = 0; c < 4; c++) {
        const val = dataB[c]
        const tex = createNumberTexture(val, palGhost.bg, palGhost.text, palGhost.border)
        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.5,
          metalness: 0.05,
          transparent: true,
          opacity: 0
        })
        const mesh = new THREE.Mesh(cubeGeo, mat)
        const wireMat = new THREE.LineBasicMaterial({
          color: new THREE.Color(palGhost.border),
          linewidth: 1.5,
          transparent: true,
          opacity: 0
        })
        const wireframe = new THREE.LineSegments(wireGeo, wireMat)
        mesh.add(wireframe)

        const x = offsetB_X + (c - 1.5) * spacing
        const y = -(r - 1.0) * spacing
        const z = 0
        mesh.position.set(x, y, z)
        mesh.userData = { arrayKey: 'B', r, c, val, isGhost: true }
        ghostCubesGroup?.add(mesh)

        activeCubes.push({
          mesh,
          wireframe,
          arrayKey: 'B',
          r,
          c,
          val,
          isGhost: true,
          basePos: new THREE.Vector3(x, y, z)
        })
        allMeshes.push(mesh)
      }
    }
  }

  // 3. Middle Operator & Array Labels
  if (labelSpritesGroup) {
    const labelA = activePreset.value === 'col_row' ? 'Array A: (3, 1)' : 'Array A: (3, 4)'
    const spriteA = createTextSprite(labelA, isDark.value ? '#93c5fd' : '#1d4ed8', 34)
    spriteA.position.set(offsetA_X, 2.3, 0)
    spriteA.scale.set(3.8, 1.2, 1)
    labelSpritesGroup.add(spriteA)

    const opSymbol = activePreset.value === 'incompatible' ? '≠' : '+'
    const opColor = activePreset.value === 'incompatible' ? (isDark.value ? '#f87171' : '#b91c1c') : (isDark.value ? '#cbd5e1' : '#475569')
    const spriteOp = createTextSprite(opSymbol, opColor, 60)
    spriteOp.position.set(0, 0, 0)
    spriteOp.scale.set(1.5, 1.5, 1)
    labelSpritesGroup.add(spriteOp)

    const labelB = activePreset.value === 'incompatible' ? 'Array B: (3,) [Conflict!]' : 'Array B: (1, 4)'
    const colB = activePreset.value === 'incompatible' ? (isDark.value ? '#f87171' : '#b91c1c') : (isDark.value ? '#c084fc' : '#6d28d9')
    const spriteB = createTextSprite(labelB, colB, 34)
    spriteB.position.set(offsetB_X, 2.3, 0)
    spriteB.scale.set(4.2, 1.2, 1)
    labelSpritesGroup.add(spriteB)
  }

  updateFloatingAxes()
  applyProgressInterpolation(progress.value)
}

// Interpolate ghost clones and pairwise highlights based on progress t
const applyProgressInterpolation = (t: number) => {
  if (viewMode.value === 'result' || !presetConfig.value.isCompatible) return

  // Phase 1: t in [0, 0.25] -> highlight singleton dimensions
  // Phase 2: t in [0.25, 0.7] -> ghost clones fade in & expand
  // Phase 3: t in [0.7, 1.0] -> ghost solidifies & pairwise addition lines glow

  const ghostOpacity = t < 0.2 ? 0 : Math.min(0.85, (t - 0.2) / 0.5)

  activeCubes.forEach((c) => {
    if (c.isGhost) {
      const mat = c.mesh.material as THREE.MeshStandardMaterial
      const wire = c.wireframe.material as THREE.LineBasicMaterial

      mat.opacity = ghostOpacity * 0.75
      wire.opacity = ghostOpacity

      if (t >= 0.75) {
        // Solidified ghost
        const pal = c.arrayKey === 'A' ? palArrayA : palArrayB
        const tex = createNumberTexture(c.val, pal.bg, pal.text, pal.border)
        mat.map = tex
        mat.needsUpdate = true
        wire.color.set(new THREE.Color(pal.border))
      } else {
        const tex = createNumberTexture(c.val, palGhost.bg, palGhost.text, palGhost.border)
        mat.map = tex
        mat.needsUpdate = true
        wire.color.set(new THREE.Color(palGhost.border))
      }
    } else {
      // Base cubes pulse slightly during singleton highlight
      if (t > 0 && t < 0.3) {
        const s = 1 + Math.sin(t * Math.PI * 4) * 0.06
        c.mesh.scale.set(s, s, s)
      } else {
        c.mesh.scale.set(1, 1, 1)
      }
    }
  })

  // Connector lines during Phase 3
  if (connectorLinesGroup) {
    while (connectorLinesGroup.children.length > 0) {
      const child = connectorLinesGroup.children[0]
      connectorLinesGroup.remove(child)
      if (child instanceof THREE.Line) {
        child.geometry.dispose()
        ;(child.material as THREE.Material).dispose()
      }
    }

    if (t >= 0.65 && activePreset.value !== 'incompatible') {
      const lineMat = new THREE.LineDashedMaterial({
        color: isDark.value ? 0xf59e0b : 0xd97706,
        dashSize: 0.15,
        gapSize: 0.1,
        transparent: true,
        opacity: Math.min(0.9, (t - 0.65) / 0.35)
      })

      // Link corresponding cells between left and right structures
      for (let r = 0; r < 3; r++) {
        const pA = new THREE.Vector3(-3.2 + (0 - 1.5) * 1.25, -(r - 1.0) * 1.25, 0)
        const pB = new THREE.Vector3(+3.2 + (0 - 1.5) * 1.25, -(r - 1.0) * 1.25, 0)
        const geo = new THREE.BufferGeometry().setFromPoints([pA, pB])
        const line = new THREE.Line(geo, lineMat)
        line.computeLineDistances()
        connectorLinesGroup.add(line)
      }
    }
  }
}

// Bounding-Frame Coordinate Axes
const updateFloatingAxes = () => {
  if (!floatingAxesGroup) return

  while (floatingAxesGroup.children.length > 0) {
    const child = floatingAxesGroup.children[0]
    floatingAxesGroup.remove(child)
  }

  if (activeCubes.length === 0) return

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  for (const c of activeCubes) {
    const pos = c.basePos
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
const setPreset = (preset: PresetKey) => {
  activePreset.value = preset
  viewMode.value = 'operands'
  progress.value = 0
  isPlaying.value = false
  buildSceneForPreset()
  emitInspection()
}

const toggleViewMode = (mode: ViewMode) => {
  viewMode.value = mode
  progress.value = mode === 'result' ? 1 : 0
  isPlaying.value = false
  buildSceneForPreset()
  emitInspection()
}

const togglePlay = () => {
  if (!presetConfig.value.isCompatible) return
  if (progress.value >= 1) progress.value = 0
  isPlaying.value = !isPlaying.value
}

const stepNext = () => {
  if (!presetConfig.value.isCompatible) return
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
  viewMode.value = 'operands'
  buildSceneForPreset()
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
    if (data && data.arrayKey) {
      selectedCell.value = {
        arrayName: data.arrayKey === 'A' ? 'Array A' : data.arrayKey === 'B' ? 'Array B' : 'Result C',
        r: data.r,
        c: data.c,
        val: data.val
      }
      emitInspection()
    }
  }
}

const emitInspection = () => {
  const cfg = presetConfig.value
  const cell = selectedCell.value

  const details: Record<string, any> = {
    'Array A Shape': `(${cfg.shapeA.join(', ')})`,
    'Array B Shape': Array.isArray(cfg.shapeB) ? `(${cfg.shapeB.join(', ')})` : `(${cfg.shapeB},)`,
    'Resulting Shape': cfg.outShape ? `(${cfg.outShape.join(', ')})` : 'Incompatible Error (None)',
    'Compatibility Check': cfg.isCompatible ? 'Valid NumPy Broadcast Pattern ✓' : 'Shape Mismatch (ValueError) ✗',
    'Rule Explanation': cfg.ruleDesc,
    'Stride A Strategy': cfg.stridesA,
    'Stride B Strategy': cfg.stridesB,
    'Zero-Copy Invariant': cfg.isCompatible
      ? 'Virtual Replication: Stride along singleton axis is set to 0. No extra bytes allocated in RAM!'
      : 'Incompatible trailing dimension prohibits automatic broadcasting.'
  }

  if (cell) {
    details['Inspected Cell'] = `${cell.arrayName}[r=${cell.r}, c=${cell.c}] = ${cell.val}`
    if (cfg.isCompatible && computedResultData.value) {
      const sumVal = computedResultData.value[cell.r][cell.c]
      details['Broadcast Sum Value'] = `A[${cell.r}, ${cell.c}] + B[${cell.r}, ${cell.c}] = ${sumVal}`
    }
  }

  emit('inspect', {
    title: `Broadcasting: ${activePreset.value === 'matrix_row' ? '(3, 4) + (1, 4)' : activePreset.value === 'col_row' ? '(3, 1) + (1, 4)' : '(3, 4) + (3,) [Error]'}`,
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
    buildSceneForPreset()
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

  activeCubes.forEach((c) => {
    c.mesh.geometry.dispose()
    ;(c.mesh.material as THREE.Material).dispose()
    c.wireframe.geometry.dispose()
  })
  activeCubes = []
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
        <!-- Top Status Bar: Presets & View Switcher -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <!-- Preset Selector -->
          <div class="flex items-center gap-1.5 bg-card/90 backdrop-blur-md p-1 rounded-md border border-line shadow-xs pointer-events-auto text-xs font-mono">
            <button
              type="button"
              @click="setPreset('matrix_row')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="activePreset === 'matrix_row' ? 'bg-brand-blue text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="(3, 4) + (1, 4) -> Vector stretches along rows"
            >
              (3, 4) + (1, 4)
            </button>
            <button
              type="button"
              @click="setPreset('col_row')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="activePreset === 'col_row' ? 'bg-brand-purple text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="(3, 1) + (1, 4) -> Both stretch"
            >
              (3, 1) + (1, 4)
            </button>
            <button
              type="button"
              @click="setPreset('incompatible')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="activePreset === 'incompatible' ? 'bg-red-600 text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="(3, 4) + (3,) -> Trailing mismatch error"
            >
              (3, 4) + (3,) [Error]
            </button>
          </div>

          <!-- View Mode Toggle -->
          <div v-if="presetConfig.isCompatible" class="flex items-center gap-1.5 bg-card/90 backdrop-blur-md p-1 rounded-md border border-line shadow-xs pointer-events-auto text-xs font-mono">
            <button
              type="button"
              @click="toggleViewMode('operands')"
              class="px-2 py-0.5 rounded font-bold transition-colors"
              :class="viewMode === 'operands' ? 'bg-brand-blue text-white shadow-xs' : 'text-muted hover:text-ink'"
            >
              Ghost Clones (A + B)
            </button>
            <button
              type="button"
              @click="toggleViewMode('result')"
              class="px-2 py-0.5 rounded font-bold transition-colors"
              :class="viewMode === 'result' ? 'bg-brand-amber text-white shadow-xs' : 'text-muted hover:text-ink'"
            >
              Result Grid C (3, 4)
            </button>
          </div>

          <!-- Zero-Copy Stride Callout Badge -->
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card/90 backdrop-blur-md border border-line shadow-xs font-mono text-xs pointer-events-auto">
            <Zap class="w-3.5 h-3.5 text-brand-amber" />
            <span class="font-bold text-ink">Zero-Copy Memory:</span>
            <span class="text-brand-blue font-semibold">Stride = 0 Bytes</span>
          </div>
        </div>

        <!-- Middle Alert Banner for Incompatible Preset -->
        <div v-if="activePreset === 'incompatible'" class="pointer-events-auto max-w-md mx-auto bg-red-950/90 border border-red-500/80 text-red-200 p-2.5 rounded-lg shadow-lg flex flex-col gap-1.5 text-xs font-mono">
          <div class="flex items-center gap-2 font-bold text-red-300">
            <AlertTriangle class="w-4 h-4 text-red-400 shrink-0" />
            <span>ValueError: operands could not be broadcast together</span>
          </div>
          <p class="text-[0.72rem] text-red-200/90 leading-relaxed">
            Trailing dimension of A is <strong>4</strong>, while trailing dimension of B is <strong>3</strong>. Neither dimension is 1 and 4 ≠ 3.
          </p>
          <div class="mt-1 flex items-center justify-between">
            <span class="text-[0.68rem] text-red-300/80">Trailing dimensions must match right-to-left!</span>
            <button
              type="button"
              @click="setPreset('col_row')"
              class="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[0.7rem] font-bold transition-colors inline-flex items-center gap-1"
            >
              <span>Fix with np.newaxis</span>
              <ArrowRight class="w-3 h-3" />
            </button>
          </div>
        </div>

        <!-- Bottom Overlay: Active Instruction Note -->
        <div class="flex items-center justify-between text-[0.68rem] text-muted">
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full" :class="presetConfig.isCompatible ? 'bg-emerald-500' : 'bg-red-500'" />
            <span v-if="presetConfig.isCompatible">
              {{ presetConfig.ruleDesc }}
            </span>
            <span v-else class="text-red-600 dark:text-red-400 font-semibold">
              Broadcast Rule Violation: Shapes (3, 4) and (3,) cannot pair.
            </span>
          </div>
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono hidden sm:block">
            Drag: Orbit 360° • Click: Inspect Cell Stride
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
          :disabled="!presetConfig.isCompatible"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors shadow-xs"
          :class="!presetConfig.isCompatible ? 'bg-muted/40 text-muted cursor-not-allowed' : isPlaying ? 'bg-brand-amber text-white' : 'bg-brand-blue hover:bg-brand-blue-hover text-white'"
        >
          <Pause v-if="isPlaying" class="w-3.5 h-3.5 fill-current" />
          <Play v-else class="w-3.5 h-3.5 fill-current" />
          <span>{{ isPlaying ? 'Pause' : 'Broadcast & Compute' }}</span>
        </button>

        <button
          type="button"
          @click="stepNext"
          :disabled="!presetConfig.isCompatible"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono font-medium text-ink transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Step through replication phases"
        >
          <StepForward class="w-3.5 h-3.5 text-muted" />
          <span>Step (+25%)</span>
        </button>

        <button
          type="button"
          @click="resetSimulation"
          class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono text-muted hover:text-ink transition-colors"
          title="Reset simulation"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>

        <!-- Progress Slider -->
        <div v-if="presetConfig.isCompatible" class="flex items-center gap-1.5 text-xs font-mono text-muted pl-1">
          <input
            id="broadcastProgress"
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

      <!-- Quick Summary Status -->
      <div class="flex items-center gap-2 text-xs font-mono">
        <span class="text-muted">Broadcast Result:</span>
        <span class="font-bold" :class="presetConfig.isCompatible ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'">
          {{ presetConfig.isCompatible ? '(3, 4) Compatible ✓' : 'ValueError (Incompatible) ✗' }}
        </span>
      </div>
    </div>

    <!-- Fluid Telemetry HUD Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Array Alignment</div>
        <div class="font-bold text-brand-blue truncate" title="Operand shapes">
          A: ({{ presetConfig.shapeA.join(', ') }}) | B: {{ Array.isArray(presetConfig.shapeB) ? `(${presetConfig.shapeB.join(', ')})` : `(${presetConfig.shapeB},)` }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Broadcasting Rule</div>
        <div class="font-bold truncate" :class="presetConfig.isCompatible ? 'text-brand-purple' : 'text-red-500'">
          {{ presetConfig.isCompatible ? 'Trailing 4==4 • Stretches 1→3' : 'Trailing 4≠3 Mismatch!' }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Virtual Memory Stride</div>
        <div class="font-bold text-emerald-600 dark:text-emerald-400 truncate" title="Zero copy in RAM">
          {{ presetConfig.stridesB }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Replication Invariant</div>
        <div class="font-bold truncate" :class="presetConfig.isCompatible ? 'text-brand-green' : 'text-red-500'">
          {{ presetConfig.isCompatible ? 'Zero-Copy Virtual Buffer ✓' : 'Allocation Prohibited ✗' }}
        </div>
      </div>
    </div>
  </div>
</template>

