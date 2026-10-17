<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Play, Pause, StepForward, RotateCcw, Crosshair, Copy, ShieldCheck, ArrowRight, Shuffle } from 'lucide-vue-next'
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

// 4x4 Matrix Base Data
const ROWS = 4
const COLS = 4
const sourceMatrix = [
  [10, 11, 12, 13],
  [20, 21, 22, 23],
  [30, 31, 32, 33],
  [40, 41, 42, 43]
]

// Presets
type PresetKey = 'diagonal' | 'duplicates' | 'row_shuffle'
const activePreset = ref<PresetKey>('duplicates')

// Animation Progress
const progress = ref(0)
const isPlaying = ref(false)
const selectedCell = ref<{ r: number; c: number; val: number; isGathered: boolean; outIdx?: number } | null>(null)

// Preset definitions
const presetConfig = computed(() => {
  if (activePreset.value === 'diagonal') {
    return {
      title: 'Main Diagonal Gather',
      rows: [0, 1, 2, 3],
      cols: [0, 1, 2, 3],
      outShape: '(4,)',
      code: 'arr[[0, 1, 2, 3], [0, 1, 2, 3]]',
      desc: 'Pairwise coordinate indexing extracts diagonal elements: [10, 21, 32, 43].',
      items: [
        { r: 0, c: 0, val: 10 },
        { r: 1, c: 1, val: 21 },
        { r: 2, c: 2, val: 32 },
        { r: 3, c: 3, val: 43 }
      ]
    }
  } else if (activePreset.value === 'duplicates') {
    return {
      title: 'Arbitrary & Duplicate Gathers',
      rows: [0, 2, 2, 3],
      cols: [1, 3, 0, 2],
      outShape: '(4,)',
      code: 'arr[[0, 2, 2, 3], [1, 3, 0, 2]]',
      desc: 'Row 2 is sampled twice: cells (2, 3) and (2, 0) extracted. Duplicate gathers spawn copies!',
      items: [
        { r: 0, c: 1, val: 11 },
        { r: 2, c: 3, val: 33 },
        { r: 2, c: 0, val: 30 },
        { r: 3, c: 2, val: 42 }
      ]
    }
  } else {
    return {
      title: 'Row Permutation / Shuffle',
      rows: [3, 0, 2, 1],
      cols: null, // all columns
      outShape: '(4, 4)',
      code: 'arr[[3, 0, 2, 1]]',
      desc: 'Reorders entire rows (3, 0, 2, 1), replicating train/test shuffling without Python loops.',
      items: [
        // Row 3
        { r: 3, c: 0, val: 40 }, { r: 3, c: 1, val: 41 }, { r: 3, c: 2, val: 42 }, { r: 3, c: 3, val: 43 },
        // Row 0
        { r: 0, c: 0, val: 10 }, { r: 0, c: 1, val: 11 }, { r: 0, c: 2, val: 12 }, { r: 0, c: 3, val: 13 },
        // Row 2
        { r: 2, c: 0, val: 30 }, { r: 2, c: 1, val: 31 }, { r: 2, c: 2, val: 32 }, { r: 2, c: 3, val: 33 },
        // Row 1
        { r: 1, c: 0, val: 20 }, { r: 1, c: 1, val: 21 }, { r: 1, c: 2, val: 22 }, { r: 1, c: 3, val: 23 }
      ]
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
let laserLinesGroup: THREE.Group | null = null

const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2(-999, -999)

const initialCameraPos = new THREE.Vector3(0.0, 1.2, 11.0)
const initialCameraTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

// Color palettes per row of source matrix
const rowPalettes = [
  { bg: '#ffffff', text: '#1e40af', border: '#2563eb' }, // Row 0: Blue
  { bg: '#ffffff', text: '#7c3aed', border: '#8b5cf6' }, // Row 1: Purple
  { bg: '#ffffff', text: '#059669', border: '#10b981' }, // Row 2: Green
  { bg: '#ffffff', text: '#d97706', border: '#f59e0b' }  // Row 3: Amber
]
const palExtracted = { bg: '#ecfdf5', text: '#065f46', border: '#10b981' } // Emerald Extracted

interface MatrixCube {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  r: number
  c: number
  val: number
}

interface ClonedCube {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  sourceR: number
  sourceC: number
  val: number
  pos0: THREE.Vector3
  posTarget: THREE.Vector3
}

let sourceCubes: MatrixCube[] = []
let clonedCubes: ClonedCube[] = []
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
  const gridHelper = new THREE.GridHelper(22, 22, isDark.value ? 0x334155 : 0xcbd5e1, isDark.value ? 0x1e293b : 0xe2ded4)
  gridHelper.position.y = -3.0
  scene.add(gridHelper)

  floatingAxesGroup = new THREE.Group()
  scene.add(floatingAxesGroup)

  labelSpritesGroup = new THREE.Group()
  scene.add(labelSpritesGroup)

  laserLinesGroup = new THREE.Group()
  scene.add(laserLinesGroup)

  buildFancyScene()

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

// Build 4x4 matrix and cloned output cubes
const buildFancyScene = () => {
  if (!scene) return

  // Dispose existing source cubes
  sourceCubes.forEach((c) => {
    scene?.remove(c.mesh)
    c.mesh.geometry.dispose()
    ;(c.mesh.material as THREE.Material).dispose()
    c.wireframe.geometry.dispose()
  })
  sourceCubes = []

  // Dispose cloned cubes
  clonedCubes.forEach((c) => {
    scene?.remove(c.mesh)
    c.mesh.geometry.dispose()
    ;(c.mesh.material as THREE.Material).dispose()
    c.wireframe.geometry.dispose()
  })
  clonedCubes = []
  allMeshes = []

  while (labelSpritesGroup && labelSpritesGroup.children.length > 0) {
    const child = labelSpritesGroup.children[0]
    labelSpritesGroup.remove(child)
  }

  while (laserLinesGroup && laserLinesGroup.children.length > 0) {
    const child = laserLinesGroup.children[0]
    laserLinesGroup.remove(child)
  }

  const spacing = 1.25
  const cubeGeo = new THREE.BoxGeometry(0.92, 0.92, 0.92)
  const wireGeo = new THREE.EdgesGeometry(cubeGeo)

  // Position source matrix on the Left: center X = -2.6
  const sourceCenterX = -2.6
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const val = sourceMatrix[r][c]
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

      const x = sourceCenterX + (c - 1.5) * spacing
      const y = -(r - 1.5) * spacing
      const z = 0
      mesh.position.set(x, y, z)
      mesh.userData = { type: 'source', r, c, val }
      scene.add(mesh)

      sourceCubes.push({ mesh, wireframe, r, c, val })
      allMeshes.push(mesh)
    }
  }

  // Cloned Target Cubes
  const items = presetConfig.value.items
  const isRowPerm = activePreset.value === 'row_shuffle'
  const targetCenterX = +2.6

  items.forEach((item, idx) => {
    const val = item.val
    const pal = palExtracted
    const tex = createNumberTexture(val, pal.bg, pal.text, pal.border)
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      roughness: 0.25,
      metalness: 0.1,
      transparent: true,
      opacity: 0 // invisible initially, lifts & flies
    })
    const mesh = new THREE.Mesh(cubeGeo, mat)
    const wireMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(pal.border),
      linewidth: 2,
      transparent: true,
      opacity: 0
    })
    const wireframe = new THREE.LineSegments(wireGeo, wireMat)
    mesh.add(wireframe)

    // Initial position starts directly at the source cube in matrix
    const startX = sourceCenterX + (item.c - 1.5) * spacing
    const startY = -(item.r - 1.5) * spacing
    const startZ = 0

    // Target position in output layout
    let targetX = 0
    let targetY = 0
    let targetZ = 0

    if (isRowPerm) {
      // 4x4 matrix layout on right
      const outR = Math.floor(idx / 4)
      const outC = idx % 4
      targetX = targetCenterX + (outC - 1.5) * spacing
      targetY = -(outR - 1.5) * spacing
      targetZ = 0
    } else {
      // 1D horizontal vector on right or center
      targetX = targetCenterX + (idx - 1.5) * spacing
      targetY = 0
      targetZ = 0
    }

    mesh.position.set(startX, startY, startZ)
    mesh.userData = { type: 'clone', r: item.r, c: item.c, val, outIdx: idx }
    scene.add(mesh)

    clonedCubes.push({
      mesh,
      wireframe,
      sourceR: item.r,
      sourceC: item.c,
      val,
      pos0: new THREE.Vector3(startX, startY, startZ),
      posTarget: new THREE.Vector3(targetX, targetY, targetZ)
    })
    allMeshes.push(mesh)
  })

  // Text Labels
  if (labelSpritesGroup) {
    const sourceLabel = createTextSprite('Source Matrix arr (4, 4)', isDark.value ? '#93c5fd' : '#1d4ed8', 34)
    sourceLabel.position.set(sourceCenterX, 2.7, 0)
    sourceLabel.scale.set(4.2, 1.2, 1)
    labelSpritesGroup.add(sourceLabel)

    const outTitle = `Extracted Copy: shape ${presetConfig.value.outShape}`
    const outLabel = createTextSprite(outTitle, isDark.value ? '#6ee7b7' : '#047857', 34)
    outLabel.position.set(targetCenterX, 2.7, 0)
    outLabel.scale.set(4.4, 1.2, 1)
    labelSpritesGroup.add(outLabel)
  }

  updateFloatingAxes()
  applyProgressInterpolation(progress.value)
}

