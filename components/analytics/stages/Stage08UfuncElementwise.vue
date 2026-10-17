<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Play, Pause, StepForward, RotateCcw, FunctionSquare, Sparkles, Layers, CheckCircle2, ShieldCheck } from 'lucide-vue-next'
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

// 3x4 Matrix Input Data
const ROWS = 3
const COLS = 4
const matrixX = [
  [-2, -1, 0, 1],
  [2, 3, -3, 4],
  [1, -2, 2, 0]
]

// Ufunc Options
type FunctionKey = 'square' | 'abs' | 'exp' | 'sin'
const selectedFunc = ref<FunctionKey>('square')

// In-Place Mutation Toggle: 'new' (out=None) vs 'inplace' (out=X)
type BufferMode = 'new' | 'inplace'
const bufferMode = ref<BufferMode>('new')

// Simulation & Animation
const progress = ref(0) // 0 -> 1 for projection transition
const isPlaying = ref(false)
const selectedCoord = ref<{ r: number; c: number; inVal: number; outVal: number }>({
  r: 0,
  c: 0,
  inVal: -2,
  outVal: 4
})

// Mathematical evaluation function
const evaluateFunction = (val: number, fn: FunctionKey): number => {
  switch (fn) {
    case 'square':
      return val * val
    case 'abs':
      return Math.abs(val)
    case 'exp':
      return Math.round(Math.exp(val) * 10) / 10
    case 'sin':
      return Math.round(Math.sin(val) * 100) / 100
  }
}

// Function metadata
const funcMeta = computed(() => {
  switch (selectedFunc.value) {
    case 'square':
      return { name: 'np.square(X)', symbol: 'f(x) = x²', math: 'x²' }
    case 'abs':
      return { name: 'np.abs(X)', symbol: 'f(x) = |x|', math: '|x|' }
    case 'exp':
      return { name: 'np.exp(X)', symbol: 'f(x) = exp(x)', math: 'eˣ' }
    case 'sin':
      return { name: 'np.sin(X)', symbol: 'f(x) = sin(x)', math: 'sin(x)' }
  }
})

// Three.js instances
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animFrameId = 0
let floatingAxesGroup: THREE.Group | null = null
let chamberGroup: THREE.Group | null = null

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2(-999, -999)

const initialCameraPos = new THREE.Vector3(0.8, 1.0, 9.8)
const initialCameraTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

// Color palettes
const palInput = { bg: '#ffffff', text: '#1e40af', border: '#2563eb' } // Blue Input
const palChamber = { bg: '#fef3c7', text: '#78350f', border: '#d97706' } // Amber Chamber
const palOutput = { bg: '#ecfdf5', text: '#065f46', border: '#10b981' } // Emerald Output
const palInplace = { bg: '#fff7ed', text: '#9a3412', border: '#ea580c' } // Warm In-Place

interface CubeNode {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  type: 'input' | 'output' | 'projector'
  r: number
  c: number
  inVal: number
  outVal: number
  pos0: THREE.Vector3
  posTarget: THREE.Vector3
}

let inputCubes: CubeNode[] = []
let outputSlots: CubeNode[] = []
let projectorCubes: CubeNode[] = []
let allClickableMeshes: THREE.Mesh[] = []

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
  const gridHelper = new THREE.GridHelper(20, 20, isDark.value ? 0x334155 : 0xcbd5e1, isDark.value ? 0x1e293b : 0xe2ded4)
  gridHelper.position.y = -2.7
  scene.add(gridHelper)

  floatingAxesGroup = new THREE.Group()
  scene.add(floatingAxesGroup)

  chamberGroup = new THREE.Group()
  scene.add(chamberGroup)

  rebuildSceneLayout()

  const animate = () => {
    animFrameId = requestAnimationFrame(animate)

    if (isPlaying.value) {
      // 1.8s smooth ease-in-out transition (0.01 per frame)
      progress.value += 0.01
      if (progress.value >= 1) {
        progress.value = 1
        isPlaying.value = false
      }
      applyProjectionInterpolation(progress.value)
    }

    if (controls) controls.update()
    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  animate()
  applyProjectionInterpolation(0)
  emitInspection()
}

