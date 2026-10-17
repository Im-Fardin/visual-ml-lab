<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  RotateCcw,
  Sparkles,
  Layers,
  Cpu,
  Link,
  Unlink,
  CheckCircle2,
  AlertCircle
} from 'lucide-vue-next'
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

// Dimension Mode strictly restricted to 1D | 2D | 3D
type DimensionMode = '1D' | '2D' | '3D'
const currentDim = ref<DimensionMode>('2D')

// Slicing parameters
// 1D: start, stop, step
const s1D_start = ref(1)
const s1D_stop = ref(7)
const s1D_step = ref(2)

// 2D: row, col
const s2D_rStart = ref(1)
const s2D_rStop = ref(3)
const s2D_rStep = ref(1)
const s2D_cStart = ref(1)
const s2D_cStop = ref(4)
const s2D_cStep = ref(1)

// 3D: sheet, r, c
const s3D_sheet = ref<number | 'all'>('all')
const s3D_rStart = ref(0)
const s3D_rStop = ref(2)
const s3D_cStart = ref(0)
const s3D_cStop = ref(3)

// View vs Copy Mode
type MemoryMode = 'view' | 'copy'
const memoryMode = ref<MemoryMode>('view')
const isMutated = ref(false)
const mutationMessage = ref<string | null>(null)

// Base Arrays data
const baseData1D = ref<number[]>([10, 11, 12, 13, 14, 15, 16, 17])
const baseData2D = ref<number[][]>([
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19]
])
const baseData3D = ref<number[][][]>([
  [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8]
  ],
  [
    [9, 10, 11],
    [12, 13, 14],
    [15, 16, 17]
  ]
])

// Three.js instances
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animFrameId = 0
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2(-999, -999)

interface CubeEntry {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  key: string
  origPos: THREE.Vector3
  slicePos: THREE.Vector3
  isSliced: boolean
  baseVal: number
  sliceVal: number
}

let baseCubes: CubeEntry[] = []
let linkLinesGroup: THREE.Group | null = null
let floatingAxesGroup: THREE.Group | null = null

const initialCameraPos = new THREE.Vector3(0.8, 0.8, 9.2)
const initialCameraTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

// Sliced Membership Logic
const isSliced1D = (i: number) => {
  return i >= s1D_start.value && i < s1D_stop.value && (i - s1D_start.value) % s1D_step.value === 0
}

const isSliced2D = (r: number, c: number) => {
  const inRow = r >= s2D_rStart.value && r < s2D_rStop.value && (r - s2D_rStart.value) % s2D_rStep.value === 0
  const inCol = c >= s2D_cStart.value && c < s2D_cStop.value && (c - s2D_cStart.value) % s2D_cStep.value === 0
  return inRow && inCol
}

const isSliced3D = (d: number, r: number, c: number) => {
  const inSheet = s3D_sheet.value === 'all' || s3D_sheet.value === d
  const inRow = r >= s3D_rStart.value && r < s3D_rStop.value
  const inCol = c >= s3D_cStart.value && c < s3D_cStop.value
  return inSheet && inRow && inCol
}

// Slice syntax string
const sliceSyntax = computed(() => {
  if (currentDim.value === '1D') {
    return `v[${s1D_start.value}:${s1D_stop.value}:${s1D_step.value}]`
  }
  if (currentDim.value === '2D') {
    return `M[${s2D_rStart.value}:${s2D_rStop.value}, ${s2D_cStart.value}:${s2D_cStop.value}]`
  }
  const s = s3D_sheet.value === 'all' ? ':' : s3D_sheet.value
  return `T[${s}, ${s3D_rStart.value}:${s3D_rStop.value}, ${s3D_cStart.value}:${s3D_cStop.value}]`
})

