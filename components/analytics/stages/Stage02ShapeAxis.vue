<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Play, Pause, StepForward, RotateCcw, ArrowDown, ArrowRight, Layers, Sparkles } from 'lucide-vue-next'
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

// Dimensionality strictly restricted to 1D, 2D, and 3D
type DimensionMode = '1D' | '2D' | '3D'
const currentDim = ref<DimensionMode>('2D')

// Active Reduction Axis (null = Full view, or 0, 1, 2)
const activeAxis = ref<number | null>(null)
const progress = ref(0) // 0 -> 1 for smooth collapse
const isPlaying = ref(false)

// 1D Setup: (6,) vector
const data1D = [2, 4, 6, 8, 10, 12]
const sum1D = 42

// 2D Setup: (3, 4) matrix
const data2D = [
  [1, 2, 3, 4],
  [5, 6, 7, 8],
  [9, 10, 11, 12]
]
const colSums2D = [15, 18, 21, 24] // axis 0 -> (4,)
const rowSums2D = [10, 26, 42]     // axis 1 -> (3,)

// 3D Setup: (2, 3, 3) volume = 18 cubes
const data3D = [
  // Sheet 0
  [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
  ],
  // Sheet 1
  [
    [10, 11, 12],
    [13, 14, 15],
    [16, 17, 18]
  ]
]

interface NodeData {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  id: string
  indices: number[]
  origVal: number
  currVal: number
  pos0: THREE.Vector3
  posTarget: THREE.Vector3
  scaleTarget: number
  isAccumulator: boolean
}

let activeNodes: NodeData[] = []
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animFrameId = 0
let floatingAxesGroup: THREE.Group | null = null
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2(-999, -999)

const initialCameraPos = new THREE.Vector3(0.8, 0.9, 8.5)
const initialCameraTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

const colorPalettes = [
  { bg: '#ffffff', text: '#1e40af', border: '#2563eb' },
  { bg: '#ffffff', text: '#7c3aed', border: '#8b5cf6' },
  { bg: '#ffffff', text: '#059669', border: '#10b981' }
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
  controls.dampingFactor = 0.05
  controls.minPolarAngle = 0.2
  controls.maxPolarAngle = Math.PI / 2 + 0.1
  controls.target.copy(initialCameraTarget)

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2)
  scene.add(ambientLight)

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.1)
  dirLight.position.set(8, 14, 10)
  scene.add(dirLight)

  const fillLight = new THREE.DirectionalLight(0xbfdbfe, 0.4)
  fillLight.position.set(-8, -4, -6)
  scene.add(fillLight)

  const gridHelper = new THREE.GridHelper(16, 16, isDark.value ? 0x334155 : 0xcbd5e1, isDark.value ? 0x1e293b : 0xe2ded4)
  gridHelper.position.y = -2.2
  scene.add(gridHelper)

  floatingAxesGroup = new THREE.Group()
  scene.add(floatingAxesGroup)

  buildDimensionStructure()

  const animate = () => {
    animFrameId = requestAnimationFrame(animate)

    if (isPlaying.value) {
      // 3.0 second smooth ease-in-out transition (0.0055 per frame)
      progress.value += 0.0055
      if (progress.value >= 1) {
        progress.value = 1
        isPlaying.value = false
      }
      applyStepAnimation(progress.value)
    }

    if (controls) controls.update()
    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  animate()
  applyStepAnimation(progress.value)
  emitInspection()
}