// Rebuild scene depending on buffer mode: 'new' (2 grids + chamber) vs 'inplace' (1 centered grid)
const rebuildSceneLayout = () => {
  if (!scene) return

  const clearNodes = (list: CubeNode[]) => {
    list.forEach((n) => {
      scene?.remove(n.mesh)
      n.mesh.geometry.dispose()
      ;(n.mesh.material as THREE.Material).dispose()
      n.wireframe.geometry.dispose()
    })
  }

  clearNodes(inputCubes)
  clearNodes(outputSlots)
  clearNodes(projectorCubes)
  inputCubes = []
  outputSlots = []
  projectorCubes = []
  allClickableMeshes = []

  const cubeGeo = new THREE.BoxGeometry(0.88, 0.88, 0.88)
  const wireGeo = new THREE.EdgesGeometry(cubeGeo)
  const spacing = 1.15

  if (bufferMode.value === 'new') {
    // Mode 1: Allocate New Buffer
    // Input Matrix X on left (centerX = -3.4)
    // Function Chamber in center (centerX = 0)
    // Output Matrix Y on right (centerX = +3.4)
    const inCenterX = -3.4
    const outCenterX = 3.4

    // 1. Input Matrix X (Left)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const inVal = matrixX[r][c]
        const outVal = evaluateFunction(inVal, selectedFunc.value)
        const tex = createNumberTexture(inVal, palInput.bg, palInput.text, palInput.border)
        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.3,
          metalness: 0.1,
          transparent: true,
          opacity: 1
        })
        const mesh = new THREE.Mesh(cubeGeo, mat)
        const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(palInput.border), linewidth: 1.5 })
        const wireframe = new THREE.LineSegments(wireGeo, wireMat)
        mesh.add(wireframe)

        const x = inCenterX + (c - 1.5) * spacing
        const y = -(r - 1.0) * spacing
        mesh.position.set(x, y, 0)
        mesh.userData = { r, c, inVal, outVal, type: 'input' }
        scene.add(mesh)
        allClickableMeshes.push(mesh)

        inputCubes.push({
          mesh,
          wireframe,
          type: 'input',
          r,
          c,
          inVal,
          outVal,
          pos0: new THREE.Vector3(x, y, 0),
          posTarget: new THREE.Vector3(x, y, 0)
        })
      }
    }

    // 2. Output Matrix Slots Y (Right) - initially empty transparent slots
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const inVal = matrixX[r][c]
        const outVal = evaluateFunction(inVal, selectedFunc.value)
        const mat = new THREE.MeshStandardMaterial({
          color: isDark.value ? 0x1e293b : 0xe2e8f0,
          transparent: true,
          opacity: 0.3,
          wireframe: false
        })
        const mesh = new THREE.Mesh(cubeGeo, mat)
        const wireMat = new THREE.LineBasicMaterial({
          color: isDark.value ? 0x475569 : 0x94a3b8,
          transparent: true,
          opacity: 0.45
        })
        const wireframe = new THREE.LineSegments(wireGeo, wireMat)
        mesh.add(wireframe)

        const x = outCenterX + (c - 1.5) * spacing
        const y = -(r - 1.0) * spacing
        mesh.position.set(x, y, 0)
        mesh.userData = { r, c, inVal, outVal, type: 'output' }
        scene.add(mesh)
        allClickableMeshes.push(mesh)

        outputSlots.push({
          mesh,
          wireframe,
          type: 'output',
          r,
          c,
          inVal,
          outVal,
          pos0: new THREE.Vector3(x, y, 0),
          posTarget: new THREE.Vector3(x, y, 0)
        })
      }
    }

    // 3. Projector Cubes (Fly from Input -> Chamber -> Output)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const inVal = matrixX[r][c]
        const outVal = evaluateFunction(inVal, selectedFunc.value)
        const tex = createNumberTexture(inVal, palInput.bg, palInput.text, palInput.border)
        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.3,
          metalness: 0.1,
          transparent: true,
          opacity: 0
        })
        const mesh = new THREE.Mesh(cubeGeo, mat)
        const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(palOutput.border), transparent: true, opacity: 0 })
        const wireframe = new THREE.LineSegments(wireGeo, wireMat)
        mesh.add(wireframe)

        const x0 = inCenterX + (c - 1.5) * spacing
        const y0 = -(r - 1.0) * spacing
        const xTarget = outCenterX + (c - 1.5) * spacing
        const yTarget = y0

        mesh.position.set(x0, y0, 0)
        mesh.userData = { r, c, inVal, outVal, type: 'projector' }
        scene.add(mesh)

        projectorCubes.push({
          mesh,
          wireframe,
          type: 'projector',
          r,
          c,
          inVal,
          outVal,
          pos0: new THREE.Vector3(x0, y0, 0),
          posTarget: new THREE.Vector3(xTarget, yTarget, 0)
        })
      }
    }

    buildFunctionChamber(true)
  } else {
    // Mode 2: In-Place Mutation (out=X)
    // Single centered matrix at X = 0
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const inVal = matrixX[r][c]
        const outVal = evaluateFunction(inVal, selectedFunc.value)
        const tex = createNumberTexture(inVal, palInput.bg, palInput.text, palInput.border)
        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.3,
          metalness: 0.1,
          transparent: true,
          opacity: 1
        })
        const mesh = new THREE.Mesh(cubeGeo, mat)
        const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(palInput.border), linewidth: 1.5 })
        const wireframe = new THREE.LineSegments(wireGeo, wireMat)
        mesh.add(wireframe)

        const x = (c - 1.5) * spacing
        const y = -(r - 1.0) * spacing
        mesh.position.set(x, y, 0)
        mesh.userData = { r, c, inVal, outVal, type: 'input' }
        scene.add(mesh)
        allClickableMeshes.push(mesh)

        inputCubes.push({
          mesh,
          wireframe,
          type: 'input',
          r,
          c,
          inVal,
          outVal,
          pos0: new THREE.Vector3(x, y, 0),
          posTarget: new THREE.Vector3(x, y, 0)
        })
      }
    }

    buildFunctionChamber(false)
  }

  updateFloatingAxes()
}