// Sliced Shape
const sliceShape = computed(() => {
  if (currentDim.value === '1D') {
    const count = Math.max(0, Math.ceil((s1D_stop.value - s1D_start.value) / s1D_step.value))
    return { text: `(${count},)`, count }
  }
  if (currentDim.value === '2D') {
    const rCount = Math.max(0, Math.ceil((s2D_rStop.value - s2D_rStart.value) / s2D_rStep.value))
    const cCount = Math.max(0, Math.ceil((s2D_cStop.value - s2D_cStart.value) / s2D_cStep.value))
    return { text: `(${rCount}, ${cCount})`, count: rCount * cCount }
  }
  const dCount = s3D_sheet.value === 'all' ? 2 : 1
  const rCount = Math.max(0, s3D_rStop.value - s3D_rStart.value)
  const cCount = Math.max(0, s3D_cStop.value - s3D_cStart.value)
  return { text: s3D_sheet.value === 'all' ? `(${dCount}, ${rCount}, ${cCount})` : `(${rCount}, ${cCount})`, count: dCount * rCount * cCount }
})

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
  dirLight.position.set(6, 12, 10)
  scene.add(dirLight)

  const fillLight = new THREE.DirectionalLight(0xbfdbfe, 0.4)
  fillLight.position.set(-8, -4, -6)
  scene.add(fillLight)

  const gridHelper = new THREE.GridHelper(16, 16, isDark.value ? 0x334155 : 0xcbd5e1, isDark.value ? 0x1e293b : 0xe2ded4)
  gridHelper.position.y = -2.2
  scene.add(gridHelper)

  linkLinesGroup = new THREE.Group()
  scene.add(linkLinesGroup)

  floatingAxesGroup = new THREE.Group()
  scene.add(floatingAxesGroup)

  rebuildScene()

  const animate = () => {
    animFrameId = requestAnimationFrame(animate)
    if (controls) controls.update()
    if (renderer && scene && camera) {
      renderer.render(scene, camera)
    }
  }

  animate()
  updateVisuals()
  emitInspection()
}