// Build structures for 1D, 2D, and 3D strictly
const buildDimensionStructure = () => {
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

  if (currentDim.value === '1D') {
    // 1D: 6 elements along Axis 0
    for (let c = 0; c < 6; c++) {
      const val = data1D[c]
      const tex = createNumberTexture(val, '#ffffff', '#1e40af', '#2563eb')
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 1 })
      const mesh = new THREE.Mesh(cubeGeo, mat)

      const wireMat = new THREE.LineBasicMaterial({ color: 0x2563eb, linewidth: 1.5 })
      const wireframe = new THREE.LineSegments(wireGeo, wireMat)
      mesh.add(wireframe)

      const x0 = (c - 2.5) * 1.35
      const y0 = 0
      const z0 = 0
      mesh.position.set(x0, y0, z0)
      mesh.userData = { id: `1D_${c}`, indices: [c], val }
      scene.add(mesh)

      activeNodes.push({
        mesh,
        wireframe,
        id: `1D_${c}`,
        indices: [c],
        origVal: val,
        currVal: val,
        pos0: new THREE.Vector3(x0, y0, z0),
        posTarget: new THREE.Vector3(x0, y0, z0),
        scaleTarget: 1,
        isAccumulator: false
      })
    }
  } else if (currentDim.value === '2D') {
    // 2D: 3 rows x 4 cols
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 4; c++) {
        const val = data2D[r][c]
        const colStyle = colorPalettes[r % colorPalettes.length]
        const tex = createNumberTexture(val, colStyle.bg, colStyle.text, colStyle.border)

        const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 1 })
        const mesh = new THREE.Mesh(cubeGeo, mat)

        const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(colStyle.border), linewidth: 1.5 })
        const wireframe = new THREE.LineSegments(wireGeo, wireMat)
        mesh.add(wireframe)

        const x0 = (c - 1.5) * 1.35
        const y0 = -(r - 1.0) * 1.35
        const z0 = 0
        mesh.position.set(x0, y0, z0)
        mesh.userData = { id: `2D_${r}_${c}`, indices: [r, c], val }
        scene.add(mesh)

        activeNodes.push({
          mesh,
          wireframe,
          id: `2D_${r}_${c}`,
          indices: [r, c],
          origVal: val,
          currVal: val,
          pos0: new THREE.Vector3(x0, y0, z0),
          posTarget: new THREE.Vector3(x0, y0, z0),
          scaleTarget: 1,
          isAccumulator: false
        })
      }
    }
  } else {
    // 3D: 2 sheets x 3 rows x 3 cols = 18 cubes
    for (let d = 0; d < 2; d++) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const val = data3D[d][r][c]
          const colStyle = colorPalettes[d % colorPalettes.length]
          const tex = createNumberTexture(val, colStyle.bg, colStyle.text, colStyle.border)

          const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.1, transparent: true, opacity: 1 })
          const mesh = new THREE.Mesh(cubeGeo, mat)

          const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(colStyle.border), linewidth: 1.5 })
          const wireframe = new THREE.LineSegments(wireGeo, wireMat)
          mesh.add(wireframe)

          const x0 = (c - 1.0) * 1.3
          const y0 = -(r - 1.0) * 1.3
          const z0 = (d - 0.5) * 2.4
          mesh.position.set(x0, y0, z0)
          mesh.userData = { id: `3D_${d}_${r}_${c}`, indices: [d, r, c], val }
          scene.add(mesh)

          activeNodes.push({
            mesh,
            wireframe,
            id: `3D_${d}_${r}_${c}`,
            indices: [d, r, c],
            origVal: val,
            currVal: val,
            pos0: new THREE.Vector3(x0, y0, z0),
            posTarget: new THREE.Vector3(x0, y0, z0),
            scaleTarget: 1,
            isAccumulator: false
          })
        }
      }
    }
  }

  updateFloatingAxes()
  computeReductionTargets()
}

