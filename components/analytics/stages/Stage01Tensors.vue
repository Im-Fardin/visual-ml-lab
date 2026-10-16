<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Play, Pause, StepForward, RotateCcw } from 'lucide-vue-next'
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

// Simulation State: 0D to 6D
type DimensionMode = 0 | 1 | 2 | 3 | 4 | 5 | 6
const currentDim = ref<DimensionMode>(3)
const isPlaying = ref(false)

// Maximum elements needed across all dimensions:
// 0D: 1 | 1D: 4 | 2D: 12 (3x4) | 3D: 18 (2x3x3) | 4D: 36 (2x2x3x3) | 5D: 72 (2x2x2x3x3) | 6D: 64 (2x2x2x2x2x2)
const MAX_NODES = 72

interface TensorNode {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  idx: number
  value: number
  targetPos: THREE.Vector3
  targetScale: number
  targetOpacity: number
  meta: Record<string, any>
}

const tensorNodes: TensorNode[] = []
let boundingCagesGroup: THREE.Group | null = null
let enclosingAxesGroup: THREE.Group | null = null

const selectedItem = ref<{ dim: number; val: number; coords: string; desc: string }>({
  dim: 3,
  val: 42,
  coords: '[0, 1, 1]',
  desc: '3D Volume element'
})

// Three.js instances
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animFrameId = 0
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2(-999, -999)

const initialCameraPos = new THREE.Vector3(0.8, 1.2, 8.8)
const initialCameraTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

// Dimension telemetry computations
const telemetryShape = computed(() => {
  switch (currentDim.value) {
    case 0:
      return '()'
    case 1:
      return '(4,)'
    case 2:
      return '(3, 4)'
    case 3:
      return '(2, 3, 3)'
    case 4:
      return '(2, 2, 3, 3)'
    case 5:
      return '(2, 2, 2, 3, 3)'
    case 6:
      return '(2, 2, 2, 2, 2, 2)'
  }
})

const telemetryElements = computed(() => {
  switch (currentDim.value) {
    case 0:
      return 1
    case 1:
      return 4
    case 2:
      return 12
    case 3:
      return 18
    case 4:
      return 36
    case 5:
      return 72
    case 6:
      return 64
  }
})

const realWorldContext = computed(() => {
  switch (currentDim.value) {
    case 0:
      return { title: '0D Scalar', desc: 'Single magnitude without direction or index (e.g. loss = 0.042)' }
    case 1:
      return { title: '1D Vector', desc: 'Linear sequence of values (e.g. word embeddings or bias vector v ∈ ℝ⁴)' }
    case 2:
      return { title: '2D Matrix', desc: 'Planar table with rows and columns (e.g. tabular weights W ∈ ℝ³ˣ⁴)' }
    case 3:
      return { title: '3D Volume', desc: 'Stacked 2D sheets (e.g. single RGB image (3, H, W) or depth voxel)' }
    case 4:
      return { title: '4D Batch of Volumes', desc: 'Batched images in PyTorch (B, C, H, W) or audio spectrograms' }
    case 5:
      return { title: '5D Matrix of Volumes', desc: 'Video datasets (Batch, Frames, Channels, Height, Width) or MRI scans' }
    case 6:
      return { title: '6D Hyper-Lattice', desc: 'Autonomous driving: (Cameras, Episodes, Timesteps, Channels, H, W)' }
  }
})