// Rebuild scene for 1D, 2D, 3D
const rebuildScene = () => {
  if (!scene) return

  // Dispose link lines
  if (linkLinesGroup) {
    while (linkLinesGroup.children.length > 0) {
      const child = linkLinesGroup.children[0]
      linkLinesGroup.remove(child)
      if (child instanceof THREE.Line) {
        child.geometry.dispose()
        ;(child.material as THREE.Material).dispose()
      }
    }
  }

  baseCubes.forEach((entry) => {
    scene?.remove(entry.mesh)
    entry.mesh.geometry.dispose()
    ;(entry.mesh.material as THREE.Material).dispose()
    entry.wireframe.geometry.dispose()
  })
  baseCubes = []

  const cubeGeo = new THREE.BoxGeometry(0.95, 0.95, 0.95)
  const wireGeo = new THREE.EdgesGeometry(cubeGeo)

  if (currentDim.value === '1D') {
    // 1D: 8 elements
    for (let i = 0; i < 8; i++) {
      const val = baseData1D.value[i]
      const tex = createNumberTexture(val, '#ffffff', '#1e40af', '#2563eb')
      const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 1 })
      const mesh = new THREE.Mesh(cubeGeo, mat)

      const wireMat = new THREE.LineBasicMaterial({ color: 0x2563eb })
      const wireframe = new THREE.LineSegments(wireGeo, wireMat)
      mesh.add(wireframe)

      const x0 = (i - 3.5) * 1.25
      const y0 = 0
      const z0 = 0

      mesh.position.set(x0, y0, z0)
      mesh.userData = { key: `1D_${i}`, index: i }
      scene.add(mesh)

      baseCubes.push({
        mesh,
        wireframe,
        key: `1D_${i}`,
        origPos: new THREE.Vector3(x0, y0, z0),
        slicePos: new THREE.Vector3(x0, y0, 1.0),
        isSliced: isSliced1D(i),
        baseVal: val,
        sliceVal: val
      })
    }
  } else if (currentDim.value === '2D') {
    // 2D: 4 rows x 5 cols
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 5; c++) {
        const val = baseData2D.value[r][c]
        const tex = createNumberTexture(val, '#ffffff', '#1e40af', '#2563eb')
        const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 1 })
        const mesh = new THREE.Mesh(cubeGeo, mat)

        const wireMat = new THREE.LineBasicMaterial({ color: 0x2563eb })
        const wireframe = new THREE.LineSegments(wireGeo, wireMat)
        mesh.add(wireframe)

        const x0 = (c - 2) * 1.25
        const y0 = -(r - 1.5) * 1.25
        const z0 = 0

        mesh.position.set(x0, y0, z0)
        mesh.userData = { key: `2D_${r}_${c}`, r, c }
        scene.add(mesh)

        baseCubes.push({
          mesh,
          wireframe,
          key: `2D_${r}_${c}`,
          origPos: new THREE.Vector3(x0, y0, z0),
          slicePos: new THREE.Vector3(x0, y0, 1.0),
          isSliced: isSliced2D(r, c),
          baseVal: val,
          sliceVal: val
        })
      }
    }
  } else {
    // 3D: 2 sheets x 3 rows x 3 cols = 18 cubes
    for (let d = 0; d < 2; d++) {
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const val = baseData3D.value[d][r][c]
          const tex = createNumberTexture(val, '#ffffff', '#1e40af', '#2563eb')
          const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 1 })
          const mesh = new THREE.Mesh(cubeGeo, mat)

          const wireMat = new THREE.LineBasicMaterial({ color: 0x2563eb })
          const wireframe = new THREE.LineSegments(wireGeo, wireMat)
          mesh.add(wireframe)

          const x0 = (c - 1) * 1.3
          const y0 = -(r - 1) * 1.3
          const z0 = (d - 0.5) * 2.4

          mesh.position.set(x0, y0, z0)
          mesh.userData = { key: `3D_${d}_${r}_${c}`, d, r, c }
          scene.add(mesh)

          baseCubes.push({
            mesh,
            wireframe,
            key: `3D_${d}_${r}_${c}`,
            origPos: new THREE.Vector3(x0, y0, z0),
            slicePos: new THREE.Vector3(x0, y0, z0 + 1.2),
            isSliced: isSliced3D(d, r, c),
            baseVal: val,
            sliceVal: val
          })
        }
      }
    }
  }

  updateFloatingAxes()
}

