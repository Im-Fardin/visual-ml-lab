<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Play, Pause, StepForward, RotateCcw, Box, ArrowRight, Layers, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-vue-next'
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

// 12 elements base buffer
const TOTAL_ELEMENTS = 12
const dataBuffer = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]

// Shape Options
type ShapeType = '1D' | '2D_3x4' | '2D_2x6' | '2D_4x3' | '2D_6x2' | '3D_2x2x3' | 'custom'
const selectedShapeType = ref<ShapeType>('2D_3x4')

// Custom / dynamic shape values
const customR = ref<number | string>(3)
const customC = ref<number | string>(4)
const resolvedShape = ref<number[]>([3, 4])
const shapeError = ref<string | null>(null)

// Memory Order: 'C' (Row-major) vs 'F' (Column-major)
type MemoryOrder = 'C' | 'F'
const memoryOrder = ref<MemoryOrder>('C')

// Animation & Transitions
const progress = ref(1) // 1 = fully transitioned at target
const isPlaying = ref(false)
const selectedElementIdx = ref<number>(0)

// Three.js instances
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animFrameId = 0
let floatingAxesGroup: THREE.Group | null = null
let ramBufferGroup: THREE.Group | null = null
let traceLine: THREE.Line | null = null

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2(-999, -999)

const initialCameraPos = new THREE.Vector3(0.8, 0.9, 8.8)
const initialCameraTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

// Color palettes for visual tracking across rows/sub-groups
const colorPalette = [
  { bg: '#ffffff', text: '#1e40af', border: '#2563eb' }, // Blue
  { bg: '#ffffff', text: '#7c3aed', border: '#8b5cf6' }, // Purple
  { bg: '#ffffff', text: '#059669', border: '#10b981' }, // Green
  { bg: '#ffffff', text: '#d97706', border: '#f59e0b' }  // Amber
]

interface NodeData {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  index: number
  val: number
  posFrom: THREE.Vector3
  posTarget: THREE.Vector3
  coords: number[] // [r, c] or [d, r, c]
}

let activeNodes: NodeData[] = []
let ramTiles: THREE.Mesh[] = []

// Compute target coordinates for element k in shape [R, C] or [D, R, C] given memory order
const calculateElementPosition = (
  k: number,
  shape: number[],
  order: MemoryOrder
): { pos: THREE.Vector3; coords: number[] } => {
  const spacing = 1.32

  if (shape.length === 1) {
    // 1D: (12,)
    const x = (k - (shape[0] - 1) / 2) * 1.15
    const y = 0
    const z = 0
    return { pos: new THREE.Vector3(x, y, z), coords: [k] }
  }

  if (shape.length === 2) {
    const [R, C] = shape
    let r = 0, c = 0
    if (order === 'C') {
      // Row-major: fill across columns first
      r = Math.floor(k / C)
      c = k % C
    } else {
      // Fortran: fill down rows first
      c = Math.floor(k / R)
      r = k % R
    }
    const x = (c - (C - 1) / 2) * spacing
    const y = -(r - (R - 1) / 2) * spacing
    const z = 0
    return { pos: new THREE.Vector3(x, y, z), coords: [r, c] }
  }

  if (shape.length === 3) {
    const [D, R, C] = shape
    let d = 0, r = 0, c = 0
    if (order === 'C') {
      d = Math.floor(k / (R * C))
      const rem = k % (R * C)
      r = Math.floor(rem / C)
      c = rem % C
    } else {
      c = Math.floor(k / (D * R))
      const rem = k % (D * R)
      r = Math.floor(rem / D)
      d = rem % D
    }
    const x = (c - (C - 1) / 2) * spacing
    const y = -(r - (R - 1) / 2) * spacing
    const z = (d - (D - 1) / 2) * 2.3
    return { pos: new THREE.Vector3(x, y, z), coords: [d, r, c] }
  }

  return { pos: new THREE.Vector3(0, 0, 0), coords: [k] }
}