const clusterColors = [
  { bg: '#ffffff', text: '#1e40af', border: '#2563eb' },
  { bg: '#ffffff', text: '#7c3aed', border: '#8b5cf6' },
  { bg: '#ffffff', text: '#059669', border: '#10b981' },
  { bg: '#ffffff', text: '#ea580c', border: '#f97316' }
]

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
  controls.dampingFactor = 0.06
  controls.minPolarAngle = 0.2
  controls.maxPolarAngle = Math.PI / 2 + 0.1
  controls.target.copy(initialCameraTarget)

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, isDark.value ? 1.5 : 1.3)
  scene.add(ambientLight)

  const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.1)
  dirLight1.position.set(10, 14, 12)
  scene.add(dirLight1)

  const dirLight2 = new THREE.DirectionalLight(0xbfdbfe, 0.45)
  dirLight2.position.set(-10, -6, -8)
  scene.add(dirLight2)

  // Floor Grid
  const gridHelper = new THREE.GridHelper(20, 20, isDark.value ? 0x2b3340 : 0xd1d5db, isDark.value ? 0x1f242e : 0xe5e7eb)
  gridHelper.position.y = -2.6
  scene.add(gridHelper)

  boundingCagesGroup = new THREE.Group()
  scene.add(boundingCagesGroup)

  enclosingAxesGroup = new THREE.Group()
  scene.add(enclosingAxesGroup)

  buildReusableCubes()
  updateTargets()
  snapToTargets()

  const animate = () => {
    animFrameId = requestAnimationFrame(animate)

    for (const node of tensorNodes) {
      node.mesh.position.lerp(node.targetPos, 0.1)
      const currentScale = node.mesh.scale.x
      const nextScale = THREE.MathUtils.lerp(currentScale, node.targetScale, 0.1)
      node.mesh.scale.set(nextScale, nextScale, nextScale)

      const mat = node.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, node.targetOpacity, 0.1)
    }

    controls?.update()
    renderer?.render(scene!, camera!)
  }

  animate()
  emitInspectInfo()
}

// Build 72 reusable cubes with sharp textures
const buildReusableCubes = () => {
  if (!scene) return

  tensorNodes.forEach((n) => {
    scene?.remove(n.mesh)
    n.mesh.geometry.dispose()
    ;(n.mesh.material as THREE.Material).dispose()
    n.wireframe.geometry.dispose()
  })
  tensorNodes.length = 0

  const boxGeom = new THREE.BoxGeometry(0.85, 0.85, 0.85)
  const edgesGeom = new THREE.EdgesGeometry(boxGeom)

  for (let i = 0; i < MAX_NODES; i++) {
    const val = i === 0 ? 42 : (i * 7) % 89 + 10
    const palette = clusterColors[i % clusterColors.length]
    const tex = createNumberTexture(val, palette.bg, palette.text, palette.border)

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.95
    })
    const mesh = new THREE.Mesh(boxGeom, mat)

    const wireMat = new THREE.LineBasicMaterial({
      color: isDark.value ? 0xffffff : 0x1b2430,
      transparent: true,
      opacity: 0.25
    })
    const wireframe = new THREE.LineSegments(edgesGeom, wireMat)
    mesh.add(wireframe)

    mesh.userData = { idx: i, val }
    scene.add(mesh)

    tensorNodes.push({
      mesh,
      wireframe,
      idx: i,
      value: val,
      targetPos: new THREE.Vector3(),
      targetScale: 1,
      targetOpacity: 0.95,
      meta: {}
    })
  }
}