// Bounding-Frame Coordinate Axes: Origin at bottom-back-left, hugging outer perimeter
const updateFloatingAxes = () => {
  if (!floatingAxesGroup) return

  while (floatingAxesGroup.children.length > 0) {
    const child = floatingAxesGroup.children[0]
    floatingAxesGroup.remove(child)
  }

  if (baseCubes.length === 0) return

  // Compute bounding box of base cubes
  let minX = Infinity, maxX = -Infinity
  let minY = Infinity, maxY = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  for (const entry of baseCubes) {
    const pos = entry.origPos
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

// Update cube positions, materials, and view-link connector lines
const updateVisuals = () => {
  if (linkLinesGroup) {
    while (linkLinesGroup.children.length > 0) {
      const child = linkLinesGroup.children[0]
      linkLinesGroup.remove(child)
      if (child instanceof THREE.Line) {
        child.geometry.dispose()
        ;(child.material as THREE.Material).dispose()
      }
    }
  }

  baseCubes.forEach((entry) => {
    let sliced = false
    let currentVal = 0

    if (currentDim.value === '1D') {
      const parts = entry.key.split('_')
      if (parts[0] !== '1D') return
      const idx = Number(parts[1])
      sliced = isSliced1D(idx)
      currentVal = baseData1D.value[idx] ?? 0
    } else if (currentDim.value === '2D') {
      const parts = entry.key.split('_')
      if (parts[0] !== '2D') return
      const r = Number(parts[1])
      const c = Number(parts[2])
      sliced = isSliced2D(r, c)
      currentVal = baseData2D.value[r]?.[c] ?? 0
    } else {
      const parts = entry.key.split('_')
      if (parts[0] !== '3D') return
      const d = Number(parts[1])
      const r = Number(parts[2])
      const c = Number(parts[3])
      sliced = isSliced3D(d, r, c)
      currentVal = baseData3D.value[d]?.[r]?.[c] ?? 0
    }

    entry.isSliced = sliced

    if (sliced) {
      entry.mesh.position.copy(entry.slicePos)
      entry.mesh.scale.set(1.08, 1.08, 1.08)

      const bg = isMutated.value ? '#fef3c7' : '#dbeafe'
      const text = isMutated.value ? '#92400e' : '#1e40af'
      const border = isMutated.value ? '#f59e0b' : '#2563eb'

      const displayVal = isMutated.value
        ? (memoryMode.value === 'view' ? currentVal : 999)
        : currentVal

      const tex = createNumberTexture(displayVal, bg, text, border)
      const mat = entry.mesh.material as THREE.MeshStandardMaterial
      mat.map = tex
      mat.needsUpdate = true
      mat.transparent = false
      mat.opacity = 1.0
      ;(entry.wireframe.material as THREE.LineBasicMaterial).color.set(border)
      ;(entry.wireframe.material as THREE.LineBasicMaterial).opacity = 1.0

      // In VIEW MODE: Draw glowing link line between origin baseline and extracted position
      if (memoryMode.value === 'view' && linkLinesGroup) {
        const points = [entry.origPos, entry.slicePos]
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points)
        const lineMat = new THREE.LineDashedMaterial({
          color: isMutated.value ? 0xf59e0b : 0x3b82f6,
          linewidth: 2,
          scale: 1,
          dashSize: 0.15,
          gapSize: 0.08
        })
        const line = new THREE.Line(lineGeo, lineMat)
        line.computeLineDistances()
        linkLinesGroup.add(line)
      }
    } else {
      entry.mesh.position.copy(entry.origPos)
      entry.mesh.scale.set(0.95, 0.95, 0.95)

      const tex = createNumberTexture(currentVal, '#f8fafc', '#64748b', '#cbd5e1')
      const mat = entry.mesh.material as THREE.MeshStandardMaterial
      mat.map = tex
      mat.needsUpdate = true
      mat.transparent = true
      mat.opacity = 0.25
      ;(entry.wireframe.material as THREE.LineBasicMaterial).color.set(0x94a3b8)
      ;(entry.wireframe.material as THREE.LineBasicMaterial).opacity = 0.3
    }
  })
}

// User Action: Mutate Sliced Element
const mutateSlice = () => {
  isMutated.value = true

  if (memoryMode.value === 'view') {
    // In VIEW mode, shared RAM buffer is modified in-place!
    if (currentDim.value === '1D') {
      for (let i = 0; i < 8; i++) {
        if (isSliced1D(i)) baseData1D.value[i] = 999
      }
    } else if (currentDim.value === '2D') {
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 5; c++) {
          if (isSliced2D(r, c)) baseData2D.value[r][c] = 999
        }
      }
    } else {
      for (let d = 0; d < 2; d++) {
        for (let r = 0; r < 3; r++) {
          for (let c = 0; c < 3; c++) {
            if (isSliced3D(d, r, c)) baseData3D.value[d][r][c] = 999
          }
        }
      }
    }
    mutationMessage.value = 'Views share pointer memory: Base array mutated to 999 in-place!'
  } else {
    // In COPY mode, independent RAM buffer allocated: base array untouched!
    mutationMessage.value = 'Copies allocate new memory: Extracted slice mutated to 999; Base array remains clean!'
  }

  updateVisuals()
  emitInspection()
}