// Compute Strides in bytes (assuming 4-byte int32)
const computedStrides = computed(() => {
  const shape = resolvedShape.value
  const itemSize = 4 // 4 bytes for int32
  if (shape.length === 1) {
    return [itemSize]
  }
  if (shape.length === 2) {
    const [R, C] = shape
    if (memoryOrder.value === 'C') {
      return [C * itemSize, itemSize]
    } else {
      return [itemSize, R * itemSize]
    }
  }
  if (shape.length === 3) {
    const [D, R, C] = shape
    if (memoryOrder.value === 'C') {
      return [R * C * itemSize, C * itemSize, itemSize]
    } else {
      return [itemSize, D * itemSize, D * R * itemSize]
    }
  }
  return [itemSize]
})

// Resolve dynamic shape selection including -1 handling
const resolveShape = () => {
  shapeError.value = null

  if (selectedShapeType.value === '1D') {
    resolvedShape.value = [12]
    return
  }
  if (selectedShapeType.value === '2D_3x4') {
    resolvedShape.value = [3, 4]
    return
  }
  if (selectedShapeType.value === '2D_2x6') {
    resolvedShape.value = [2, 6]
    return
  }
  if (selectedShapeType.value === '2D_4x3') {
    resolvedShape.value = [4, 3]
    return
  }
  if (selectedShapeType.value === '2D_6x2') {
    resolvedShape.value = [6, 2]
    return
  }
  if (selectedShapeType.value === '3D_2x2x3') {
    resolvedShape.value = [2, 2, 3]
    return
  }

  // Custom Shape
  const rVal = typeof customR.value === 'string' ? customR.value.trim() : customR.value
  const cVal = typeof customC.value === 'string' ? customC.value.trim() : customC.value

  const isRNeg = rVal === -1 || rVal === '-1'
  const isCNeg = cVal === -1 || cVal === '-1'

  if (isRNeg && isCNeg) {
    shapeError.value = 'Cannot specify multiple -1 dimensions in reshape.'
    return
  }

  if (isRNeg) {
    const cNum = Number(cVal)
    if (!cNum || cNum <= 0 || 12 % cNum !== 0) {
      shapeError.value = `Cannot reshape array of size 12 into shape (-1, ${cVal}).`
      return
    }
    resolvedShape.value = [12 / cNum, cNum]
    return
  }

  if (isCNeg) {
    const rNum = Number(rVal)
    if (!rNum || rNum <= 0 || 12 % rNum !== 0) {
      shapeError.value = `Cannot reshape array of size 12 into shape (${rVal}, -1).`
      return
    }
    resolvedShape.value = [rNum, 12 / rNum]
    return
  }

  const rNum = Number(rVal)
  const cNum = Number(cVal)
  if (rNum * cNum !== 12) {
    shapeError.value = `Cannot reshape array of size 12 into shape (${rNum}, ${cNum}) (prod=${rNum * cNum} ≠ 12).`
    return
  }
  resolvedShape.value = [rNum, cNum]
}

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

  ramBufferGroup = new THREE.Group()
  scene.add(ramBufferGroup)

  buildRamBufferRibbon()
  buildCubesStructure()

  const animate = () => {
    animFrameId = requestAnimationFrame(animate)

    if (isPlaying.value) {
      // Smooth 1.6s transition (0.01 per frame)
      progress.value += 0.01
      if (progress.value >= 1) {
        progress.value = 1
        isPlaying.value = false
      }
      applyInterpolation(progress.value)
    }

    if (controls) controls.update()
    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  animate()
  applyInterpolation(1)
  emitInspection()
}