// Compute Compact Spatial Packaging for 0D..6D
const updateTargets = () => {
  const dim = currentDim.value
  const activeCount = telemetryElements.value

  // Deactivate unused nodes
  for (let i = activeCount; i < MAX_NODES; i++) {
    tensorNodes[i].targetPos.set(0, 0, 0)
    tensorNodes[i].targetScale = 0.001
    tensorNodes[i].targetOpacity = 0.0
  }

  if (dim === 0) {
    // 0D — Scalar ()
    const node = tensorNodes[0]
    node.targetPos.set(0, 0, 0)
    node.targetScale = 1.55
    node.targetOpacity = 1.0
    node.meta = { coords: '()' }
  } else if (dim === 1) {
    // 1D — Vector (4,)
    for (let c = 0; c < 4; c++) {
      const node = tensorNodes[c]
      node.targetPos.set((c - 1.5) * 1.25, 0, 0)
      node.targetScale = 1.05
      node.targetOpacity = 1.0
      node.meta = { coords: `[${c}]` }
    }
  } else if (dim === 2) {
    // 2D — Matrix (3, 4)
    let idx = 0
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const node = tensorNodes[idx++]
        node.targetPos.set((c - 1.5) * 1.2, -(r - 1.0) * 1.2, 0)
        node.targetScale = 0.96
        node.targetOpacity = 1.0
        node.meta = { coords: `[${r}, ${c}]` }
      }
    }
  } else if (dim === 3) {
    // 3D — Volume (2, 3, 3) = 18 cubes
    let idx = 0
    for (let d = 0; d < 2; d++) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const node = tensorNodes[idx++]
          node.targetPos.set((c - 1.0) * 1.15, -(r - 1.0) * 1.15, (d - 0.5) * 1.45)
          node.targetScale = 0.92
          node.targetOpacity = 1.0
          node.meta = { coords: `[${d}, ${r}, ${c}]` }
        }
      }
    }
  } else if (dim === 4) {
    // 4D — Compact Batch of Volumes (2, 2, 3, 3) = 36 cubes
    // 2 volumes side-by-side along X with tight gap ~ 1.1 x cubeWidth
    let idx = 0
    const batchDist = 3.65 // tight separation
    for (let b = 0; b < 2; b++) {
      const batchX = (b - 0.5) * batchDist
      for (let d = 0; d < 2; d++) {
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            const node = tensorNodes[idx++]
            node.targetPos.set(batchX + (c - 1.0) * 1.05, -(r - 1.0) * 1.05, (d - 0.5) * 1.35)
            node.targetScale = 0.82
            node.targetOpacity = 1.0
            node.meta = { coords: `[${b}, ${d}, ${r}, ${c}]`, batch: b }
          }
        }
      }
    }
  } else if (dim === 5) {
    // 5D — Compact 2D Grid of Volumes (2, 2, 2, 3, 3) = 72 cubes
    // 2 x 2 planar array of 3D volumes on X-Z plane, tight gap 1.0 x cubeWidth
    let idx = 0
    const gridDistX = 3.3
    const gridDistZ = 2.7
    for (let b1 = 0; b1 < 2; b1++) {
      const bZ = (b1 - 0.5) * gridDistZ
      for (let b0 = 0; b0 < 2; b0++) {
        const bX = (b0 - 0.5) * gridDistX
        for (let d = 0; d < 2; d++) {
          for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
              const node = tensorNodes[idx++]
              node.targetPos.set(bX + (c - 1.0) * 0.85, -(r - 1.0) * 0.85, bZ + (d - 0.5) * 1.05)
              node.targetScale = 0.68
              node.targetOpacity = 0.98
              node.meta = { coords: `[${b1}, ${b0}, ${d}, ${r}, ${c}]` }
            }
          }
        }
      }
    }
  } else if (dim === 6) {
    // 6D — Compact 3D Volume of Volumes (2, 2, 2, 2, 2, 2) = 64 cubes
    // 2 x 2 x 2 cubic super-lattice resembling a cohesive Rubik's-cube formation
    let idx = 0
    const latDist = 1.95 // tight packaging of mini-volumes
    for (let b2 = 0; b2 < 2; b2++) {
      const bY = -(b2 - 0.5) * latDist
      for (let b1 = 0; b1 < 2; b1++) {
        const bZ = (b1 - 0.5) * latDist
        for (let b0 = 0; b0 < 2; b0++) {
          const bX = (b0 - 0.5) * latDist
          for (let d = 0; d < 2; d++) {
            for (let r = 0; r < 2; r++) {
              for (let c = 0; c < 2; c++) {
                const node = tensorNodes[idx++]
                node.targetPos.set(bX + (c - 0.5) * 0.65, bY - (r - 0.5) * 0.65, bZ + (d - 0.5) * 0.65)
                node.targetScale = 0.48
                node.targetOpacity = 0.95
                node.meta = { coords: `[${b2}, ${b1}, ${b0}, ${d}, ${r}, ${c}]` }
              }
            }
          }
        }
      }
    }
  }

  // Update Wireframe Bounding Cages & Enclosing Frame Axes
  updateBoundingCages()
  updateEnclosingAxes()
}

