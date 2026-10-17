<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Play, Pause, StepForward, RotateCcw, Layers, Scissors, Merge, CheckCircle2 } from 'lucide-vue-next'
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

// 3x3 Array A (Values 1..9) and Array B (Values 10..18)
const dataA = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9]
]
const dataB = [
  [10, 11, 12],
  [13, 14, 15],
  [16, 17, 18]
]

type OperationMode = 'concat_axis0' | 'concat_axis1' | 'stack_axis0' | 'vsplit' | 'hsplit'
const activeOp = ref<OperationMode>('concat_axis0')

// Animation Pacing
const progress = ref(0) // 0 = separated / initial state, 1 = joined / docked
const isPlaying = ref(false)
const selectedCell = ref<{ array: 'A' | 'B'; r: number; c: number; val: number }>({
  array: 'A',
  r: 0,
  c: 0,
  val: 1
})

// Three.js instances
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animFrameId = 0
let floatingAxesGroup: THREE.Group | null = null
let splitLaserPlane: THREE.Mesh | null = null

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2(-999, -999)

const initialCameraPos = new THREE.Vector3(0.8, 1.0, 9.2)
const initialCameraTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

// Color styles
const styleA = { bg: '#ffffff', text: '#1e40af', border: '#2563eb' } // Array A (Blue)
const styleB = { bg: '#ffffff', text: '#92400e', border: '#d97706' } // Array B (Amber)

interface CubeNode {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  array: 'A' | 'B'
  r: number
  c: number
  val: number
  pos0: THREE.Vector3
  posTarget: THREE.Vector3
}

let cubesA: CubeNode[] = []
let cubesB: CubeNode[] = []
let allCubes: CubeNode[] = []

// Target Positions Calculation based on active operation
const computeOperationTrajectories = () => {
  const spacing = 1.3
  const op = activeOp.value

  if (op === 'concat_axis0') {
    // np.concatenate([A, B], axis=0) -> shape (6, 3)
    // Array A: rows 0..2 (top half), Array B: rows 3..5 (bottom half)
    // Initial: A sits higher (+1.8), B sits lower (-1.8)
    cubesA.forEach((node) => {
      const x = (node.c - 1) * spacing
      const yDocked = -(node.r - 2.5) * spacing
      const ySeparated = -(node.r - 1) * spacing + 1.8
      node.pos0.set(x, ySeparated, 0)
      node.posTarget.set(x, yDocked, 0)
    })

    cubesB.forEach((node) => {
      const x = (node.c - 1) * spacing
      const yDocked = -((node.r + 3) - 2.5) * spacing
      const ySeparated = -(node.r - 1) * spacing - 1.8
      node.pos0.set(x, ySeparated, 0)
      node.posTarget.set(x, yDocked, 0)
    })
  } else if (op === 'concat_axis1') {
    // np.concatenate([A, B], axis=1) -> shape (3, 6)
    // Array A: cols 0..2 (left half), Array B: cols 3..5 (right half)
    // Initial: A sits to left (-2.2), B sits to right (+2.2)
    cubesA.forEach((node) => {
      const y = -(node.r - 1) * spacing
      const xDocked = (node.c - 2.5) * spacing
      const xSeparated = (node.c - 1) * spacing - 2.2
      node.pos0.set(xSeparated, y, 0)
      node.posTarget.set(xDocked, y, 0)
    })

    cubesB.forEach((node) => {
      const y = -(node.r - 1) * spacing
      const xDocked = ((node.c + 3) - 2.5) * spacing
      const xSeparated = (node.c - 1) * spacing + 2.2
      node.pos0.set(xSeparated, y, 0)
      node.posTarget.set(xDocked, y, 0)
    })
  } else if (op === 'stack_axis0') {
    // np.stack([A, B], axis=0) -> shape (2, 3, 3) (ndim: 2 -> 3)
    // Array A: Sheet 0 (depth -1.1), Array B: Sheet 1 (depth +1.1)
    // Initial: A sits at (x - 2.2, y, 0), B sits at (x + 2.2, y, 0)
    cubesA.forEach((node) => {
      const x = (node.c - 1) * spacing
      const y = -(node.r - 1) * spacing
      node.pos0.set(x - 2.2, y, 0)
      node.posTarget.set(x, y, -1.1)
    })

    cubesB.forEach((node) => {
      const x = (node.c - 1) * spacing
      const y = -(node.r - 1) * spacing
      node.pos0.set(x + 2.2, y, 0)
      node.posTarget.set(x, y, 1.1)
    })
  } else if (op === 'vsplit') {
    // np.vsplit(C, 2): starts joined at (6, 3), slides apart vertically
    cubesA.forEach((node) => {
      const x = (node.c - 1) * spacing
      const yDocked = -(node.r - 2.5) * spacing
      const ySplit = yDocked + 1.2
      node.pos0.set(x, yDocked, 0)
      node.posTarget.set(x, ySplit, 0)
    })

    cubesB.forEach((node) => {
      const x = (node.c - 1) * spacing
      const yDocked = -((node.r + 3) - 2.5) * spacing
      const ySplit = yDocked - 1.2
      node.pos0.set(x, yDocked, 0)
      node.posTarget.set(x, ySplit, 0)
    })
  } else if (op === 'hsplit') {
    // np.hsplit(C, 2): starts joined at (3, 6), slides apart horizontally
    cubesA.forEach((node) => {
      const y = -(node.r - 1) * spacing
      const xDocked = (node.c - 2.5) * spacing
      const xSplit = xDocked - 1.4
      node.pos0.set(xDocked, y, 0)
      node.posTarget.set(xSplit, y, 0)
    })

    cubesB.forEach((node) => {
      const y = -(node.r - 1) * spacing
      const xDocked = ((node.c + 3) - 2.5) * spacing
      const xSplit = xDocked + 1.4
      node.pos0.set(xDocked, y, 0)
      node.posTarget.set(xSplit, y, 0)
    })
  }

  updateLaserPlane()
}