// Function Chamber: Floating transparent glass portal with active math operator badge
const buildFunctionChamber = (visible: boolean) => {
  if (!chamberGroup) return

  while (chamberGroup.children.length > 0) {
    const child = chamberGroup.children[0]
    chamberGroup.remove(child)
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      ;(child.material as THREE.Material).dispose()
    }
  }

  if (!visible) return

  // Transparent Portal Plane
  const portalGeo = new THREE.PlaneGeometry(1.6, 4.4)
  const portalMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    transparent: true,
    opacity: 0.22,
    roughness: 0.1,
    metalness: 0.2,
    side: THREE.DoubleSide
  })
  const portal = new THREE.Mesh(portalGeo, portalMat)
  portal.position.set(0, 0, 0)
  chamberGroup.add(portal)

  // Border Wireframe for Portal
  const edgesGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.6, 4.4, 0.2))
  const wireMat = new THREE.LineBasicMaterial({ color: 0xd97706, linewidth: 2 })
  chamberGroup.add(new THREE.LineSegments(edgesGeo, wireMat))

  // Formula Label Sprite
  const sprite = createTextSprite(funcMeta.value.symbol, '#d97706', 44)
  sprite.position.set(0, 2.65, 0)
  sprite.scale.set(3.2, 0.9, 1)
  chamberGroup.add(sprite)

  // Subtitle Sprite
  const subSprite = createTextSprite('SIMD C-Kernel Dispatch', isDark.value ? '#94a3b8' : '#64748b', 28)
  subSprite.position.set(0, -2.45, 0)
  subSprite.scale.set(3.4, 0.75, 1)
  chamberGroup.add(subSprite)
}

