<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Box, Layers, RotateCcw, Info, Sparkles } from 'lucide-vue-next'
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

// Dimension selector: 1D (Vector, (6,)), 2D (Matrix, (2, 3)), 3D (Tensor, (2, 2, 3))
type DimChoice = '1D' | '2D' | '3D'
const activeDim = ref<DimChoice>('2D')

// 12 element values
const cubeValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]
const selectedIndex = ref<number | null>(null)

interface NodeItem {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  idx: number
  val: number
  targetPos: THREE.Vector3
  targetScale: number
  targetOpacity: number
}

const nodes: NodeItem[] = []
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animFrameId = 0
let axesGroup: THREE.Group | null = null
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2(-999, -999)

const initialCameraPos = new THREE.Vector3(5.5, 4.8, 7.2)
const initialTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

// Dimension Metadata
const dimMetadata = computed(() => {
  if (activeDim.value === '1D') {
    return {
      ndim: 1,
      shape: '(6,)',
      size: 6,
      dtype: 'int32',
      itemsize: '4 bytes',
      nbytes: '24 bytes',
      title: '1D Vector (Rank-1 Tensor)'
    }
  } else if (activeDim.value === '2D') {
    return {
      ndim: 2,
      shape: '(2, 3)',
      size: 6,
      dtype: 'int32',
      itemsize: '4 bytes',
      nbytes: '24 bytes',
      title: '2D Matrix (Rank-2 Tensor)'
    }
  } else {
    return {
      ndim: 3,
      shape: '(2, 2, 3)',
      size: 12,
      dtype: 'int32',
      itemsize: '4 bytes',
      nbytes: '48 bytes',
      title: '3D Volume (Rank-3 Tensor)'
    }
  }
})

const activeCodeSnippet = computed(() => {
  if (activeDim.value === '1D') {
    return `# 1D Vector (Rank-1)
import numpy as np

arr = np.array([10, 20, 30, 40, 50, 60], dtype=np.int32)
print("ndim:", arr.ndim)      # 1
print("shape:", arr.shape)    # (6,)
print("size:", arr.size)      # 6
print("nbytes:", arr.nbytes)  # 24 bytes`
  } else if (activeDim.value === '2D') {
    return `# 2D Matrix (Rank-2)
import numpy as np

arr = np.array([
    [10, 20, 30],
    [40, 50, 60]
], dtype=np.int32)
print("ndim:", arr.ndim)      # 2
print("shape:", arr.shape)    # (2, 3)
print("size:", arr.size)      # 6
print("nbytes:", arr.nbytes)  # 24 bytes`
  } else {
    return `# 3D Tensor (Rank-3 Volume: 2 sheets, 2 rows, 3 cols)
import numpy as np

arr = np.array([
    [[10, 20, 30], [40, 50, 60]],
    [[70, 80, 90], [100, 110, 120]]
], dtype=np.int32)
print("ndim:", arr.ndim)      # 3
print("shape:", arr.shape)    # (2, 2, 3)
print("size:", arr.size)      # 12 elements`
  }
})

// Palette definition
const cubeColors = [
  { bg: '#ffffff', text: '#1e40af', border: '#3b82f6' }, // Sheet 0
  { bg: '#ffffff', text: '#065f46', border: '#10b981' }  // Sheet 1
]

// Three.js Initialization
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

  const dirLight2 = new THREE.DirectionalLight(0xbfdbfe, 0.4)
  dirLight2.position.set(-8, -4, -6)
  scene.add(dirLight2)

  axesGroup = new THREE.Group()
  scene.add(axesGroup)

  buildCubes()
  updateTargets()
  snapToTargets()
  renderAxes()

  const animate = () => {
    animFrameId = requestAnimationFrame(animate)

    for (const node of nodes) {
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

// Build 12 reusable cube nodes
const buildCubes = () => {
  if (!scene) return

  nodes.forEach(n => {
    scene?.remove(n.mesh)
    n.mesh.geometry.dispose()
    ;(n.mesh.material as THREE.Material).dispose()
    n.wireframe.geometry.dispose()
  })
  nodes.length = 0

  const boxGeom = new THREE.BoxGeometry(0.85, 0.85, 0.85)
  const edgesGeom = new THREE.EdgesGeometry(boxGeom)

  for (let i = 0; i < 12; i++) {
    const val = cubeValues[i]
    const p = i < 6 ? cubeColors[0] : cubeColors[1]
    const tex = createNumberTexture(val, p.bg, p.text, p.border)

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.95
    })
    const mesh = new THREE.Mesh(boxGeom, mat)

    const wireMat = new THREE.LineBasicMaterial({
      color: isDark.value ? 0xffffff : 0x1b2430,
      transparent: true,
      opacity: 0.3
    })
    const wireframe = new THREE.LineSegments(edgesGeom, wireMat)
    mesh.add(wireframe)

    mesh.userData = { idx: i, val }
    scene.add(mesh)

    nodes.push({
      mesh,
      wireframe,
      idx: i,
      val,
      targetPos: new THREE.Vector3(),
      targetScale: 1,
      targetOpacity: 1
    })
  }
}