// Laser divider plane for splitting animations
const updateLaserPlane = () => {
  if (!scene) return

  if (splitLaserPlane) {
    scene.remove(splitLaserPlane)
    splitLaserPlane.geometry.dispose()
    ;(splitLaserPlane.material as THREE.Material).dispose()
    splitLaserPlane = null
  }

  if (activeOp.value === 'vsplit') {
    const geo = new THREE.PlaneGeometry(4.8, 0.08)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    })
    splitLaserPlane = new THREE.Mesh(geo, mat)
    splitLaserPlane.position.set(0, 0, 0.1)
    scene.add(splitLaserPlane)
  } else if (activeOp.value === 'hsplit') {
    const geo = new THREE.PlaneGeometry(0.08, 4.8)
    const mat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide
    })
    splitLaserPlane = new THREE.Mesh(geo, mat)
    splitLaserPlane.position.set(0, 0, 0.1)
    scene.add(splitLaserPlane)
  }
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

  const gridHelper = new THREE.GridHelper(18, 18, isDark.value ? 0x334155 : 0xcbd5e1, isDark.value ? 0x1e293b : 0xe2ded4)
  gridHelper.position.y = -2.6
  scene.add(gridHelper)

  floatingAxesGroup = new THREE.Group()
  scene.add(floatingAxesGroup)

  buildCubeArrays()
  computeOperationTrajectories()
  applyInterpolation(0)

  const animate = () => {
    animFrameId = requestAnimationFrame(animate)

    if (isPlaying.value) {
      // 2.0s smooth transition (0.008 per frame)
      progress.value += 0.008
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
  emitInspection()
}

// Build 3x3 Array A and 3x3 Array B
const buildCubeArrays = () => {
  if (!scene) return

  allCubes.forEach((node) => {
    scene?.remove(node.mesh)
    node.mesh.geometry.dispose()
    ;(node.mesh.material as THREE.Material).dispose()
    node.wireframe.geometry.dispose()
  })
  cubesA = []
  cubesB = []
  allCubes = []

  const cubeGeo = new THREE.BoxGeometry(0.95, 0.95, 0.95)
  const wireGeo = new THREE.EdgesGeometry(cubeGeo)

  // Array A (3x3 Blue)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const val = dataA[r][c]
      const tex = createNumberTexture(val, styleA.bg, styleA.text, styleA.border)
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: 1
      })
      const mesh = new THREE.Mesh(cubeGeo, mat)
      const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(styleA.border), linewidth: 1.5 })
      const wireframe = new THREE.LineSegments(wireGeo, wireMat)
      mesh.add(wireframe)

      mesh.userData = { array: 'A', r, c, val }
      scene.add(mesh)

      const entry: CubeNode = {
        mesh,
        wireframe,
        array: 'A',
        r,
        c,
        val,
        pos0: new THREE.Vector3(),
        posTarget: new THREE.Vector3()
      }
      cubesA.push(entry)
      allCubes.push(entry)
    }
  }

  // Array B (3x3 Amber)
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const val = dataB[r][c]
      const tex = createNumberTexture(val, styleB.bg, styleB.text, styleB.border)
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: 1
      })
      const mesh = new THREE.Mesh(cubeGeo, mat)
      const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(styleB.border), linewidth: 1.5 })
      const wireframe = new THREE.LineSegments(wireGeo, wireMat)
      mesh.add(wireframe)

      mesh.userData = { array: 'B', r, c, val }
      scene.add(mesh)

      const entry: CubeNode = {
        mesh,
        wireframe,
        array: 'B',
        r,
        c,
        val,
        pos0: new THREE.Vector3(),
        posTarget: new THREE.Vector3()
      }
      cubesB.push(entry)
      allCubes.push(entry)
    }
  }
}