// Interpolation: Lift clone from source matrix and fly to output layout
const applyProgressInterpolation = (t: number) => {
  const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

  clonedCubes.forEach((clone) => {
    const mat = clone.mesh.material as THREE.MeshStandardMaterial
    const wire = clone.wireframe.material as THREE.LineBasicMaterial

    if (t <= 0.05) {
      mat.opacity = 0
      wire.opacity = 0
      clone.mesh.position.copy(clone.pos0)
    } else {
      mat.opacity = Math.min(1, t * 1.5)
      wire.opacity = Math.min(1, t * 1.5)

      // Parabolic arc in Z to emphasize lifting a clone out of memory
      const currentPos = new THREE.Vector3().lerpVectors(clone.pos0, clone.posTarget, eased)
      const arcZ = Math.sin(t * Math.PI) * 1.2
      currentPos.z += arcZ
      clone.mesh.position.copy(currentPos)
    }
  })

  // Laser lines connecting source cells to target cells
  if (laserLinesGroup) {
    while (laserLinesGroup.children.length > 0) {
      const child = laserLinesGroup.children[0]
      laserLinesGroup.remove(child)
      if (child instanceof THREE.Line) {
        child.geometry.dispose()
        ;(child.material as THREE.Material).dispose()
      }
    }

    if (t > 0.1 && t < 0.95) {
      const lineMat = new THREE.LineDashedMaterial({
        color: isDark.value ? 0x38bdf8 : 0x0284c7,
        dashSize: 0.15,
        gapSize: 0.1,
        transparent: true,
        opacity: Math.sin(t * Math.PI) * 0.8
      })

      clonedCubes.forEach((c) => {
        const geo = new THREE.BufferGeometry().setFromPoints([c.pos0, c.mesh.position])
        const line = new THREE.Line(geo, lineMat)
        line.computeLineDistances()
        laserLinesGroup.add(line)
      })
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

  if (sourceCubes.length === 0) return

  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  for (const c of sourceCubes) {
    const pos = c.mesh.position
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
  progress.value = 0
  isPlaying.value = false
  buildFancyScene()
  emitInspection()
}

const togglePlay = () => {
  if (progress.value >= 1) progress.value = 0
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
  buildFancyScene()
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
      selectedCell.value = {
        r: data.r,
        c: data.c,
        val: data.val,
        isGathered: data.type === 'clone',
        outIdx: data.outIdx
      }
      emitInspection()
    }
  }
}

const emitInspection = () => {
  const cfg = presetConfig.value
  const cell = selectedCell.value

  const details: Record<string, any> = {
    'Fancy Index Syntax': cfg.code,
    'Output Topology': `Shape ${cfg.outShape}`,
    'Target Description': cfg.desc,
    'Memory Mechanism': 'ALWAYS A COPY (New memory buffer allocated in RAM)',
    'View vs Copy Rule': 'Basic slicing (:) yields strided views. Integer array indexing always allocates copies!',
    'Duplicate Handling': 'Duplicate coordinate indices create duplicate cloned elements safely without source mutation.'
  }

  if (cell) {
    details['Inspected Element'] = `Source Cell: arr[${cell.r}, ${cell.c}] = ${cell.val}`
    if (cell.outIdx !== undefined) {
      details['Output Array Slot'] = `Output Index [${cell.outIdx}] = ${cell.val} (Cloned Memory Buffer)`
    }
  }

  emit('inspect', {
    title: `Fancy Indexing: ${cfg.title}`,
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
    buildFancyScene()
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

  sourceCubes.forEach((c) => {
    c.mesh.geometry.dispose()
    ;(c.mesh.material as THREE.Material).dispose()
    c.wireframe.geometry.dispose()
  })
  sourceCubes = []

  clonedCubes.forEach((c) => {
    c.mesh.geometry.dispose()
    ;(c.mesh.material as THREE.Material).dispose()
    c.wireframe.geometry.dispose()
  })
  clonedCubes = []
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
        <!-- Top Status Bar: Presets & Memory Tag -->
        <div class="flex items-center justify-between gap-2 flex-wrap">
          <!-- Preset Selector -->
          <div class="flex items-center gap-1.5 bg-card/90 backdrop-blur-md p-1 rounded-md border border-line shadow-xs pointer-events-auto text-xs font-mono">
            <button
              type="button"
              @click="setPreset('duplicates')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="activePreset === 'duplicates' ? 'bg-brand-blue text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="Duplicate & Arbitrary coordinate index arrays"
            >
              Duplicates & Scatter
            </button>
            <button
              type="button"
              @click="setPreset('diagonal')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="activePreset === 'diagonal' ? 'bg-brand-purple text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="Diagonal coordinate extraction: [0, 1, 2, 3], [0, 1, 2, 3]"
            >
              Diagonal Gather
            </button>
            <button
              type="button"
              @click="setPreset('row_shuffle')"
              class="px-2.5 py-0.5 rounded font-medium transition-colors"
              :class="activePreset === 'row_shuffle' ? 'bg-emerald-600 text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
              title="Row Permutation: arr[[3, 0, 2, 1]]"
            >
              Row Permutation
            </button>
          </div>

          <!-- Memory Copy Badge -->
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card/90 backdrop-blur-md border border-line shadow-xs font-mono text-xs pointer-events-auto">
            <Copy class="w-3.5 h-3.5 text-brand-purple" />
            <span class="font-bold text-ink">Memory Behavior:</span>
            <span class="text-brand-purple font-semibold">Always COPY (New Buffer)</span>
          </div>
        </div>

        <!-- Bottom Overlay: Active Instruction Note -->
        <div class="flex items-center justify-between text-[0.68rem] text-muted">
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-brand-blue" />
            <span>
              {{ presetConfig.desc }}
            </span>
          </div>
          <div class="bg-card/90 border border-line px-2 py-0.5 rounded shadow-xs font-mono hidden sm:block">
            Drag: Orbit 360° • Click: Inspect Gathered Element
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
          <span>{{ isPlaying ? 'Pause' : 'Extract via Fancy Index' }}</span>
        </button>

        <button
          type="button"
          @click="stepNext"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono font-medium text-ink transition-colors"
          title="Step extraction"
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
            id="fancyProgress"
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

      <!-- Quick Syntax Preview -->
      <div class="flex items-center gap-2 text-xs font-mono">
        <span class="text-muted">Syntax:</span>
        <span class="font-bold text-brand-blue bg-card-subtle px-2 py-0.5 rounded border border-line">
          {{ presetConfig.code }}
        </span>
      </div>
    </div>

    <!-- Fluid Telemetry HUD Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Active Syntax</div>
        <div class="font-bold text-brand-blue truncate" :title="presetConfig.code">
          {{ presetConfig.code }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Output Topology</div>
        <div class="font-bold text-brand-purple truncate">
          {{ presetConfig.outShape }} Output Array
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Memory Policy</div>
        <div class="font-bold text-emerald-600 dark:text-emerald-400 truncate" title="Independent memory allocation">
          Full Copy in RAM ✓
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Duplicate Safety</div>
        <div class="font-bold text-brand-green truncate" title="Duplicates clone without mutation">
          Safe Cloned Elements ✓
        </div>
      </div>
    </div>
  </div>
</template>