// Reset data structures without triggering prematurely typed visuals
const resetBaseData = () => {
  isMutated.value = false
  mutationMessage.value = null

  baseData1D.value = [10, 11, 12, 13, 14, 15, 16, 17]
  baseData2D.value = [
    [0, 1, 2, 3, 4],
    [5, 6, 7, 8, 9],
    [10, 11, 12, 13, 14],
    [15, 16, 17, 18, 19]
  ]
  baseData3D.value = [
    [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8]
    ],
    [
      [9, 10, 11],
      [12, 13, 14],
      [15, 16, 17]
    ]
  ]
}

// Reset array values action
const resetValues = () => {
  resetBaseData()
  updateVisuals()
  emitInspection()
}

const resetCameraForDim = (dim: DimensionMode) => {
  if (!camera || !controls) return
  if (dim === '1D') {
    camera.position.set(0, 0.8, 9.5)
    controls.target.set(0, 0, 0)
  } else if (dim === '2D') {
    camera.position.set(0, 0.9, 9.2)
    controls.target.set(0, 0, 0)
  } else {
    // 3D: Front isometric perspective to clearly view depth sheets, rows, and columns
    camera.position.set(2.4, 2.0, 8.8)
    controls.target.set(0, 0, 0)
  }
  controls.update()
}

const switchDim = (dim: DimensionMode) => {
  currentDim.value = dim
  resetBaseData()
  rebuildScene()
  updateVisuals()
  resetCameraForDim(dim)
  emitInspection()
}

const resetCamera = () => {
  resetCameraForDim(currentDim.value)
}

const onPointerDown = (event: MouseEvent) => {
  if (!canvasRef.value || !camera) return

  const rect = canvasRef.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const meshes = baseCubes.map((n) => n.mesh)
  const intersects = raycaster.intersectObjects(meshes, false)

  if (intersects.length > 0) {
    const clickedMesh = intersects[0].object as THREE.Mesh
    const data = clickedMesh.userData
    if (data) {
      emitInspection(data.key)
    }
  }
}

const emitInspection = (key?: string) => {
  emit('inspect', {
    title: `Slicing Inspection (${currentDim.value}): ${sliceSyntax.value}`,
    details: {
      'Active Rank': currentDim.value,
      'Extracted Slice': sliceSyntax.value,
      'Extracted Shape': sliceShape.value.text,
      'Elements Sliced': `${sliceShape.value.count} cubes`,
      'Memory Mode': memoryMode.value === 'view' ? 'View (Shared 0x7ffd pointer)' : 'Copy (Independent 0x8b12 RAM)',
      'Link Indicators': memoryMode.value === 'view' ? 'Active Pointer Rays Connected' : 'Severed / Disconnected',
      'Mutation State': isMutated.value ? (memoryMode.value === 'view' ? 'Base RAM Mutated (999)' : 'Base RAM Safe & Intact') : 'Clean / Original'
    }
  })
}

watch([s1D_start, s1D_stop, s1D_step, s2D_rStart, s2D_rStop, s2D_rStep, s2D_cStart, s2D_cStop, s2D_cStep, s3D_sheet, s3D_rStart, s3D_rStop, s3D_cStart, s3D_cStop], () => {
  updateVisuals()
  emitInspection()
})

watch(memoryMode, () => {
  updateVisuals()
  emitInspection()
})

