<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Play, Pause, StepForward, RotateCcw, Compass, ArrowUpDown, ArrowLeftRight, Grid, Zap, ShieldCheck } from 'lucide-vue-next'
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

// Mode Selection
type TransformMode = 'rank1' | 'column' | 'row' | 'outer_product'
const currentMode = ref<TransformMode>('rank1')

// Base array values
const baseValues = [10, 20, 30, 40]
const N = baseValues.length

// Secondary vector for outer product (1, 4)
const rowValues = [1, 2, 3, 4]

// Animation state for outer product expansion or pivot
const progress = ref(0)
const isPlaying = ref(false)
const selectedCell = ref<{ label: string; r?: number; c?: number; val?: number } | null>(null)

// Mode metadata
const modeConfig = computed(() => {
  switch (currentMode.value) {
    case 'rank1':
      return {
        title: 'Rank-1 Vector arr',
        shape: '(4,)',
        ndim: 1,
        strides: '(8,) bytes',
        transposeShape: '(4,) [Transpose is NO-OP!]',
        formula: 'arr = np.array([10, 20, 30, 40])',
        desc: '1D Rank-1 vector has no orientation (neither row nor column). arr.T does nothing!'
      }
    case 'column':
      return {
        title: 'Column Vector arr[:, np.newaxis]',
        shape: '(4, 1)',
        ndim: 2,
        strides: '(8, 8) bytes',
        transposeShape: '(1, 4) [Transposes to Row Vector!]',
        formula: 'arr[:, np.newaxis] # or arr[:, None]',
        desc: 'Axis 1 injected as singleton dimension. Vector pivots vertically into 4 rows × 1 col.'
      }
    case 'row':
      return {
        title: 'Row Vector arr[np.newaxis, :]',
        shape: '(1, 4)',
        ndim: 2,
        strides: '(32, 8) bytes',
        transposeShape: '(4, 1) [Transposes to Column Vector!]',
        formula: 'arr[np.newaxis, :] # or arr[None, :]',
        desc: 'Axis 0 injected as singleton dimension. Vector sits horizontally as 1 row × 4 cols.'
      }
    case 'outer_product':
      return {
        title: 'Outer Product arr[:, None] * row[None, :]',
        shape: '(4, 1) * (1, 4) → (4, 4)',
        ndim: 2,
        strides: '(32, 8) bytes',
        transposeShape: '(4, 4)',
        formula: 'col[:, None] * row[None, :] # Matrix Multiplier',
        desc: 'Column and row stretch across each other via zero-copy stride to synthesize full 4x4 matrix!'
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
let phantomBoxGroup: THREE.Group | null = null

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2(-999, -999)

const initialCameraPos = new THREE.Vector3(0.0, 1.2, 10.5)
const initialCameraTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

// Color palettes
const palBase = { bg: '#ffffff', text: '#1e40af', border: '#2563eb' } // Blue Base Array
const palRow = { bg: '#ffffff', text: '#065f46', border: '#10b981' } // Green Row Vector
const palGhost = { bg: '#f8fafc', text: '#64748b', border: '#94a3b8' } // Ghost Clone
const palMatrix = { bg: '#fef3c7', text: '#9a3412', border: '#ea580c' } // Amber Outer Product Cell

interface CubeItem {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  type: 'base' | 'row' | 'ghost' | 'outer'
  r: number
  c: number
  val: number
  pos0: THREE.Vector3
  posTarget: THREE.Vector3
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

  phantomBoxGroup = new THREE.Group()
  scene.add(phantomBoxGroup)

  buildSceneForMode()

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

// Build 3D meshes based on current mode
const buildSceneForMode = () => {
  if (!scene) return

  // Dispose previous cubes
  activeCubes.forEach((c) => {
    scene?.remove(c.mesh)
    c.mesh.geometry.dispose()
    ;(c.mesh.material as THREE.Material).dispose()
    c.wireframe.geometry.dispose()
  })
  activeCubes = []
  allMeshes = []

  // Dispose labels
  while (labelSpritesGroup && labelSpritesGroup.children.length > 0) {
    const child = labelSpritesGroup.children[0]
    labelSpritesGroup.remove(child)
  }

  // Dispose phantom bounding boxes
  while (phantomBoxGroup && phantomBoxGroup.children.length > 0) {
    const child = phantomBoxGroup.children[0]
    phantomBoxGroup.remove(child)
    if (child instanceof THREE.LineSegments) {
      child.geometry.dispose()
      ;(child.material as THREE.Material).dispose()
    }
  }

  const spacing = 1.25
  const cubeGeo = new THREE.BoxGeometry(0.92, 0.92, 0.92)
  const wireGeo = new THREE.EdgesGeometry(cubeGeo)

  if (currentMode.value === 'outer_product') {
    // --- Outer Product Visualization ---
    // Column vector (4, 1) placed at left: X = -3.2, Y: r from 0 to 3
    // Row vector (1, 4) placed at top: Y = +2.6, X: c from 0 to 3
    // Result Matrix (4, 4) formed in center: X: c from 0 to 3, Y: r from 0 to 3

    // 1. Column Vector (4, 1)
    for (let r = 0; r < 4; r++) {
      const val = baseValues[r]
      const tex = createNumberTexture(val, palBase.bg, palBase.text, palBase.border)
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: 1
      })
      const mesh = new THREE.Mesh(cubeGeo, mat)
      const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(palBase.border), linewidth: 2 })
      const wireframe = new THREE.LineSegments(wireGeo, wireMat)
      mesh.add(wireframe)

      const x = -3.2
      const y = -(r - 1.5) * spacing
      const z = 0
      mesh.position.set(x, y, z)
      mesh.userData = { type: 'base', r, c: 0, val }
      scene.add(mesh)

      activeCubes.push({
        mesh,
        wireframe,
        type: 'base',
        r,
        c: 0,
        val,
        pos0: new THREE.Vector3(x, y, z),
        posTarget: new THREE.Vector3(x, y, z)
      })
      allMeshes.push(mesh)
    }

    // 2. Row Vector (1, 4)
    for (let c = 0; c < 4; c++) {
      const val = rowValues[c]
      const tex = createNumberTexture(val, palRow.bg, palRow.text, palRow.border)
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: 1
      })
      const mesh = new THREE.Mesh(cubeGeo, mat)
      const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(palRow.border), linewidth: 2 })
      const wireframe = new THREE.LineSegments(wireGeo, wireMat)
      mesh.add(wireframe)

      const x = 0.5 + (c - 1.5) * spacing
      const y = 2.6
      const z = 0
      mesh.position.set(x, y, z)
      mesh.userData = { type: 'row', r: 0, c, val }
      scene.add(mesh)

      activeCubes.push({
        mesh,
        wireframe,
        type: 'row',
        r: 0,
        c,
        val,
        pos0: new THREE.Vector3(x, y, z),
        posTarget: new THREE.Vector3(x, y, z)
      })
      allMeshes.push(mesh)
    }

    // 3. Central Outer Product Matrix (4, 4)
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        const productVal = baseValues[r] * rowValues[c]
        const tex = createNumberTexture(productVal, palMatrix.bg, palMatrix.text, palMatrix.border)
        const mat = new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.3,
          metalness: 0.1,
          transparent: true,
          opacity: 0 // invisible initially, fades in with progress
        })
        const mesh = new THREE.Mesh(cubeGeo, mat)
        const wireMat = new THREE.LineBasicMaterial({
          color: new THREE.Color(palMatrix.border),
          linewidth: 1.5,
          transparent: true,
          opacity: 0
        })
        const wireframe = new THREE.LineSegments(wireGeo, wireMat)
        mesh.add(wireframe)

        const x = 0.5 + (c - 1.5) * spacing
        const y = -(r - 1.5) * spacing
        const z = 0
        mesh.position.set(x, y, z)
        mesh.userData = { type: 'outer', r, c, val: productVal }
        scene.add(mesh)

        activeCubes.push({
          mesh,
          wireframe,
          type: 'outer',
          r,
          c,
          val: productVal,
          pos0: new THREE.Vector3(x, y, z),
          posTarget: new THREE.Vector3(x, y, z)
        })
        allMeshes.push(mesh)
      }
    }

    // Text Labels
    if (labelSpritesGroup) {
      const colLabel = createTextSprite('col[:, None]: (4, 1)', isDark.value ? '#93c5fd' : '#1d4ed8', 34)
      colLabel.position.set(-3.2, 2.6, 0)
      colLabel.scale.set(3.8, 1.2, 1)
      labelSpritesGroup.add(colLabel)

      const mulSign = createTextSprite('⊗', isDark.value ? '#fbbf24' : '#d97706', 56)
      mulSign.position.set(-1.4, 2.6, 0)
      mulSign.scale.set(1.4, 1.4, 1)
      labelSpritesGroup.add(mulSign)

      const rowLabel = createTextSprite('row[None, :]: (1, 4)', isDark.value ? '#6ee7b7' : '#047857', 34)
      rowLabel.position.set(0.5, 3.4, 0)
      rowLabel.scale.set(3.8, 1.2, 1)
      labelSpritesGroup.add(rowLabel)
    }

  } else {
    // --- 1D Rank-1 / Column / Row Orientation Visualization ---
    for (let i = 0; i < N; i++) {
      const val = baseValues[i]
      const tex = createNumberTexture(val, palBase.bg, palBase.text, palBase.border)
      const mat = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.3,
        metalness: 0.1,
        transparent: true,
        opacity: 1
      })
      const mesh = new THREE.Mesh(cubeGeo, mat)
      const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(palBase.border), linewidth: 2 })
      const wireframe = new THREE.LineSegments(wireGeo, wireMat)
      mesh.add(wireframe)

      let x = 0
      let y = 0
      let z = 0

      if (currentMode.value === 'rank1') {
        // Flat 1D vector along X-axis
        x = (i - 1.5) * spacing
        y = 0
        z = 0
      } else if (currentMode.value === 'column') {
        // Column vector along Y-axis: (4, 1)
        x = 0
        y = -(i - 1.5) * spacing
        z = 0
      } else if (currentMode.value === 'row') {
        // Row vector along X-axis within 2D matrix frame: (1, 4)
        x = (i - 1.5) * spacing
        y = 0
        z = 0
      }

      mesh.position.set(x, y, z)
      mesh.userData = { type: 'base', idx: i, val }
      scene.add(mesh)

      activeCubes.push({
        mesh,
        wireframe,
        type: 'base',
        r: currentMode.value === 'column' ? i : 0,
        c: currentMode.value === 'column' ? 0 : i,
        val,
        pos0: new THREE.Vector3(x, y, z),
        posTarget: new THREE.Vector3(x, y, z)
      })
      allMeshes.push(mesh)
    }

    // Top Label for Orientation
    if (labelSpritesGroup) {
      const titleSprite = createTextSprite(
        `${modeConfig.value.title} • Shape: ${modeConfig.value.shape}`,
        isDark.value ? '#93c5fd' : '#1e40af',
        36
      )
      titleSprite.position.set(0, currentMode.value === 'column' ? 2.6 : 1.8, 0)
      titleSprite.scale.set(4.8, 1.3, 1)
      labelSpritesGroup.add(titleSprite)
    }

    // Phantom outline showing 2D bounding grid for (1, 4) or (4, 1)
    if (phantomBoxGroup && (currentMode.value === 'row' || currentMode.value === 'column')) {
      const boxW = currentMode.value === 'row' ? 4 * spacing : 1 * spacing
      const boxH = currentMode.value === 'column' ? 4 * spacing : 1 * spacing
      const boxGeo = new THREE.BoxGeometry(boxW, boxH, 0.95)
      const phantomWireGeo = new THREE.EdgesGeometry(boxGeo)
      const phantomWireMat = new THREE.LineDashedMaterial({
        color: isDark.value ? 0x94a3b8 : 0x64748b,
        dashSize: 0.2,
        gapSize: 0.1,
        linewidth: 1.5,
        transparent: true,
        opacity: 0.6
      })
      const phantomLines = new THREE.LineSegments(phantomWireGeo, phantomWireMat)
      phantomLines.computeLineDistances()
      phantomLines.position.set(0, 0, 0)
      phantomBoxGroup.add(phantomLines)
    }
  }

  updateFloatingAxes()
  applyProgressInterpolation(progress.value)
}