// Persistent 1D RAM Buffer ribbon at the base (y = -2.35)
const buildRamBufferRibbon = () => {
  if (!ramBufferGroup) return
  while (ramBufferGroup.children.length > 0) {
    const child = ramBufferGroup.children[0]
    ramBufferGroup.remove(child)
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      ;(child.material as THREE.Material).dispose()
    }
  }
  ramTiles = []

  const tileGeo = new THREE.BoxGeometry(0.72, 0.22, 0.5)
  const wireGeo = new THREE.EdgesGeometry(tileGeo)

  for (let i = 0; i < TOTAL_ELEMENTS; i++) {
    const val = dataBuffer[i]
    const tex = createNumberTexture(val, '#f8fafc', '#1e293b', '#64748b')
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.35,
      metalness: 0.1
    })
    const mesh = new THREE.Mesh(tileGeo, mat)
    const wireMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.4 })
    mesh.add(new THREE.LineSegments(wireGeo, wireMat))

    const x = (i - 5.5) * 0.82
    const y = -2.38
    const z = 1.6
    mesh.position.set(x, y, z)
    mesh.userData = { isRam: true, index: i, val }
    ramBufferGroup.add(mesh)
    ramTiles.push(mesh)
  }

  // Label Sprite: "1D Contiguous RAM Buffer (0x00 ... 0x2C)"
  const sprite = createTextSprite('Physical Contiguous RAM Buffer (0x7ffd)', isDark.value ? '#94a3b8' : '#475569', 34)
  sprite.position.set(0, -2.15, 1.6)
  sprite.scale.set(3.2, 0.8, 1)
  ramBufferGroup.add(sprite)
}

// Build 12 interactive cubes in the main scene
const buildCubesStructure = () => {
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

  for (let k = 0; k < TOTAL_ELEMENTS; k++) {
    const val = dataBuffer[k]
    const pal = colorPalette[Math.floor(k / 3) % colorPalette.length]
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

    const { pos, coords } = calculateElementPosition(k, resolvedShape.value, memoryOrder.value)
    mesh.position.copy(pos)
    mesh.userData = { id: `cube_${k}`, index: k, val, coords }
    scene.add(mesh)

    activeNodes.push({
      mesh,
      wireframe,
      index: k,
      val,
      posFrom: pos.clone(),
      posTarget: pos.clone(),
      coords
    })
  }

  updateFloatingAxes()
  updateTraceLine()
}

// Compute new target positions when shape or memory order changes
const updateTargetCoordinates = () => {
  if (shapeError.value) return

  activeNodes.forEach((node) => {
    node.posFrom.copy(node.mesh.position)
    const { pos, coords } = calculateElementPosition(node.index, resolvedShape.value, memoryOrder.value)
    node.posTarget.copy(pos)
    node.coords = coords
    node.mesh.userData.coords = coords
  })

  updateFloatingAxes()
  updateTraceLine()
}

// Arc Lerp Interpolation
const applyInterpolation = (t: number) => {
  const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

  activeNodes.forEach((node) => {
    // Parabolic arc elevation on Y or Z to prevent colliding cubes
    const arc = Math.sin(t * Math.PI) * 0.75
    node.mesh.position.lerpVectors(node.posFrom, node.posTarget, eased)
    if (resolvedShape.value.length === 3) {
      node.mesh.position.y += arc * 0.5
    } else {
      node.mesh.position.z += arc
    }
  })

  // Update trace line along active positions
  updateTraceLine()
}