watch(currentDim, (dim) => {
  if (baseCubes.length > 0 && !baseCubes[0].key.startsWith(dim + '_')) {
    switchDim(dim)
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
        <!-- Top Status Bar: 1D, 2D, 3D Switches & Syntax Badge -->
        <div class="flex items-center justify-between gap-2">
          <!-- Rank Mode Switches -->
          <div class="flex items-center gap-1.5 bg-card/90 backdrop-blur-md p-1 rounded-md border border-line shadow-xs pointer-events-auto text-xs font-mono">
            <span class="text-[10px] text-muted font-bold px-1 uppercase">Rank:</span>
            <button
              type="button"
              @click="switchDim('1D')"
              class="px-2 py-0.5 rounded transition-colors"
              :class="currentDim === '1D' ? 'bg-brand-blue text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
            >
              1D
            </button>
            <button
              type="button"
              @click="switchDim('2D')"
              class="px-2 py-0.5 rounded transition-colors"
              :class="currentDim === '2D' ? 'bg-brand-blue text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
            >
              2D
            </button>
            <button
              type="button"
              @click="switchDim('3D')"
              class="px-2 py-0.5 rounded transition-colors"
              :class="currentDim === '3D' ? 'bg-brand-blue text-white shadow-xs font-bold' : 'text-muted hover:text-ink hover:bg-card-subtle'"
            >
              3D
            </button>
            <span class="text-line mx-1">|</span>
            <span class="font-bold text-brand-blue">{{ sliceSyntax }}</span>
          </div>

          <!-- View vs Copy Mode Indicator -->
          <div class="flex items-center gap-2 pointer-events-auto">
            <span
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono font-bold border shadow-xs"
              :class="memoryMode === 'view' ? 'bg-brand-blue-soft text-brand-blue border-brand-blue/30' : 'bg-brand-purple/15 text-brand-purple border-brand-purple/30'"
            >
              <Link v-if="memoryMode === 'view'" class="w-3.5 h-3.5" />
              <Unlink v-else class="w-3.5 h-3.5" />
              <span>{{ memoryMode === 'view' ? 'View (Shared Buffer Link)' : 'Copy (Independent Memory)' }}</span>
            </span>
          </div>
        </div>

        <!-- Mutation Status Alert Banner -->
        <div v-if="mutationMessage" class="self-center pointer-events-auto transition-all animate-fade-in">
          <div
            class="px-3 py-1.5 rounded-md text-xs font-mono font-semibold shadow-md border flex items-center gap-2"
            :class="memoryMode === 'view' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40'"
          >
            <AlertCircle v-if="memoryMode === 'view'" class="w-4 h-4" />
            <CheckCircle2 v-else class="w-4 h-4" />
            <span>{{ mutationMessage }}</span>
          </div>
        </div>

        <!-- 360 Hint -->
        <div class="self-end text-[0.68rem] text-muted bg-card/90 border border-line px-2 py-0.5 rounded select-none pointer-events-none hidden sm:block">
          Drag: Orbit 360° • Click: Inspect Element
        </div>
      </div>
    </div>

    <!-- Execution & Slice Toolbar -->
    <div class="bg-card border border-line rounded-lg p-2.5 flex flex-col gap-2 shadow-xs">
      <!-- Row 1: Slicing Controls per Dimension -->
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
        <!-- 1D Controls -->
        <div v-if="currentDim === '1D'" class="flex items-center gap-2">
          <span class="font-bold text-ink">v[start:stop:step]:</span>
          <label class="text-muted">Start</label>
          <input type="number" min="0" max="6" v-model.number="s1D_start" class="w-10 px-1 py-0.5 border border-line rounded bg-card-subtle text-ink" />
          <label class="text-muted">Stop</label>
          <input type="number" min="1" max="8" v-model.number="s1D_stop" class="w-10 px-1 py-0.5 border border-line rounded bg-card-subtle text-ink" />
          <label class="text-muted">Step</label>
          <input type="number" min="1" max="2" v-model.number="s1D_step" class="w-9 px-1 py-0.5 border border-line rounded bg-card-subtle text-ink" />
        </div>

        <!-- 2D Controls -->
        <div v-else-if="currentDim === '2D'" class="flex flex-wrap items-center gap-2">
          <span class="font-bold text-ink">Row:</span>
          <input type="number" min="0" max="3" v-model.number="s2D_rStart" class="w-10 px-1 py-0.5 border border-line rounded bg-card-subtle text-ink" />
          <span>:</span>
          <input type="number" min="1" max="4" v-model.number="s2D_rStop" class="w-10 px-1 py-0.5 border border-line rounded bg-card-subtle text-ink" />
          <span class="font-bold text-ink ml-2">Col:</span>
          <input type="number" min="0" max="4" v-model.number="s2D_cStart" class="w-10 px-1 py-0.5 border border-line rounded bg-card-subtle text-ink" />
          <span>:</span>
          <input type="number" min="1" max="5" v-model.number="s2D_cStop" class="w-10 px-1 py-0.5 border border-line rounded bg-card-subtle text-ink" />
        </div>

        <!-- 3D Controls -->
        <div v-else class="flex flex-wrap items-center gap-2">
          <span class="font-bold text-ink">Sheet:</span>
          <button
            type="button"
            @click="s3D_sheet = s3D_sheet === 'all' ? 0 : (s3D_sheet === 0 ? 1 : 'all')"
            class="px-2 py-0.5 border border-line rounded bg-card-subtle font-bold text-brand-blue"
          >
            {{ s3D_sheet === 'all' ? 'All (:) ' : `Sheet ${s3D_sheet}` }}
          </button>
          <span class="font-bold text-ink ml-1">Rows:</span>
          <input type="number" min="0" max="2" v-model.number="s3D_rStart" class="w-10 px-1 py-0.5 border border-line rounded bg-card-subtle text-ink" />
          <span>:</span>
          <input type="number" min="1" max="3" v-model.number="s3D_rStop" class="w-10 px-1 py-0.5 border border-line rounded bg-card-subtle text-ink" />
          <span class="font-bold text-ink ml-1">Cols:</span>
          <input type="number" min="0" max="2" v-model.number="s3D_cStart" class="w-10 px-1 py-0.5 border border-line rounded bg-card-subtle text-ink" />
          <span>:</span>
          <input type="number" min="1" max="3" v-model.number="s3D_cStop" class="w-10 px-1 py-0.5 border border-line rounded bg-card-subtle text-ink" />
        </div>

        <!-- Mode Toggle: View vs Copy -->
        <div class="flex items-center gap-1.5 bg-card-subtle p-0.5 rounded-md border border-line shrink-0">
          <button
            type="button"
            @click="memoryMode = 'view'"
            class="px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors"
            :class="memoryMode === 'view' ? 'bg-card text-brand-blue font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
          >
            View (Shared RAM)
          </button>
          <button
            type="button"
            @click="memoryMode = 'copy'"
            class="px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors"
            :class="memoryMode === 'copy' ? 'bg-card text-brand-purple font-bold shadow-xs border border-line' : 'text-muted hover:text-ink'"
          >
            Copy (New Buffer)
          </button>
        </div>
      </div>

      <!-- Row 2: Mutate View/Copy Action & Camera Reset -->
      <div class="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-line/40">
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="mutateSlice"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors shadow-xs"
            :class="memoryMode === 'view' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'"
            title="Mutate sliced elements to test view vs copy semantics"
          >
            <Sparkles class="w-3.5 h-3.5" />
            <span>Mutate Sliced Element (Set to 999)</span>
          </button>

          <button
            type="button"
            @click="resetValues"
            class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono text-muted hover:text-ink transition-colors"
            title="Restore original values"
          >
            <RotateCcw class="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>

        <div class="flex items-center gap-2">
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
    </div>

    <!-- Fluid Telemetry HUD Grid -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Slice Syntax</div>
        <div class="font-bold text-brand-blue truncate">{{ sliceSyntax }}</div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Extracted Shape</div>
        <div class="font-bold text-ink truncate">{{ sliceShape.text }} • {{ sliceShape.count }} cells</div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Memory Allocation</div>
        <div
          class="font-bold truncate"
          :class="memoryMode === 'view' ? 'text-brand-blue' : 'text-brand-purple'"
        >
          {{ memoryMode === 'view' ? 'View (0B allocated, shares RAM)' : `Copy (${sliceShape.count * 8}B allocated)` }}
        </div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Formula Invariant</div>
        <div class="font-bold text-brand-green truncate" title="view[slice] shares buffer • copy() allocates new RAM">
          view[slice] shares buffer • copy() allocates RAM
        </div>
      </div>
    </div>
  </div>
</template>