// Bounding-Frame Coordinate Axes: Origin at bottom-back-left, hugging outer perimeter
const updateFloatingAxes = () => {
  if (!floatingAxesGroup) return

  while (floatingAxesGroup.children.length > 0) {
    const child = floatingAxesGroup.children[0]
    floatingAxesGroup.remove(child)
  }

  if (activeNodes.length === 0) return

  // Compute bounding box of active cubes
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

  // Bottom-back-left corner origin
  const originX = minX - halfW - clearance
  const originY = minY - halfW - clearance
  const originZ = minZ - halfW - clearance

  floatingAxesGroup.position.set(originX, originY, originZ)

  const marginExtra = 0.65
  const lenX = Math.max(1.8, (maxX - minX) + halfW * 2 + clearance + marginExtra)
  const lenY = Math.max(1.8, (maxY - minY) + halfW * 2 + clearance + marginExtra)
  const lenZ = Math.max(1.8, (maxZ - minZ) + halfW * 2 + clearance + marginExtra)

  // X Axis (Cols): Red / Coral pointing Right (+X)
  const arrowX = createBoldArrow(new THREE.Vector3(1, 0, 0), lenX, 0xef4444, 'axis X (Cols)', 0.055, 0.16, 0.35)
  floatingAxesGroup.add(arrowX)

  // Y Axis (Rows): Green / Emerald pointing Up (+Y)
  if (currentDim.value !== '1D') {
    const arrowY = createBoldArrow(new THREE.Vector3(0, 1, 0), lenY, 0x10b981, 'axis Y (Rows)', 0.055, 0.16, 0.35)
    floatingAxesGroup.add(arrowY)
  }

  // Z Axis (Depth): Blue / Sapphire pointing Forward (+Z)
  if (currentDim.value === '3D') {
    const arrowZ = createBoldArrow(new THREE.Vector3(0, 0, 1), lenZ, 0x3b82f6, 'axis Z (Depth)', 0.055, 0.16, 0.35)
    floatingAxesGroup.add(arrowZ)
  }
}

// Compute Reduction Targets
const computeReductionTargets = () => {
  const axis = activeAxis.value

  activeNodes.forEach((node) => {
    node.posTarget.copy(node.pos0)
    node.scaleTarget = 1
    node.isAccumulator = false
    node.currVal = node.origVal
  })

  if (axis === null) return

  if (currentDim.value === '1D') {
    // 1D: sum(axis=0) collapses vector -> single scalar (42) at center
    activeNodes.forEach((node) => {
      const [c] = node.indices
      node.posTarget.set(0, 0, 0)
      if (c === 2) {
        node.isAccumulator = true
        node.scaleTarget = 1.25
        node.currVal = sum1D
      } else {
        node.scaleTarget = 0.2
      }
    })
  } else if (currentDim.value === '2D') {
    if (axis === 0) {
      // np.sum(arr, axis=0): collapses rows -> preserves 4 columns
      activeNodes.forEach((node) => {
        const [r, c] = node.indices
        node.posTarget.set(node.pos0.x, 0, 0)
        if (r === 1) {
          node.isAccumulator = true
          node.scaleTarget = 1.15
          node.currVal = colSums2D[c]
        } else {
          node.scaleTarget = 0.2
        }
      })
    } else if (axis === 1) {
      // np.sum(arr, axis=1): collapses cols -> preserves 3 rows
      activeNodes.forEach((node) => {
        const [r, c] = node.indices
        node.posTarget.set(0, node.pos0.y, 0)
        if (c === 1) {
          node.isAccumulator = true
          node.scaleTarget = 1.15
          node.currVal = rowSums2D[r]
        } else {
          node.scaleTarget = 0.2
        }
      })
    }
  } else if (currentDim.value === '3D') {
    if (axis === 0) {
      // Collapse sheets (d)
      activeNodes.forEach((node) => {
        const [d, r, c] = node.indices
        node.posTarget.set(node.pos0.x, node.pos0.y, 0)
        if (d === 0) {
          node.isAccumulator = true
          node.scaleTarget = 1.12
          node.currVal = data3D[0][r][c] + data3D[1][r][c]
        } else {
          node.scaleTarget = 0.2
        }
      })
    } else if (axis === 1) {
      // Collapse rows (r)
      activeNodes.forEach((node) => {
        const [d, r, c] = node.indices
        node.posTarget.set(node.pos0.x, 0, node.pos0.z)
        if (r === 1) {
          node.isAccumulator = true
          node.scaleTarget = 1.12
          node.currVal = data3D[d][0][c] + data3D[d][1][c] + data3D[d][2][c]
        } else {
          node.scaleTarget = 0.2
        }
      })
    } else if (axis === 2) {
      // Collapse cols (c)
      activeNodes.forEach((node) => {
        const [d, r, c] = node.indices
        node.posTarget.set(0, node.pos0.y, node.pos0.z)
        if (c === 1) {
          node.isAccumulator = true
          node.scaleTarget = 1.12
          node.currVal = data3D[d][r][0] + data3D[d][r][1] + data3D[d][r][2]
        } else {
          node.scaleTarget = 0.2
        }
      })
    }
  }
}