// Traversal order trace line (Row-Major vs Col-Major trajectory)
const updateTraceLine = () => {
  if (!scene) return

  if (traceLine) {
    scene.remove(traceLine)
    traceLine.geometry.dispose()
    ;(traceLine.material as THREE.Material).dispose()
    traceLine = null
  }

  if (activeNodes.length < 2) return

  const points: THREE.Vector3[] = activeNodes.map((n) => n.mesh.position.clone())
  const lineGeo = new THREE.BufferGeometry().setFromPoints(points)
  const lineMat = new THREE.LineDashedMaterial({
    color: memoryOrder.value === 'C' ? 0x2563eb : 0xd97706,
    dashSize: 0.25,
    gapSize: 0.12,
    linewidth: 2.5
  })

  traceLine = new THREE.Line(lineGeo, lineMat)
  traceLine.computeLineDistances()
  scene.add(traceLine)
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
    const pos = node.posTarget
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
  const lenZ = Math.max(1.8, maxZ - minZ + halfW * 2 + clearance + marginExtra)

  // X Axis (Cols): Red / Coral pointing Right (+X)
  const arrowX = createBoldArrow(new THREE.Vector3(1, 0, 0), lenX, 0xef4444, 'axis X (Cols)', 0.055, 0.16, 0.35)
  floatingAxesGroup.add(arrowX)

  // Y Axis (Rows): Green / Emerald pointing Up (+Y)
  if (resolvedShape.value.length >= 2) {
    const arrowY = createBoldArrow(new THREE.Vector3(0, 1, 0), lenY, 0x10b981, 'axis Y (Rows)', 0.055, 0.16, 0.35)
    floatingAxesGroup.add(arrowY)
  }

  // Z Axis (Depth): Blue / Sapphire pointing Forward (+Z)
  if (resolvedShape.value.length === 3) {
    const arrowZ = createBoldArrow(new THREE.Vector3(0, 0, 1), lenZ, 0x3b82f6, 'axis Z (Depth)', 0.055, 0.16, 0.35)
    floatingAxesGroup.add(arrowZ)
  }
}

// Actions
const selectShape = (st: ShapeType) => {
  selectedShapeType.value = st
  resolveShape()
  if (shapeError.value) return
  progress.value = 0
  isPlaying.value = true
  updateTargetCoordinates()
  emitInspection()
}

const applyCustomReshape = () => {
  selectedShapeType.value = 'custom'
  resolveShape()
  if (shapeError.value) return
  progress.value = 0
  isPlaying.value = true
  updateTargetCoordinates()
  emitInspection()
}

const setOrder = (order: MemoryOrder) => {
  if (memoryOrder.value === order) return
  memoryOrder.value = order
  progress.value = 0
  isPlaying.value = true
  updateTargetCoordinates()
  emitInspection()
}

const togglePlay = () => {
  if (progress.value >= 1) progress.value = 0
  isPlaying.value = !isPlaying.value
}

const stepAnimation = () => {
  isPlaying.value = false
  progress.value = Math.min(1, Math.round((progress.value + 0.25) * 100) / 100)
  applyInterpolation(progress.value)
  emitInspection()
}

const resetSimulation = () => {
  isPlaying.value = false
  selectedShapeType.value = '2D_3x4'
  memoryOrder.value = 'C'
  resolveShape()
  progress.value = 1
  buildCubesStructure()
  applyInterpolation(1)
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
  const meshes = activeNodes.map((n) => n.mesh).concat(ramTiles)
  const intersects = raycaster.intersectObjects(meshes, false)

  if (intersects.length > 0) {
    const clickedMesh = intersects[0].object as THREE.Mesh
    const data = clickedMesh.userData
    if (data && data.index !== undefined) {
      selectedElementIdx.value = data.index
      highlightSelected(data.index)
      emitInspection(data.index)
    }
  }
}

const highlightSelected = (idx: number) => {
  ramTiles.forEach((tile, i) => {
    const isTarget = i === idx
    const border = isTarget ? '#2563eb' : '#64748b'
    const bg = isTarget ? '#dbeafe' : '#f8fafc'
    const text = isTarget ? '#1e40af' : '#1e293b'
    const tex = createNumberTexture(dataBuffer[i], bg, text, border)
    ;(tile.material as THREE.MeshStandardMaterial).map = tex
    ;(tile.material as THREE.MeshStandardMaterial).needsUpdate = true
  })
}