// Progress interpolation for outer product expansion
const applyProgressInterpolation = (t: number) => {
  if (currentMode.value !== 'outer_product') return

  // Phase 1: t in [0, 0.4] -> Column & Row vectors pulse with zero-copy ghost replication
  // Phase 2: t in [0.4, 0.75] -> Outer product matrix cells emerge
  // Phase 3: t in [0.75, 1.0] -> Full outer product matrix solidifies with values

  const matrixOpacity = t < 0.3 ? 0 : Math.min(1, (t - 0.3) / 0.7)

  activeCubes.forEach((c) => {
    if (c.type === 'outer') {
      const mat = c.mesh.material as THREE.MeshStandardMaterial
      const wire = c.wireframe.material as THREE.LineBasicMaterial
      mat.opacity = matrixOpacity
      wire.opacity = matrixOpacity

      if (t >= 0.8) {
        c.mesh.scale.set(1.05, 1.05, 1.05)
      } else {
        c.mesh.scale.set(1, 1, 1)
      }
    } else if (c.type === 'base' || c.type === 'row') {
      if (t > 0 && t < 0.4) {
        const s = 1 + Math.sin(t * Math.PI * 5) * 0.05
        c.mesh.scale.set(s, s, s)
      } else {
        c.mesh.scale.set(1, 1, 1)
      }
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

  if (activeCubes.length === 0) return

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  for (const c of activeCubes) {
    const pos = c.pos0
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

  // In 1D rank-1, highlight Axis 0 along X
  if (currentMode.value === 'rank1') {
    const arrowX = createBoldArrow(new THREE.Vector3(1, 0, 0), lenX, 0x3b82f6, 'axis 0 (1D Length)', 0.055, 0.16, 0.35)
    floatingAxesGroup.add(arrowX)
  } else {
    // 2D framing: X is axis 1 (Cols), Y is axis 0 (Rows)
    const arrowX = createBoldArrow(new THREE.Vector3(1, 0, 0), lenX, 0xef4444, 'axis 1 (Cols)', 0.055, 0.16, 0.35)
    floatingAxesGroup.add(arrowX)

    const arrowY = createBoldArrow(new THREE.Vector3(0, 1, 0), lenY, 0x10b981, 'axis 0 (Rows)', 0.055, 0.16, 0.35)
    floatingAxesGroup.add(arrowY)
  }
}

// User Actions
const setMode = (mode: TransformMode) => {
  currentMode.value = mode
  progress.value = mode === 'outer_product' ? 0 : 1
  isPlaying.value = false
  selectedCell.value = null
  buildSceneForMode()
  emitInspection()
}

const togglePlay = () => {
  if (currentMode.value !== 'outer_product') return
  if (progress.value >= 1) progress.value = 0
  isPlaying.value = !isPlaying.value
}

const stepNext = () => {
  if (currentMode.value !== 'outer_product') return
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
  progress.value = currentMode.value === 'outer_product' ? 0 : 1
  selectedCell.value = null
  buildSceneForMode()
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
      if (data.type === 'outer') {
        selectedCell.value = {
          label: `Matrix Cell [${data.r}, ${data.c}]`,
          r: data.r,
          c: data.c,
          val: data.val
        }
      } else if (data.type === 'base') {
        selectedCell.value = {
          label: `Column Element col[${data.r ?? data.idx}]`,
          r: data.r ?? data.idx,
          val: data.val
        }
      } else if (data.type === 'row') {
        selectedCell.value = {
          label: `Row Element row[${data.c}]`,
          c: data.c,
          val: data.val
        }
      }
      emitInspection()
    }
  }
}

const emitInspection = () => {
  const cfg = modeConfig.value
  const cell = selectedCell.value

  const details: Record<string, any> = {
    'Active Topology': cfg.title,
    'NumPy Shape': cfg.shape,
    'Rank (ndim)': `${cfg.ndim}D Array`,
    'Memory Strides': cfg.strides,
    'Transposition (.T)': cfg.transposeShape,
    'Code Equivalent': cfg.formula,
    'Architectural Invariant': cfg.desc
  }

  if (cell) {
    details['Inspected Element'] = cell.label
    if (cell.val !== undefined) details['Element Value'] = cell.val
    if (currentMode.value === 'outer_product' && cell.r !== undefined && cell.c !== undefined) {
      details['Outer Product Derivation'] = `col[${cell.r}] (${baseValues[cell.r]}) × row[${cell.c}] (${rowValues[cell.c]}) = ${cell.val}`
    }
  }

  emit('inspect', {
    title: `np.newaxis & Outer Product: ${cfg.title}`,
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
    buildSceneForMode()
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
        <!-- Top Status Bar: Orientation Transformers & Outer Product Mode -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <!-- Mode Switcher -->
          <div class="flex items-center gap-1.5 bg-card/90 backdrop-blur-md p-1 rounded-md border border-line shadow-xs pointer-events-auto text-xs font-mono">
            <button
              type="button"
              @click="setMode('rank1')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="currentMode === 'rank1' ? 'bg-brand-blue text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="arr: Shape (4,) Flat 1D rank-1 vector without orientation"
            >
              Flat (4,)
            </button>
            <button
              type="button"
              @click="setMode('column')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="currentMode === 'column' ? 'bg-brand-purple text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="arr[:, np.newaxis]: Shape (4, 1) Column Vector"
            >
              Column (4, 1)
            </button>
            <button
              type="button"
              @click="setMode('row')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="currentMode === 'row' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="arr[np.newaxis, :]: Shape (1, 4) Row Vector"
            >
              Row (1, 4)
            </button>
            <button
              type="button"
              @click="setMode('outer_product')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="currentMode === 'outer_product' ? 'bg-brand-amber text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="(4, 1) * (1, 4) -> Full (4, 4) Outer Product Multiplication Matrix"
            >
              Outer Product (4, 4)
            </button>
          </div>

          <!-- Formula Invariant Badge -->
          <div class="flex items-center gap-2 pointer-events-auto text-xs font-mono">
            <span class="px-2.5 py-1 rounded-md bg-card/90 backdrop-blur-md border border-line shadow-xs font-bold text-ink">
              Shape: {{ modeConfig.shape }}
            </span>
          </div>
        </div>

        <!-- Bottom Overlay: Active Instruction Note -->
        <div class="flex items-center justify-between text-[0.68rem] text-muted">
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-brand-blue" />
            <span>
              {{ modeConfig.desc }}
            </span>
          </div>
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono hidden sm:block">
            Drag: Orbit 360° • Click: Inspect Vector Cell
          </div>
        </div>
      </div>
    </div>

    <!-- Execution & Step Toolbar -->
    <div class="bg-card border border-line rounded-lg p-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-xs">
      <!-- Playback Controls (Active for Outer Product) -->
      <div class="flex items-center gap-2">
        <template v-if="currentMode === 'outer_product'">
          <button
            type="button"
            @click="togglePlay"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors shadow-xs"
            :class="isPlaying ? 'bg-brand-amber text-white' : 'bg-brand-blue hover:bg-brand-blue-hover text-white'"
          >
            <Pause v-if="isPlaying" class="w-3.5 h-3.5 fill-current" />
            <Play v-else class="w-3.5 h-3.5 fill-current" />
            <span>{{ isPlaying ? 'Pause' : 'Compute Outer Product' }}</span>
          </button>

          <button
            type="button"
            @click="stepNext"
            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono font-medium text-ink transition-colors"
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
          <div class="flex items-center gap-1.5 text-xs font-mono text-muted pl-1">
            <input
              id="outerProgress"
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
        </template>

        <template v-else>
          <!-- Quick Flip / Transpose Preview Button -->
          <div class="flex items-center gap-1.5 text-xs font-mono">
            <span class="text-muted">Transposition Rule:</span>
            <span class="font-bold text-brand-purple bg-card-subtle px-2 py-0.5 rounded border border-line">
              {{ modeConfig.transposeShape }}
            </span>
          </div>
        </template>

        <button
          type="button"
          @click="resetCamera"
          class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono text-muted hover:text-ink transition-colors"
          title="Reset 3D camera angle"
        >
          <span>↺ View</span>
        </button>
      </div>

      <!-- Outer Product Invariant Formula -->
      <div class="flex items-center gap-2 text-xs font-mono">
        <span class="text-muted">Broadcast Invariant:</span>
        <span class="font-bold text-brand-green">
          (N, 1) ⊙ (1, M) → (N, M) ✓
        </span>
      </div>
    </div>

    <!-- Fluid Telemetry HUD Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Active Vector Shape</div>
        <div class="font-bold text-brand-blue truncate" title="Current topology">
          {{ modeConfig.shape }} (ndim: {{ modeConfig.ndim }})
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Transposition (.T)</div>
        <div class="font-bold text-brand-purple truncate" :title="modeConfig.transposeShape">
          {{ modeConfig.transposeShape }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Memory Stride Layout</div>
        <div class="font-bold text-emerald-600 dark:text-emerald-400 truncate" title="Strides in bytes">
          {{ modeConfig.strides }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Outer Invariant</div>
        <div class="font-bold text-brand-green truncate" title="(N, 1) * (1, M) -> (N, M)">
          (4, 1) ⊙ (1, 4) = (4, 4) ✓
        </div>
      </div>
    </div>
  </div>
</template>