// Interpolation & Visual Transformation
const applyProjectionInterpolation = (t: number) => {
  if (bufferMode.value === 'new') {
    const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

    projectorCubes.forEach((proj) => {
      // Fade in and glide across
      const mat = proj.mesh.material as THREE.MeshStandardMaterial
      const wire = proj.wireframe.material as THREE.LineBasicMaterial

      if (t > 0.05 && t < 0.95) {
        mat.opacity = 0.92
        wire.opacity = 0.95
        // Parabolic arc on Z
        const arc = Math.sin(t * Math.PI) * 0.8
        proj.mesh.position.lerpVectors(proj.pos0, proj.posTarget, eased)
        proj.mesh.position.z = arc

        // Transform texture once past chamber center (t > 0.5)
        const isPastChamber = t > 0.5
        const currentText = isPastChamber ? proj.outVal : proj.inVal
        const pal = isPastChamber ? palOutput : palChamber
        const tex = createNumberTexture(currentText, pal.bg, pal.text, pal.border)
        mat.map = tex
        mat.needsUpdate = true
        wire.color.set(new THREE.Color(pal.border))
      } else if (t >= 0.95) {
        mat.opacity = 0
        wire.opacity = 0
        proj.mesh.position.copy(proj.posTarget)
      } else {
        mat.opacity = 0
        wire.opacity = 0
        proj.mesh.position.copy(proj.pos0)
      }
    })

    // Once projection reaches target (t >= 0.95), populate Output Slots
    outputSlots.forEach((slot) => {
      const mat = slot.mesh.material as THREE.MeshStandardMaterial
      const wire = slot.wireframe.material as THREE.LineBasicMaterial

      if (t >= 0.95) {
        const tex = createNumberTexture(slot.outVal, palOutput.bg, palOutput.text, palOutput.border)
        mat.map = tex
        mat.needsUpdate = true
        mat.transparent = false
        mat.opacity = 1
        mat.color.setHex(0xffffff)
        wire.color.set(new THREE.Color(palOutput.border))
        wire.opacity = 1
      } else {
        mat.map = null
        mat.needsUpdate = true
        mat.transparent = true
        mat.opacity = 0.25
        mat.color.set(isDark.value ? 0x1e293b : 0xe2e8f0)
        wire.color.set(isDark.value ? 0x475569 : 0x94a3b8)
        wire.opacity = 0.4
      }
    })
  } else {
    // In-Place Mutation Mode: flash and mutate directly
    inputCubes.forEach((cube) => {
      const mat = cube.mesh.material as THREE.MeshStandardMaterial
      const wire = cube.wireframe.material as THREE.LineBasicMaterial

      if (t >= 0.5) {
        const tex = createNumberTexture(cube.outVal, palInplace.bg, palInplace.text, palInplace.border)
        mat.map = tex
        mat.needsUpdate = true
        wire.color.set(new THREE.Color(palInplace.border))
        cube.mesh.scale.set(1.05, 1.05, 1.05)
      } else {
        const tex = createNumberTexture(cube.inVal, palInput.bg, palInput.text, palInput.border)
        mat.map = tex
        mat.needsUpdate = true
        wire.color.set(new THREE.Color(palInput.border))
        cube.mesh.scale.set(0.95, 0.95, 0.95)
      }
    })
  }
}

// Bounding-Frame Coordinate Axes
const updateFloatingAxes = () => {
  if (!floatingAxesGroup) return

  while (floatingAxesGroup.children.length > 0) {
    const child = floatingAxesGroup.children[0]
    floatingAxesGroup.remove(child)
  }

  const referenceNodes = bufferMode.value === 'new' ? inputCubes.concat(outputSlots) : inputCubes
  if (referenceNodes.length === 0) return

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  for (const node of referenceNodes) {
    const pos = node.mesh.position
    minX = Math.min(minX, pos.x)
    maxX = Math.max(maxX, pos.x)
    minY = Math.min(minY, pos.y)
    maxY = Math.max(maxY, pos.y)
    minZ = Math.min(minZ, pos.z)
    maxZ = Math.max(maxZ, pos.z)
  }

  const halfW = 0.44
  const clearance = 0.38

  const originX = minX - halfW - clearance
  const originY = minY - halfW - clearance
  const originZ = minZ - halfW - clearance

  floatingAxesGroup.position.set(originX, originY, originZ)

  const marginExtra = 0.65
  const lenX = Math.max(1.8, maxX - minX + halfW * 2 + clearance + marginExtra)
  const lenY = Math.max(1.8, maxY - minY + halfW * 2 + clearance + marginExtra)

  // X Axis (Cols)
  const arrowX = createBoldArrow(new THREE.Vector3(1, 0, 0), lenX, 0xef4444, 'axis X (Columns)', 0.055, 0.16, 0.35)
  floatingAxesGroup.add(arrowX)

  // Y Axis (Rows)
  const arrowY = createBoldArrow(new THREE.Vector3(0, 1, 0), lenY, 0x10b981, 'axis Y (Rows)', 0.055, 0.16, 0.35)
  floatingAxesGroup.add(arrowY)
}