// 3 Staged Animation Pacing (3.0s total):
// Stage 1 (0.00 <= t < 0.25): Highlight active axis & pulse source cubes
// Stage 2 (0.25 <= t < 0.80): Smooth easeInOutCubic slide along axis
// Stage 3 (0.80 <= t <= 1.0): Flash merged cubes with golden glow & swap accumulated textures
const applyStepAnimation = (t: number) => {
  if (activeAxis.value === null) {
    activeNodes.forEach((node) => {
      node.mesh.position.copy(node.pos0)
      node.mesh.scale.set(1, 1, 1)
      setCubeMaterial(node, node.origVal, 1.0, '#ffffff', '#1e40af', '#2563eb')
    })
    return
  }

  // Stage 1: Pulse axis guide & cubes
  if (t < 0.25) {
    const stage1Progress = t / 0.25
    activeNodes.forEach((node) => {
      node.mesh.position.copy(node.pos0)
      const scale = 1 + Math.sin(stage1Progress * Math.PI) * 0.08
      node.mesh.scale.set(scale, scale, scale)
      setCubeMaterial(node, node.origVal, 1.0, '#ffffff', '#1e40af', '#2563eb')
    })
    return
  }

  // Stage 2: Slide Lerp
  const slideT = THREE.MathUtils.clamp((t - 0.25) / 0.55, 0, 1)
  const ease = slideT < 0.5 ? 4 * slideT * slideT * slideT : 1 - Math.pow(-2 * slideT + 2, 3) / 2

  activeNodes.forEach((node) => {
    node.mesh.position.lerpVectors(node.pos0, node.posTarget, ease)

    if (node.isAccumulator) {
      const scale = 1 + ease * 0.15
      node.mesh.scale.set(scale, scale, scale)
      if (t >= 0.8) {
        // Stage 3: Flash accumulated sum
        const pulse = 1 + Math.sin((t - 0.8) * 5 * Math.PI) * 0.08
        node.mesh.scale.set(scale * pulse, scale * pulse, scale * pulse)
        setCubeMaterial(node, node.currVal, 1.0, '#fffbeb', '#92400e', '#f59e0b')
      } else {
        setCubeMaterial(node, node.origVal, 1.0, '#ffffff', '#1e40af', '#2563eb')
      }
    } else {
      const fadeScale = Math.max(0.01, 1 - ease * 0.85)
      node.mesh.scale.set(fadeScale, fadeScale, fadeScale)
      setCubeMaterial(node, node.origVal, Math.max(0.05, 1 - ease * 0.95), '#ffffff', '#94a3b8', '#cbd5e1')
    }
  })
}

const setCubeMaterial = (node: NodeData, val: number, opacity: number, bg: string, text: string, border: string) => {
  const tex = createNumberTexture(val, bg, text, border)
  const mat = node.mesh.material as THREE.MeshStandardMaterial
  mat.map = tex
  mat.needsUpdate = true
  mat.transparent = opacity < 0.99
  mat.opacity = opacity
  ;(node.wireframe.material as THREE.LineBasicMaterial).color.set(border)
  ;(node.wireframe.material as THREE.LineBasicMaterial).opacity = opacity
}

// User Actions
const switchDimension = (dim: DimensionMode) => {
  currentDim.value = dim
  activeAxis.value = null
  progress.value = 0
  isPlaying.value = false
  buildDimensionStructure()
  emitInspection()
}

const setReductionAxis = (axis: number | null) => {
  activeAxis.value = axis
  isPlaying.value = false
  progress.value = axis === null ? 0 : 1
  computeReductionTargets()
  applyStepAnimation(progress.value)
  emitInspection()
}

const togglePlay = () => {
  if (activeAxis.value === null) {
    activeAxis.value = 0
    computeReductionTargets()
  }
  if (progress.value >= 1) progress.value = 0
  isPlaying.value = !isPlaying.value
}