// Calculate target positions according to active dimension
const updateTargets = () => {
  const spacingX = 1.05
  const spacingY = 1.05
  const spacingZ = 1.35

  if (activeDim.value === '1D') {
    // 6 cubes in a single line along X
    const offsetX = ((6 - 1) * spacingX) / 2
    for (let i = 0; i < 12; i++) {
      const node = nodes[i]
      if (i < 6) {
        node.targetPos.set(i * spacingX - offsetX, 0, 0)
        node.targetScale = 1
        node.targetOpacity = 0.95
      } else {
        node.targetPos.set(0, 0, 0)
        node.targetScale = 0.001
        node.targetOpacity = 0
      }
    }
  } else if (activeDim.value === '2D') {
    // 2 rows x 3 cols = 6 cubes (Y, X)
    const offsetX = ((3 - 1) * spacingX) / 2
    const offsetY = ((2 - 1) * spacingY) / 2

    for (let i = 0; i < 12; i++) {
      const node = nodes[i]
      if (i < 6) {
        const r = Math.floor(i / 3) // 0 or 1
        const c = i % 3            // 0, 1, 2
        // Row 0 at top, row 1 at bottom
        node.targetPos.set(c * spacingX - offsetX, (1 - r) * spacingY - offsetY, 0)
        node.targetScale = 1
        node.targetOpacity = 0.95
      } else {
        node.targetPos.set(0, 0, 0)
        node.targetScale = 0.001
        node.targetOpacity = 0
      }
    }
  } else {
    // 3D: (2 sheets, 2 rows, 3 cols) = 12 cubes
    const offsetX = ((3 - 1) * spacingX) / 2
    const offsetY = ((2 - 1) * spacingY) / 2
    const offsetZ = ((2 - 1) * spacingZ) / 2

    for (let i = 0; i < 12; i++) {
      const node = nodes[i]
      const s = Math.floor(i / 6) // sheet 0 or 1
      const rem = i % 6
      const r = Math.floor(rem / 3) // row 0 or 1
      const c = rem % 3            // col 0, 1, 2

      node.targetPos.set(
        c * spacingX - offsetX,
        (1 - r) * spacingY - offsetY,
        (s === 0 ? 1 : -1) * offsetZ
      )
      node.targetScale = 1
      node.targetOpacity = 0.95
    }
  }
}

const snapToTargets = () => {
  for (const node of nodes) {
    node.mesh.position.copy(node.targetPos)
    node.mesh.scale.set(node.targetScale, node.targetScale, node.targetScale)
    ;(node.mesh.material as THREE.MeshBasicMaterial).opacity = node.targetOpacity
  }
}

// Render Coordinate Axes at bottom-back-left
const renderAxes = () => {
  if (!scene || !axesGroup) return

  while (axesGroup.children.length > 0) {
    const obj = axesGroup.children[0]
    axesGroup.remove(obj)
  }

  // Position anchored at bottom-back-left
  const origin = new THREE.Vector3(-2.8, -1.8, -1.8)

  if (activeDim.value === '1D') {
    // Axis 0 along X
    const arrowX = createBoldArrow(origin, new THREE.Vector3(1, 0, 0), 3.2, 0x2563eb)
    axesGroup.add(arrowX)
    const labelX = createTextSprite('axis 0 (cols: 6)', 0x2563eb)
    labelX.position.set(origin.x + 3.6, origin.y, origin.z)
    axesGroup.add(labelX)
  } else if (activeDim.value === '2D') {
    // Axis 1 across columns (X)
    const arrowX = createBoldArrow(origin, new THREE.Vector3(1, 0, 0), 3.2, 0x2563eb)
    axesGroup.add(arrowX)
    const labelX = createTextSprite('axis 1 (cols: 3)', 0x2563eb)
    labelX.position.set(origin.x + 3.6, origin.y, origin.z)
    axesGroup.add(labelX)

    // Axis 0 down rows (Y - inverted or standard)
    const arrowY = createBoldArrow(origin, new THREE.Vector3(0, 1, 0), 2.5, 0x10b981)
    axesGroup.add(arrowY)
    const labelY = createTextSprite('axis 0 (rows: 2)', 0x10b981)
    labelY.position.set(origin.x, origin.y + 2.8, origin.z)
    axesGroup.add(labelY)
  } else {
    // 3D: Axis 0 (depth / sheets Z), Axis 1 (rows Y), Axis 2 (cols X)
    const arrowX = createBoldArrow(origin, new THREE.Vector3(1, 0, 0), 3.2, 0x2563eb)
    axesGroup.add(arrowX)
    const labelX = createTextSprite('axis 2 (cols: 3)', 0x2563eb)
    labelX.position.set(origin.x + 3.6, origin.y, origin.z)
    axesGroup.add(labelX)

    const arrowY = createBoldArrow(origin, new THREE.Vector3(0, 1, 0), 2.5, 0x10b981)
    axesGroup.add(arrowY)
    const labelY = createTextSprite('axis 1 (rows: 2)', 0x10b981)
    labelY.position.set(origin.x, origin.y + 2.8, origin.z)
    axesGroup.add(labelY)

    const arrowZ = createBoldArrow(origin, new THREE.Vector3(0, 0, 1), 2.5, 0xf59e0b)
    axesGroup.add(arrowZ)
    const labelZ = createTextSprite('axis 0 (depth: 2)', 0xf59e0b)
    labelZ.position.set(origin.x, origin.y, origin.z + 2.8)
    axesGroup.add(labelZ)
  }
}