// User Actions
const setFunction = (fn: FunctionKey) => {
  selectedFunc.value = fn
  progress.value = 0
  isPlaying.value = false
  rebuildSceneLayout()
  applyProjectionInterpolation(0)
  emitInspection()
}

const setBufferMode = (mode: BufferMode) => {
  bufferMode.value = mode
  progress.value = 0
  isPlaying.value = false
  rebuildSceneLayout()
  applyProjectionInterpolation(0)
  emitInspection()
}

const applyUfunc = () => {
  if (progress.value >= 1) progress.value = 0
  isPlaying.value = true
}

const togglePlay = () => {
  if (progress.value >= 1) progress.value = 0
  isPlaying.value = !isPlaying.value
}

const stepAnimation = () => {
  isPlaying.value = false
  progress.value = Math.min(1, Math.round((progress.value + 0.25) * 100) / 100)
  applyProjectionInterpolation(progress.value)
  emitInspection()
}

const resetSimulation = () => {
  isPlaying.value = false
  progress.value = 0
  applyProjectionInterpolation(0)
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
  const intersects = raycaster.intersectObjects(allClickableMeshes, false)

  if (intersects.length > 0) {
    const hitMesh = intersects[0].object as THREE.Mesh
    const data = hitMesh.userData
    if (data) {
      selectedCoord.value = {
        r: data.r,
        c: data.c,
        inVal: data.inVal,
        outVal: data.outVal
      }
      emitInspection()
    }
  }
}