// Interpolation between pos0 and posTarget
const applyInterpolation = (t: number) => {
  const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

  allCubes.forEach((node) => {
    node.mesh.position.lerpVectors(node.pos0, node.posTarget, eased)
  })

  // Pulsing laser plane opacity if splitting
  if (splitLaserPlane) {
    const mat = splitLaserPlane.material as THREE.MeshBasicMaterial
    mat.opacity = 0.3 + 0.6 * (1 - Math.abs(t - 0.5) * 2)
  }

  updateFloatingAxes()
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
  const lenZ = Math.max(1.8, maxZ - minZ + halfW * 2 + clearance + marginExtra)

  // X Axis (Cols)
  const arrowX = createBoldArrow(new THREE.Vector3(1, 0, 0), lenX, 0xef4444, 'axis X (Cols)', 0.055, 0.16, 0.35)
  floatingAxesGroup.add(arrowX)

  // Y Axis (Rows)
  const arrowY = createBoldArrow(new THREE.Vector3(0, 1, 0), lenY, 0x10b981, 'axis Y (Rows)', 0.055, 0.16, 0.35)
  floatingAxesGroup.add(arrowY)

  // Z Axis (Depth) if Stack
  if (activeOp.value === 'stack_axis0') {
    const arrowZ = createBoldArrow(new THREE.Vector3(0, 0, 1), lenZ, 0x3b82f6, 'axis Z (Depth)', 0.055, 0.16, 0.35)
    floatingAxesGroup.add(arrowZ)
  }
}

// User Actions
const switchOperation = (op: OperationMode) => {
  activeOp.value = op
  isPlaying.value = false
  progress.value = 0
  computeOperationTrajectories()
  applyInterpolation(0)
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
  progress.value = 0
  computeOperationTrajectories()
  applyInterpolation(0)
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
      selectedCell.value = {
        array: data.array,
        r: data.r,
        c: data.c,
        val: data.val
      }
      emitInspection()
    }
  }
}