// Bounding Wireframe Cages for Multi-Volume Formations
const updateBoundingCages = () => {
  if (!boundingCagesGroup) return

  while (boundingCagesGroup.children.length > 0) {
    const child = boundingCagesGroup.children[0]
    boundingCagesGroup.remove(child)
  }

  const dim = currentDim.value

  if (dim === 4) {
    // 2 Sub-volume cages labeled Batch 0 and Batch 1
    const batchDist = 3.65
    for (let b = 0; b < 2; b++) {
      const cx = (b - 0.5) * batchDist
      const box = new THREE.Box3(
        new THREE.Vector3(cx - 1.45, -1.35, -1.0),
        new THREE.Vector3(cx + 1.45, 1.35, 1.0)
      )
      const helper = new THREE.Box3Helper(box, new THREE.Color(b === 0 ? 0x2563eb : 0x7c3aed))
      boundingCagesGroup.add(helper)

      const label = createTextSprite(`Batch ${b}`, b === 0 ? '#2563eb' : '#7c3aed', 42)
      label.position.set(cx, 1.7, 0)
      boundingCagesGroup.add(label)
    }
  } else if (dim === 5) {
    // Shared outer envelope and 4 compact block labels
    const outerBox = new THREE.Box3(
      new THREE.Vector3(-3.2, -1.2, -2.5),
      new THREE.Vector3(3.2, 1.2, 2.5)
    )
    const outerHelper = new THREE.Box3Helper(outerBox, new THREE.Color(0x059669))
    boundingCagesGroup.add(outerHelper)

    const label = createTextSprite('5D Tensor Grid [2×2 Blocks]', '#059669', 38)
    label.position.set(0, 1.6, 0)
    boundingCagesGroup.add(label)
  } else if (dim === 6) {
    // Rubik's-cube-like outer super-cube cage
    const superBox = new THREE.Box3(
      new THREE.Vector3(-1.8, -1.8, -1.8),
      new THREE.Vector3(1.8, 1.8, 1.8)
    )
    const superHelper = new THREE.Box3Helper(superBox, new THREE.Color(0xa855f7))
    boundingCagesGroup.add(superHelper)

    const label = createTextSprite('6D Super-Lattice [8 Volumes]', '#a855f7', 38)
    label.position.set(0, 2.2, 0)
    boundingCagesGroup.add(label)
  }
}

// Bounding-Frame Coordinate Axes: Origin at bottom-back-left, hugging outer perimeter
const updateEnclosingAxes = () => {
  if (!enclosingAxesGroup) return

  while (enclosingAxesGroup.children.length > 0) {
    const child = enclosingAxesGroup.children[0]
    enclosingAxesGroup.remove(child)
  }

  const activeCount = telemetryElements.value
  if (activeCount === 0) return

  // Compute bounding box of active cubes
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  for (let i = 0; i < activeCount; i++) {
    const pos = tensorNodes[i].targetPos
    minX = Math.min(minX, pos.x)
    maxX = Math.max(maxX, pos.x)
    minY = Math.min(minY, pos.y)
    maxY = Math.max(maxY, pos.y)
    minZ = Math.min(minZ, pos.z)
    maxZ = Math.max(maxZ, pos.z)
  }

  const sampleScale = tensorNodes[0].targetScale
  const halfW = (sampleScale * 0.85) / 2
  const clearance = 0.38

  // Bottom-back-left corner origin
  const originX = minX - halfW - clearance
  const originY = minY - halfW - clearance
  const originZ = minZ - halfW - clearance

  enclosingAxesGroup.position.set(originX, originY, originZ)

  // Arrow lengths spanning matrix dimensions plus small margin
  const marginExtra = 0.65
  const lenX = Math.max(1.8, (maxX - minX) + halfW * 2 + clearance + marginExtra)
  const lenY = Math.max(1.8, (maxY - minY) + halfW * 2 + clearance + marginExtra)
  const lenZ = Math.max(1.8, (maxZ - minZ) + halfW * 2 + clearance + marginExtra)

  // X Axis (Red / Coral - Columns): Points Right (+X)
  const arrowX = createBoldArrow(new THREE.Vector3(1, 0, 0), lenX, 0xef4444, 'axis X (Cols)', 0.055, 0.16, 0.35)
  enclosingAxesGroup.add(arrowX)

  // Y Axis (Green / Emerald - Rows): Points Up (+Y)
  if (currentDim.value >= 1) {
    const arrowY = createBoldArrow(new THREE.Vector3(0, 1, 0), lenY, 0x10b981, 'axis Y (Rows)', 0.055, 0.16, 0.35)
    enclosingAxesGroup.add(arrowY)
  }

  // Z Axis (Blue / Sapphire - Depth): Points Forward (+Z)
  if (currentDim.value >= 2) {
    const arrowZ = createBoldArrow(new THREE.Vector3(0, 0, 1), lenZ, 0x3b82f6, 'axis Z (Depth)', 0.055, 0.16, 0.35)
    enclosingAxesGroup.add(arrowZ)
  }
}