const emitInspection = () => {
  const coord = selectedCoord.value
  const hexAddrIn = `0x${(0x7ffd1000 + (coord.r * 4 + coord.c) * 4).toString(16).toUpperCase()}`
  const hexAddrOut = bufferMode.value === 'inplace'
    ? hexAddrIn
    : `0x${(0x8b122000 + (coord.r * 4 + coord.c) * 4).toString(16).toUpperCase()}`

  emit('inspect', {
    title: `Ufunc Projection: Element [${coord.r}, ${coord.c}]`,
    details: {
      'Input Value X[r, c]': coord.inVal,
      'Active Function': funcMeta.value.name,
      'Evaluated Output': coord.outVal,
      'Input RAM Pointer': hexAddrIn,
      'Output RAM Pointer': hexAddrOut,
      'Buffer Strategy': bufferMode.value === 'inplace' ? 'In-Place Reuse (out=X, 0 bytes allocated)' : 'New Array Allocation (out=None, +96 bytes)',
      'Strided Kernel Execution': 'Precompiled C-loop dispatched over contiguous L1 cache lines'
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
    buildFunctionChamber(bufferMode.value === 'new')
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

  const clearNodes = (list: CubeNode[]) => {
    list.forEach((n) => {
      n.mesh.geometry.dispose()
      ;(n.mesh.material as THREE.Material).dispose()
      n.wireframe.geometry.dispose()
    })
  }
  clearNodes(inputCubes)
  clearNodes(outputSlots)
  clearNodes(projectorCubes)
  inputCubes = []
  outputSlots = []
  projectorCubes = []
  allClickableMeshes = []

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
        <!-- Top Status Bar: Mathematical Operator & Buffer Strategy Badge -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <!-- Active Operator Pill -->
          <div class="flex items-center gap-1.5 bg-card/90 backdrop-blur-md p-1 rounded-md border border-line shadow-xs pointer-events-auto text-xs font-mono">
            <span class="text-[10px] text-muted font-bold px-1 uppercase">Operator:</span>
            <span class="px-2 py-0.5 rounded bg-brand-amber/15 border border-brand-amber/30 font-bold text-brand-amber">
              {{ funcMeta.symbol }}
            </span>
          </div>

          <!-- Memory Allocation Strategy Badge -->
          <div class="flex items-center gap-2 pointer-events-auto text-xs font-mono">
            <span
              v-if="bufferMode === 'new'"
              class="px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 shadow-xs"
            >
              <Layers class="w-3.5 h-3.5" />
              <span>Allocate Buffer (+96B)</span>
            </span>
            <span
              v-else
              class="px-2.5 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 shadow-xs"
            >
              <ShieldCheck class="w-3.5 h-3.5" />
              <span>In-Place Mutation (0B)</span>
            </span>
          </div>
        </div>

        <!-- Bottom Overlay: Interactive Hint -->
        <div class="flex items-center justify-between text-[0.68rem] text-muted">
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono">
            {{ bufferMode === 'new' ? 'Grid X → Function Chamber → Grid Y' : 'In-Place: Array X transforms in-place without copying' }}
          </div>
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono hidden sm:block">
            Drag: Orbit 360° • Click: Map Element
          </div>
        </div>
      </div>
    </div>

    <!-- Toolbar: Function Selection & Execution -->
    <div class="bg-card border border-line rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
      <!-- Universal Function Selection Pills -->
      <div class="flex items-center gap-1.5 bg-card-subtle p-1 rounded-md border border-line overflow-x-auto text-xs font-mono">
        <button
          type="button"
          @click="setFunction('square')"
          class="px-2.5 py-1 rounded font-medium transition-colors"
          :class="selectedFunc === 'square' ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          x² (square)
        </button>
        <button
          type="button"
          @click="setFunction('abs')"
          class="px-2.5 py-1 rounded font-medium transition-colors"
          :class="selectedFunc === 'abs' ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          |x| (abs)
        </button>
        <button
          type="button"
          @click="setFunction('exp')"
          class="px-2.5 py-1 rounded font-medium transition-colors"
          :class="selectedFunc === 'exp' ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          eˣ (exp)
        </button>
        <button
          type="button"
          @click="setFunction('sin')"
          class="px-2.5 py-1 rounded font-medium transition-colors"
          :class="selectedFunc === 'sin' ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          sin(x)
        </button>
      </div>

      <!-- Buffer Strategy Switcher -->
      <div class="flex items-center gap-1 bg-card-subtle p-1 rounded-md border border-line text-xs font-mono">
        <button
          type="button"
          @click="setBufferMode('new')"
          class="px-2 py-0.5 rounded font-medium transition-colors"
          :class="bufferMode === 'new' ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
          title="np.ufunc(X): Allocates new output memory buffer Y"
        >
          New Buffer (out=None)
        </button>
        <button
          type="button"
          @click="setBufferMode('inplace')"
          class="px-2 py-0.5 rounded font-medium transition-colors"
          :class="bufferMode === 'inplace' ? 'bg-card text-brand-amber font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
          title="np.ufunc(X, out=X): In-place zero copy mutation"
        >
          In-Place (out=X)
        </button>
      </div>

      <!-- Execution Controls -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="applyUfunc"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors shadow-xs"
          :class="isPlaying ? 'bg-brand-amber text-white' : 'bg-brand-blue hover:bg-brand-blue-hover text-white'"
        >
          <Pause v-if="isPlaying" class="w-3.5 h-3.5 fill-current" />
          <Play v-else class="w-3.5 h-3.5 fill-current" />
          <span>{{ isPlaying ? 'Pause' : 'Apply ufunc' }}</span>
        </button>

        <button
          type="button"
          @click="stepAnimation"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono font-medium text-ink transition-colors"
          title="Step projection"
        >
          <StepForward class="w-3.5 h-3.5 text-muted" />
          <span>Step</span>
        </button>

        <button
          type="button"
          @click="resetSimulation"
          class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono text-muted hover:text-ink transition-colors"
          title="Reset to initial values"
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

    <!-- Fluid Telemetry HUD Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Active Signature</div>
        <div class="font-bold text-brand-blue truncate">
          {{ bufferMode === 'new' ? `${funcMeta.name}` : `np.${selectedFunc}(X, out=X)` }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Memory Allocated</div>
        <div class="font-bold text-ink truncate">
          {{ bufferMode === 'new' ? '+96 bytes (New Array)' : '0 bytes (In-Place Mutation)' }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Matrix Topology</div>
        <div class="font-bold text-brand-purple truncate">
          (3, 4) • 12 Elements
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Universal Invariant</div>
        <div class="font-bold text-brand-green truncate" title="Element-wise vectorization in C without Python loop overhead">
          Vectorized C Kernel Dispatch ✓
        </div>
      </div>
    </div>
  </div>
</template>