// Telemetry output computed properties
const telemetryOutput = computed(() => {
  switch (activeOp.value) {
    case 'concat_axis0':
      return {
        name: 'np.concatenate([A, B], axis=0)',
        shape: '(6, 3)',
        ndim: 2,
        rule: 'Preserves ndim • Existing row axis lengthened (3 + 3 = 6)',
        compat: 'Matching cols: 3 == 3 ✓'
      }
    case 'concat_axis1':
      return {
        name: 'np.concatenate([A, B], axis=1)',
        shape: '(3, 6)',
        ndim: 2,
        rule: 'Preserves ndim • Existing col axis lengthened (3 + 3 = 6)',
        compat: 'Matching rows: 3 == 3 ✓'
      }
    case 'stack_axis0':
      return {
        name: 'np.stack([A, B], axis=0)',
        shape: '(2, 3, 3)',
        ndim: 3,
        rule: 'Expands rank (ndim: 2 → 3) • Creates new outer Sheet axis',
        compat: 'All shapes match exactly: (3, 3) == (3, 3) ✓'
      }
    case 'vsplit':
      return {
        name: 'np.vsplit(C, 2)',
        shape: '[(3, 3), (3, 3)]',
        ndim: 2,
        rule: 'Divides 6 rows along axis 0 into 2 equal (3, 3) matrices',
        compat: 'Divisible rows: 6 % 2 == 0 ✓'
      }
    case 'hsplit':
      return {
        name: 'np.hsplit(C, 2)',
        shape: '[(3, 3), (3, 3)]',
        ndim: 2,
        rule: 'Divides 6 cols along axis 1 into 2 equal (3, 3) matrices',
        compat: 'Divisible cols: 6 % 2 == 0 ✓'
      }
  }
})