const snapToTargets = () => {
  for (const node of tensorNodes) {
    node.mesh.position.copy(node.targetPos)
    node.mesh.scale.set(node.targetScale, node.targetScale, node.targetScale)
    ;(node.mesh.material as THREE.MeshBasicMaterial).opacity = node.targetOpacity
  }
}

// User Actions
const setDimension = (dim: DimensionMode) => {
  currentDim.value = dim
  updateTargets()
  emitInspectInfo()
}

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) runAutoPlayCycle()
}

let playTimer: ReturnType<typeof setTimeout> | null = null

const runAutoPlayCycle = () => {
  if (!isPlaying.value) return
  let nextDim = ((currentDim.value + 1) % 7) as DimensionMode
  setDimension(nextDim)

  playTimer = setTimeout(() => {
    if (isPlaying.value) runAutoPlayCycle()
  }, 2600)
}

const stepDimension = () => {
  isPlaying.value = false
  const next = ((currentDim.value + 1) % 7) as DimensionMode
  setDimension(next)
}

const resetSimulation = () => {
  isPlaying.value = false
  if (playTimer) clearTimeout(playTimer)
  currentDim.value = 3
  updateTargets()
  resetCamera()
  emitInspectInfo()
}

const resetCamera = () => {
  if (!camera || !controls) return
  camera.position.copy(initialCameraPos)
  controls.target.copy(initialCameraTarget)
  controls.update()
}

// Raycasting / Click Handlers
const onPointerDown = (event: MouseEvent) => {
  if (!canvasRef.value || !camera) return

  const rect = canvasRef.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const activeMeshes = tensorNodes.slice(0, telemetryElements.value).map((n) => n.mesh)
  const intersects = raycaster.intersectObjects(activeMeshes, false)

  if (intersects.length > 0) {
    const clickedMesh = intersects[0].object as THREE.Mesh
    const data = clickedMesh.userData
    if (data !== undefined) {
      const node = tensorNodes[data.idx]
      selectedItem.value = {
        dim: currentDim.value,
        val: data.val,
        coords: node.meta.coords || `[${data.idx}]`,
        desc: realWorldContext.value.desc
      }
      emitInspectInfo()
    }
  }
}

const emitInspectInfo = () => {
  const d = currentDim.value
  emit('inspect', {
    title: `${d}D Tensor Element: ${selectedItem.value.coords}`,
    details: {
      Value: selectedItem.value.val,
      'Active Rank (ndim)': `${d}D`,
      Shape: telemetryShape.value,
      'Index Coordinates': selectedItem.value.coords,
      'Total Elements': `${telemetryElements.value} cubes in memory`,
      'Domain Example': realWorldContext.value.desc
    }
  })
}