// Raycasting click to inspect cube
const onPointerDown = (event: MouseEvent) => {
  if (!canvasRef.value || !camera) return

  const rect = canvasRef.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const meshes = nodes.filter(n => n.targetScale > 0.1).map(n => n.mesh)
  const intersects = raycaster.intersectObjects(meshes, false)

  if (intersects.length > 0) {
    const hitMesh = intersects[0].object as THREE.Mesh
    const idx = hitMesh.userData.idx
    selectedIndex.value = idx
    emitInspectInfo()
  }
}

const emitInspectInfo = () => {
  const meta = dimMetadata.value
  let coords = '[0]'
  if (selectedIndex.value !== null) {
    const i = selectedIndex.value
    if (activeDim.value === '1D') {
      coords = `[${i}]`
    } else if (activeDim.value === '2D') {
      coords = `[${Math.floor(i / 3)}, ${i % 3}]`
    } else {
      coords = `[${Math.floor(i / 6)}, ${Math.floor((i % 6) / 3)}, ${(i % 6) % 3}]`
    }
  }

  emit('inspect', {
    title: meta.title,
    details: {
      'arr.ndim': meta.ndim,
      'arr.shape': meta.shape,
      'arr.size': meta.size,
      'arr.dtype': meta.dtype,
      'arr.itemsize': meta.itemsize,
      'Total Memory (nbytes)': meta.nbytes,
      'Active Coordinate': selectedIndex.value !== null ? coords : 'Click any block',
      'Memory Value': selectedIndex.value !== null ? cubeValues[selectedIndex.value] : 'None'
    }
  })
}

const setDimension = (dim: DimChoice) => {
  activeDim.value = dim
  selectedIndex.value = null
  updateTargets()
  renderAxes()
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
    renderAxes()
  }
})

onMounted(() => {
  initThree()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (animFrameId) cancelAnimationFrame(animFrameId)
  renderer?.dispose()
})
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <!-- Top Action Toolbar -->
    <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
      <!-- Dimension Selector Pills -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">Dimension:</span>
        <button
          type="button"
          @click="setDimension('1D')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeDim === '1D' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          1D (Vector, (6,))
        </button>
        <button
          type="button"
          @click="setDimension('2D')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeDim === '2D' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          2D (Matrix, (2, 3))
        </button>
        <button
          type="button"
          @click="setDimension('3D')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeDim === '3D' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          3D (Tensor, (2, 2, 3))
        </button>
      </div>

      <!-- Quick Telemetry Badge -->
      <div class="flex items-center gap-2 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <span class="w-2 h-2 rounded-full bg-brand-blue" />
        <span class="font-bold text-ink">{{ dimMetadata.shape }}</span>
        <span class="text-muted text-[11px]">• ndim={{ dimMetadata.ndim }} • {{ dimMetadata.size }} items</span>
      </div>
    </div>

    <!-- Main 3D Viewport -->
    <div class="relative w-full rounded-lg border border-line bg-stage shadow-xs min-h-[420px] h-[460px] overflow-hidden select-none">
      <div ref="containerRef" class="w-full h-full relative cursor-grab active:cursor-grabbing">
        <canvas ref="canvasRef" @pointerdown="onPointerDown" class="w-full h-full block" />

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
            <span class="text-muted text-[11px]">ndim (axes):</span>
            <span class="font-bold text-ink">{{ dimMetadata.ndim }}</span>
          </div>
          <div class="flex items-center justify-between gap-4 border-b border-line/60 pb-1">
            <span class="text-muted text-[11px]">shape tuple:</span>
            <span class="font-bold text-brand-blue">{{ dimMetadata.shape }}</span>
          </div>
          <div class="flex items-center justify-between gap-4 border-b border-line/60 pb-1">
            <span class="text-muted text-[11px]">size (count):</span>
            <span class="font-bold text-ink">{{ dimMetadata.size }}</span>
          </div>
          <div class="flex items-center justify-between gap-4">
            <span class="text-muted text-[11px]">dtype / nbytes:</span>
            <span class="font-bold text-emerald-600 dark:text-emerald-400">{{ dimMetadata.dtype }} ({{ dimMetadata.nbytes }})</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active Array Invariant:</span>
        <span class="text-brand-blue font-semibold">Homogeneous Contiguous Memory Buffer</span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ activeCodeSnippet }}</code></pre>
    </div>
  </div>
</template>