const emitInspection = () => {
  const cell = selectedCell.value
  let targetIndex = ''
  if (activeOp.value === 'concat_axis0') {
    targetIndex = cell.array === 'A' ? `[${cell.r}, ${cell.c}]` : `[${cell.r + 3}, ${cell.c}]`
  } else if (activeOp.value === 'concat_axis1') {
    targetIndex = cell.array === 'A' ? `[${cell.r}, ${cell.c}]` : `[${cell.r}, ${cell.c + 3}]`
  } else if (activeOp.value === 'stack_axis0') {
    targetIndex = cell.array === 'A' ? `[0, ${cell.r}, ${cell.c}]` : `[1, ${cell.r}, ${cell.c}]`
  } else {
    targetIndex = `${cell.array}[${cell.r}, ${cell.c}]`
  }

  emit('inspect', {
    title: `Element Selected: Array ${cell.array}[${cell.r}, ${cell.c}] = ${cell.val}`,
    details: {
      'Source Array': `Array ${cell.array} (3, 3)`,
      'Original Local Index': `(${cell.r}, ${cell.c})`,
      'Resulting Target Index': targetIndex,
      'Active Operation': telemetryOutput.value.name,
      'Output Topology': telemetryOutput.value.shape,
      'Rank Dimension': `ndim: ${telemetryOutput.value.ndim}`,
      'Axis Compatibility': telemetryOutput.value.compat,
      'Dimensional Invariant': telemetryOutput.value.rule
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

  if (splitLaserPlane) {
    splitLaserPlane.geometry.dispose()
    ;(splitLaserPlane.material as THREE.Material).dispose()
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
        <!-- Top Status Bar: Operation Badges -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <!-- Input Arrays Legend -->
          <div class="flex items-center gap-1.5 bg-card/90 backdrop-blur-md p-1 rounded-md border border-line shadow-xs pointer-events-auto text-xs font-mono">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 font-bold text-blue-600 dark:text-blue-400">
              Array A (3×3)
            </span>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 font-bold text-amber-600 dark:text-amber-400">
              Array B (3×3)
            </span>
          </div>

          <!-- Dimension & Result Shape Badge -->
          <div class="flex items-center gap-2 pointer-events-auto text-xs font-mono">
            <span class="px-2.5 py-1 rounded-md bg-card/90 backdrop-blur-md border border-line shadow-xs font-bold text-ink">
              Result: {{ telemetryOutput.shape }}
            </span>
            <span class="px-2.5 py-1 rounded-md bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 font-bold hidden sm:inline-flex items-center gap-1">
              <Layers class="w-3.5 h-3.5" />
              <span>ndim: {{ telemetryOutput.ndim }}</span>
            </span>
          </div>
        </div>

        <!-- Bottom Overlay: Interactive Hint -->
        <div class="flex items-center justify-between text-[0.68rem] text-muted">
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono">
            {{ telemetryOutput.rule }}
          </div>
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono hidden sm:block">
            Drag: Orbit 360° • Click: Inspect Element
          </div>
        </div>
      </div>
    </div>

    <!-- Operation Selector Bar -->
    <div class="bg-card border border-line rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
      <!-- Operation Selection Pills -->
      <div class="flex items-center gap-1.5 bg-card-subtle p-1 rounded-md border border-line overflow-x-auto text-xs font-mono">
        <button
          type="button"
          @click="switchOperation('concat_axis0')"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors"
          :class="activeOp === 'concat_axis0' ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
          title="np.concatenate(axis=0): Docks Array B beneath Array A (6, 3)"
        >
          <Merge class="w-3 h-3 rotate-90" />
          <span>Concat (axis=0)</span>
        </button>
        <button
          type="button"
          @click="switchOperation('concat_axis1')"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors"
          :class="activeOp === 'concat_axis1' ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
          title="np.concatenate(axis=1): Docks Array B to the right of Array A (3, 6)"
        >
          <Merge class="w-3 h-3" />
          <span>Concat (axis=1)</span>
        </button>
        <button
          type="button"
          @click="switchOperation('stack_axis0')"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors"
          :class="activeOp === 'stack_axis0' ? 'bg-card text-brand-purple font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
          title="np.stack(axis=0): Creates new outer sheet dimension (2, 3, 3)"
        >
          <Layers class="w-3 h-3" />
          <span>Stack (ndim +1)</span>
        </button>
        <button
          type="button"
          @click="switchOperation('vsplit')"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors"
          :class="activeOp === 'vsplit' ? 'bg-card text-red-600 dark:text-red-400 font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
          title="np.vsplit: Splits (6, 3) into two (3, 3) arrays along rows"
        >
          <Scissors class="w-3 h-3" />
          <span>vsplit</span>
        </button>
        <button
          type="button"
          @click="switchOperation('hsplit')"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors"
          :class="activeOp === 'hsplit' ? 'bg-card text-red-600 dark:text-red-400 font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
          title="np.hsplit: Splits (3, 6) into two (3, 3) arrays along columns"
        >
          <Scissors class="w-3 h-3 rotate-90" />
          <span>hsplit</span>
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
          <span>{{ isPlaying ? 'Pause' : 'Dock / Execute' }}</span>
        </button>

        <button
          type="button"
          @click="stepAnimation"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono font-medium text-ink transition-colors"
          title="Step motion"
        >
          <StepForward class="w-3.5 h-3.5 text-muted" />
          <span>Step</span>
        </button>

        <button
          type="button"
          @click="resetSimulation"
          class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono text-muted hover:text-ink transition-colors"
          title="Reset to initial unjoined state"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>

        <!-- Progress Slider -->
        <div class="flex items-center gap-1.5 text-xs font-mono text-muted pl-1">
          <input
            id="dockProgress"
            type="range"
            min="0"
            max="1"
            step="0.01"
            v-model.number="progress"
            @input="isPlaying = false; applyInterpolation(progress)"
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
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Active Operation</div>
        <div class="font-bold text-brand-blue truncate" :title="telemetryOutput.name">
          {{ telemetryOutput.name }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Output Dimension</div>
        <div class="font-bold text-brand-purple truncate">
          {{ telemetryOutput.shape }} (ndim: {{ telemetryOutput.ndim }})
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Axis Compatibility</div>
        <div class="font-bold text-brand-green truncate" :title="telemetryOutput.compat">
          {{ telemetryOutput.compat }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Invariant Rule</div>
        <div class="font-bold text-ink truncate" :title="telemetryOutput.rule">
          {{ telemetryOutput.rule }}
        </div>
      </div>
    </div>
  </div>
</template>