onMounted(() => {
  initThree()
  window.addEventListener('resize', onWindowResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onWindowResize)
  cancelAnimationFrame(animFrameId)
  if (playTimer) clearTimeout(playTimer)
  if (controls) controls.dispose()
  if (renderer) renderer.dispose()
})

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
    updateEnclosingAxes()
  }
})
</script>

<template>
  <div class="flex flex-col gap-2.5 w-full">
    <!-- Viewport Container strictly clamped to 46vh for laptop-first ergonomics -->
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
        <!-- Top Toolbar: 0D to 6D Hierarchy Switches -->
        <div class="flex items-center gap-1 bg-card/90 backdrop-blur-md p-1 rounded-md border border-line shadow-xs self-start pointer-events-auto text-xs font-mono">
          <button
            v-for="d in [0, 1, 2, 3, 4, 5, 6]"
            :key="d"
            type="button"
            @click="setDimension(d as DimensionMode)"
            class="px-2 py-0.5 rounded transition-colors font-medium"
            :class="currentDim === d ? 'bg-brand-blue text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
          >
            {{ d }}D
          </button>
          <span class="text-line mx-1">|</span>
          <span class="text-[11px] font-bold text-brand-blue pr-1">{{ realWorldContext.title }}</span>
        </div>

        <!-- Bottom Left: Enclosing Bounding Axes Legend -->
        <div class="self-start text-[10px] font-mono bg-card/90 backdrop-blur-md border border-line px-2.5 py-1 rounded shadow-xs flex items-center gap-2">
          <span class="text-muted font-bold">Bounding Axes:</span>
          <span class="text-red-500 font-semibold">X (Cols →)</span>
          <span v-if="currentDim >= 1" class="text-emerald-500 font-semibold">Y (Rows ↑)</span>
          <span v-if="currentDim >= 2" class="text-blue-500 font-semibold">Z (Depth ↗)</span>
        </div>

        <!-- 360 Orbit & Inspect Hint -->
        <div class="absolute top-2.5 right-2.5 text-[0.68rem] text-muted bg-card/90 border border-line px-2 py-0.5 rounded select-none pointer-events-none hidden sm:block">
          Drag: Orbit 360° • Click: Inspect Element
        </div>
      </div>
    </div>

    <!-- Compact Execution Control Toolbar -->
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
          <span>{{ isPlaying ? 'Pause' : 'Play Morph' }}</span>
        </button>

        <button
          type="button"
          @click="stepDimension"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono font-medium text-ink transition-colors"
          title="Advance to next rank"
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

      <!-- Dimension Progress Slider (0D to 6D) -->
      <div class="flex items-center gap-2 text-xs font-mono text-muted">
        <span>0D</span>
        <input
          id="dimSlider"
          type="range"
          min="0"
          max="6"
          step="1"
          :value="currentDim"
          @input="setDimension(Number(($event.target as HTMLInputElement).value) as DimensionMode)"
          class="w-28 accent-brand-blue cursor-pointer"
        />
        <span>6D</span>
        <span class="font-bold text-brand-blue pl-1">{{ currentDim }}D</span>
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

    <!-- Fluid Telemetry HUD Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Shape (ndim: {{ currentDim }})</div>
        <div class="font-bold text-brand-blue truncate" :title="telemetryShape">{{ telemetryShape }}</div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Memory Elements</div>
        <div class="font-bold text-ink truncate">{{ telemetryElements }} cubes in memory</div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Real-World Domain</div>
        <div class="font-bold text-brand-amber truncate" :title="realWorldContext.desc">
          {{ realWorldContext.title }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Tensor Type</div>
        <div class="font-bold text-brand-green truncate">
          {{ currentDim >= 4 ? 'Hyper-Tensor (Multi-Volume)' : (currentDim === 0 ? 'Scalar' : (currentDim === 1 ? 'Vector' : (currentDim === 2 ? 'Matrix' : '3D Volume'))) }}
        </div>
      </div>
    </div>
  </div>
</template>