const stepAnimation = () => {
  isPlaying.value = false
  if (activeAxis.value === null) {
    activeAxis.value = 0
    computeReductionTargets()
  }
  progress.value = Math.min(1, Math.round((progress.value + 0.25) * 100) / 100)
  applyStepAnimation(progress.value)
  emitInspection()
}

const resetSimulation = () => {
  isPlaying.value = false
  activeAxis.value = null
  progress.value = 0
  computeReductionTargets()
  applyStepAnimation(0)
  emitInspection()
}

const resetCamera = () => {
  if (!camera || !controls) return
  camera.position.copy(initialCameraPos)
  controls.target.copy(initialCameraTarget)
  controls.update()
}

const onPointerDown = (event: MouseEvent) => {
  if (!canvasRef.value || !camera) return

  const rect = canvasRef.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const meshes = activeNodes.map((n) => n.mesh)
  const intersects = raycaster.intersectObjects(meshes, false)

  if (intersects.length > 0) {
    const clickedMesh = intersects[0].object as THREE.Mesh
    const data = clickedMesh.userData
    if (data) {
      emitInspection(data.indices, data.val)
    }
  }
}

const emitInspection = (indices?: number[], val?: number) => {
  const axis = activeAxis.value
  const dim = currentDim.value

  let shapeText = dim === '1D' ? '(6,)' : (dim === '2D' ? '(3, 4)' : '(2, 3, 3)')
  let outputShape = 'No reduction'
  let invariantFormula = 'Axis k eliminates dimension k by aggregating along it'

  if (axis !== null) {
    if (dim === '1D') {
      outputShape = '() Scalar [42]'
      invariantFormula = 'np.sum(arr, axis=0) collapses vector into a scalar'
    } else if (dim === '2D') {
      outputShape = axis === 0 ? '(4,) [Col Sums]' : '(3,) [Row Sums]'
      invariantFormula = axis === 0 ? 'np.sum(arr, axis=0) collapses rows downward' : 'np.sum(arr, axis=1) collapses cols across'
    } else {
      outputShape = axis === 0 ? '(3, 3) [Depth collapsed]' : '(2, 3)'
      invariantFormula = `np.sum(arr, axis=${axis}) collapses dimension ${axis}`
    }
  }

  emit('inspect', {
    title: `${dim} Tensor Inspection: ${axis === null ? 'Full Array' : `np.sum(arr, axis=${axis})`}`,
    details: {
      'Input Shape': shapeText,
      'Active Rank': dim,
      'Reduction Axis': axis !== null ? `Axis ${axis}` : 'None',
      'Resulting Shape': outputShape,
      'Pacing Status': isPlaying.value ? '3-Stage Ease-in-out' : (progress.value >= 1 ? 'Accumulated' : 'Ready'),
      'Formula Invariant': invariantFormula
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
    updateFloatingAxes()
  }
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
        <!-- Top Status Bar: 1D, 2D, 3D Switches -->
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5 bg-card/90 backdrop-blur-md p-1 rounded-md border border-line shadow-xs pointer-events-auto text-xs font-mono">
            <span class="text-[10px] text-muted font-bold px-1 uppercase">Rank:</span>
            <button
              type="button"
              @click="switchDimension('1D')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="currentDim === '1D' ? 'bg-brand-blue text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
            >
              1D (6,)
            </button>
            <button
              type="button"
              @click="switchDimension('2D')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="currentDim === '2D' ? 'bg-brand-blue text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
            >
              2D (3, 4)
            </button>
            <button
              type="button"
              @click="switchDimension('3D')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="currentDim === '3D' ? 'bg-brand-blue text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
            >
              3D (2, 3, 3)
            </button>
          </div>

          <!-- Axis Direction Labels -->
          <div class="flex items-center gap-1.5 pointer-events-auto text-[10px] font-mono">
            <span class="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 font-bold text-red-600 dark:text-red-400">
              axis 0 (Coral)
            </span>
            <span v-if="currentDim !== '1D'" class="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 font-bold text-emerald-600 dark:text-emerald-400">
              axis 1 (Emerald)
            </span>
            <span v-if="currentDim === '3D'" class="px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/30 font-bold text-blue-600 dark:text-blue-400">
              axis 2 (Sapphire)
            </span>
          </div>
        </div>

        <!-- Bottom Overlay: 360 Hint & Animation Pacing Notice -->
        <div class="flex items-center justify-between text-[0.68rem] text-muted">
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono">
            Pacing: 3-Stage Ease-in-out (Highlight → Slide → Flash Sum)
          </div>
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono hidden sm:block">
            Drag: Orbit 360° • Click: Inspect
          </div>
        </div>
      </div>
    </div>

    <!-- Execution & Reduction Toolbar -->
    <div class="bg-card border border-line rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
      <!-- Reduction Axis Buttons -->
      <div class="flex items-center gap-1.5 bg-card-subtle p-1 rounded-md border border-line">
        <button
          type="button"
          @click="setReductionAxis(null)"
          class="px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors"
          :class="activeAxis === null ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          Full View
        </button>
        <button
          type="button"
          @click="setReductionAxis(0)"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors"
          :class="activeAxis === 0 ? 'bg-card text-red-600 dark:text-red-400 font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          <ArrowDown class="w-3 h-3" />
          <span>sum(axis=0)</span>
        </button>
        <button
          v-if="currentDim !== '1D'"
          type="button"
          @click="setReductionAxis(1)"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors"
          :class="activeAxis === 1 ? 'bg-card text-emerald-600 dark:text-emerald-400 font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          <ArrowRight class="w-3 h-3" />
          <span>sum(axis=1)</span>
        </button>
        <button
          v-if="currentDim === '3D'"
          type="button"
          @click="setReductionAxis(2)"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors"
          :class="activeAxis === 2 ? 'bg-card text-blue-600 dark:text-blue-400 font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
        >
          <span>sum(axis=2)</span>
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
          <span>{{ isPlaying ? 'Pause' : 'Animate (3s)' }}</span>
        </button>

        <button
          type="button"
          @click="stepAnimation"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono font-medium text-ink transition-colors"
          title="Step collapse animation"
        >
          <StepForward class="w-3.5 h-3.5 text-muted" />
          <span>Step</span>
        </button>

        <button
          type="button"
          @click="resetSimulation"
          class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono text-muted hover:text-ink transition-colors"
          title="Reset to Full View"
        >
          <RotateCcw class="w-3.5 h-3.5" />
          <span>Reset</span>
        </button>
      </div>

      <!-- Progress Slider -->
      <div class="flex items-center gap-2 text-xs font-mono text-muted">
        <label for="stepProgress">Pacing</label>
        <input
          id="stepProgress"
          type="range"
          min="0"
          max="1"
          step="0.01"
          v-model.number="progress"
          @input="isPlaying = false; applyStepAnimation(progress)"
          class="w-24 accent-brand-blue cursor-pointer"
        />
        <span class="font-bold text-brand-blue pl-0.5">{{ Math.round(progress * 100) }}%</span>
      </div>

      <!-- Camera Reset -->
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
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Active Rank</div>
        <div class="font-bold text-brand-blue truncate">
          {{ currentDim }} Tensor
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Reduction Axis</div>
        <div class="font-bold text-ink truncate">
          {{ activeAxis === null ? 'None (Full Shape)' : `Axis ${activeAxis}` }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Stage Pacing</div>
        <div class="font-bold text-brand-amber truncate">
          {{ progress < 0.25 ? 'Stage 1: Highlight' : (progress < 0.8 ? 'Stage 2: Slide Lerp' : 'Stage 3: Flash Sum') }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Formula Invariant</div>
        <div class="font-bold text-brand-green truncate" title="Axis k collapses dimension k by aggregating along it">
          {{ activeAxis !== null ? `Axis ${activeAxis} collapses dimension ${activeAxis}` : 'Axis k collapses dimension k' }}
        </div>
      </div>
    </div>
  </div>
</template>