const emitInspection = (customIdx?: number) => {
  const idx = customIdx !== undefined ? customIdx : selectedElementIdx.value
  const node = activeNodes.find((n) => n.index === idx)
  const coordsStr = node ? `(${node.coords.join(', ')})` : '()'
  const hexAddr = `0x${(0x7ffd0000 + idx * 4).toString(16).toUpperCase()}`

  emit('inspect', {
    title: `Element [${idx}] Reshape Mapping`,
    details: {
      'Element Value': node ? node.val : idx,
      'Flat RAM Offset': `${idx} (${hexAddr})`,
      'Active Subscript': coordsStr,
      'Target Shape': `(${resolvedShape.value.join(', ')})`,
      'Memory Order': memoryOrder.value === 'C' ? 'C-Contiguous (Row-Major)' : 'Fortran (Column-Major)',
      'Stride Vector': `(${computedStrides.value.join(', ')}) bytes`,
      'Conservation Invariant': `${TOTAL_ELEMENTS} == np.prod((${resolvedShape.value.join(', ')})) ✓`,
      'Memory Continuous': 'Zero copy allocated (Buffer Pointer Reinterpreted)'
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
    buildRamBufferRibbon()
    updateFloatingAxes()
  }
})

onMounted(() => {
  resolveShape()
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

  ramTiles.forEach((tile) => {
    tile.geometry.dispose()
    ;(tile.material as THREE.Material).dispose()
  })
  ramTiles = []

  if (traceLine) {
    traceLine.geometry.dispose()
    ;(traceLine.material as THREE.Material).dispose()
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
        <!-- Top Status Bar: Memory Order Switcher & Active Shape Badge -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <!-- Memory Order Toggle -->
          <div class="flex items-center gap-1.5 bg-card/90 backdrop-blur-md p-1 rounded-md border border-line shadow-xs pointer-events-auto text-xs font-mono">
            <span class="text-[10px] text-muted font-bold px-1 uppercase">Order:</span>
            <button
              type="button"
              @click="setOrder('C')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="memoryOrder === 'C' ? 'bg-brand-blue text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="Row-major: sequential across rows (C standard)"
            >
              'C' (Row-Major)
            </button>
            <button
              type="button"
              @click="setOrder('F')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="memoryOrder === 'F' ? 'bg-brand-amber text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="Col-major: sequential down columns (Fortran/MATLAB)"
            >
              'F' (Col-Major)
            </button>
          </div>

          <!-- Active Shape Badge & Dimension Inference -->
          <div class="flex items-center gap-2 pointer-events-auto text-xs font-mono">
            <span class="px-2.5 py-1 rounded-md bg-card/90 backdrop-blur-md border border-line shadow-xs font-bold text-ink">
              Shape: ({{ resolvedShape.join(', ') }})
            </span>
            <span class="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold hidden sm:inline-flex items-center gap-1">
              <CheckCircle2 class="w-3.5 h-3.5" />
              <span>N = 12 Elements</span>
            </span>
          </div>
        </div>

        <!-- Bottom Overlay: Trajectory Notice & Orbit Hint -->
        <div class="flex items-center justify-between text-[0.68rem] text-muted">
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full" :class="memoryOrder === 'C' ? 'bg-brand-blue' : 'bg-brand-amber'" />
            <span>Trace Line: {{ memoryOrder === 'C' ? 'Horizontal Row Path' : 'Vertical Column Path' }}</span>
          </div>
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono hidden sm:block">
            Drag: Orbit 360° • Click: Map RAM Address
          </div>
        </div>
      </div>
    </div>

    <!-- Interactive Shape Selector & Dimension Inference Controls -->
    <div class="bg-card border border-line rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
      <!-- Target Shape Preset Buttons -->
      <div class="flex items-center gap-1.5 bg-card-subtle p-1 rounded-md border border-line overflow-x-auto text-xs font-mono">
        <button
          type="button"
          @click="selectShape('1D')"
          class="px-2.5 py-1 rounded font-medium transition-colors"
          :class="selectedShapeType === '1D' ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          (12,)
        </button>
        <button
          type="button"
          @click="selectShape('2D_3x4')"
          class="px-2.5 py-1 rounded font-medium transition-colors"
          :class="selectedShapeType === '2D_3x4' ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          (3, 4)
        </button>
        <button
          type="button"
          @click="selectShape('2D_2x6')"
          class="px-2.5 py-1 rounded font-medium transition-colors"
          :class="selectedShapeType === '2D_2x6' ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          (2, 6)
        </button>
        <button
          type="button"
          @click="selectShape('3D_2x2x3')"
          class="px-2.5 py-1 rounded font-medium transition-colors"
          :class="selectedShapeType === '3D_2x2x3' ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          (2, 2, 3)
        </button>
        <button
          type="button"
          @click="selectShape('1D')"
          class="px-2.5 py-1 rounded font-medium transition-colors text-brand-purple hover:bg-card"
          title="Flatten / Ravel reinterprets multidimensional tensors into linear 1D buffer"
        >
          Flatten / Ravel
        </button>
      </div>

      <!-- Dynamic -1 Inference Input Box -->
      <div class="flex items-center gap-2 text-xs font-mono">
        <span class="text-muted text-[11px] font-semibold">Reshape:</span>
        <div class="inline-flex items-center gap-1 bg-card-subtle px-2 py-1 rounded-md border border-line">
          <span>(</span>
          <select
            v-model="customR"
            @change="applyCustomReshape"
            class="bg-transparent text-ink font-bold focus:outline-none cursor-pointer"
          >
            <option :value="1">1</option>
            <option :value="2">2</option>
            <option :value="3">3</option>
            <option :value="4">4</option>
            <option :value="6">6</option>
            <option :value="12">12</option>
            <option :value="-1">-1</option>
          </select>
          <span class="text-muted">,</span>
          <select
            v-model="customC"
            @change="applyCustomReshape"
            class="bg-transparent text-ink font-bold focus:outline-none cursor-pointer"
          >
            <option :value="1">1</option>
            <option :value="2">2</option>
            <option :value="3">3</option>
            <option :value="4">4</option>
            <option :value="6">6</option>
            <option :value="12">12</option>
            <option :value="-1">-1</option>
          </select>
          <span>)</span>
        </div>
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
          <span>{{ isPlaying ? 'Pause' : 'Reorganize' }}</span>
        </button>

        <button
          type="button"
          @click="stepAnimation"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono font-medium text-ink transition-colors"
          title="Step glide animation"
        >
          <StepForward class="w-3.5 h-3.5 text-muted" />
          <span>Step</span>
        </button>

        <button
          type="button"
          @click="resetSimulation"
          class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono text-muted hover:text-ink transition-colors"
          title="Reset to default shape (3, 4)"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>

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

    <!-- Error Message Alert if invalid reshape combination -->
    <div
      v-if="shapeError"
      class="rounded-md border border-red-500/30 bg-red-500/10 p-2.5 text-xs font-mono text-red-600 dark:text-red-400 flex items-center gap-2"
    >
      <AlertTriangle class="w-4 h-4 shrink-0" />
      <span>{{ shapeError }}</span>
    </div>

    <!-- Fluid Telemetry HUD Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Target Shape</div>
        <div class="font-bold text-brand-blue truncate">
          ({{ resolvedShape.join(', ') }})
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Memory Stride Vector</div>
        <div class="font-bold text-ink truncate">
          ({{ computedStrides.join(', ') }}) bytes
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Memory Order</div>
        <div class="font-bold text-brand-amber truncate">
          {{ memoryOrder === 'C' ? 'C-Contiguous (Row-Major)' : 'Fortran (Col-Major)' }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Invariant Verification</div>
        <div class="font-bold text-brand-green truncate" title="arr.size == np.prod(new_shape)">
          12 == {{ resolvedShape.reduce((a, b) => a * b, 1) }} ✓
        </div>
      </div>
    </div>
  </div>
</template>

