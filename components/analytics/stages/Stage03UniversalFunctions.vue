<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Play, Pause, StepForward, RotateCcw, Zap, Clock, Cpu, Sparkles } from 'lucide-vue-next'
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

// Two 1D Arrays of 8 elements
const arrA = [2, 4, 6, 8, 10, 12, 14, 16]
const arrB = [3, 1, 4, 2, 5, 2, 3, 1]
const N = arrA.length

type UfuncOp = 'add' | 'multiply' | 'sin'
const activeOp = ref<UfuncOp>('multiply')

type ExecMode = 'vectorized' | 'loop'
const activeMode = ref<ExecMode>('vectorized')

// Simulation State
const isPlaying = ref(false)
const progress = ref(0) // 0 to 1
const loopIndex = ref(-1) // 0 to N-1
let loopTimer: ReturnType<typeof setInterval> | null = null

// Results
const resultValues = computed(() => {
  return arrA.map((a, i) => {
    const b = arrB[i]
    if (activeOp.value === 'multiply') return a * b
    if (activeOp.value === 'add') return a + b
    return Number(Math.sin(a).toFixed(2))
  })
})

interface VisualNode {
  mesh: THREE.Mesh
  wireframe: THREE.LineSegments
  lane: 'A' | 'B' | 'Result'
  idx: number
  val: number
}

const allCubes: VisualNode[] = []
let laserWaveMesh: THREE.Mesh | null = null
let pointerCursorMesh: THREE.Mesh | null = null

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animFrameId = 0
let axesGroup: THREE.Group | null = null

const initialCameraPos = new THREE.Vector3(4.8, 4.0, 7.8)
const initialTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

// Color palettes
const palA = { bg: '#ffffff', text: '#1e40af', border: '#3b82f6' }
const palB = { bg: '#ffffff', text: '#065f46', border: '#10b981' }
const palRes = { bg: '#ffffff', text: '#7c3aed', border: '#8b5cf6' }
const palPending = { bg: '#ffffff', text: '#64748b', border: '#cbd5e1' }

const activeCodeSnippet = computed(() => {
  if (activeMode.value === 'vectorized') {
    return `# NumPy Vectorized Ufunc (SIMD C-Loop, 1 Clock Pass)
import numpy as np

a = np.array(${JSON.stringify(arrA)})
b = np.array(${JSON.stringify(arrB)})

# Runs in compiled C at hardware memory bandwidth speed
result = a ${activeOp.value === 'multiply' ? '*' : activeOp.value === 'add' ? '+' : '* np.sin(a)'} b
print("Vectorized Output:", result)`
  } else {
    return `# Python Sequential Loop (Heavy Overhead per Iteration)
a = ${JSON.stringify(arrA)}
b = ${JSON.stringify(arrB)}
result = []

for i in range(len(a)):
    # Python bytecode eval + dynamic type checks on every step
    result.append(a[i] ${activeOp.value === 'multiply' ? '*' : activeOp.value === 'add' ? '+' : '* math.sin(a[i])'} b[i])`
  }
})

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

  axesGroup = new THREE.Group()
  scene.add(axesGroup)

  // Build Laser Wave (for vectorized) and Pointer (for loop)
  const laserGeom = new THREE.PlaneGeometry(0.3, 3.8)
  const laserMat = new THREE.MeshBasicMaterial({
    color: 0x8b5cf6,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide
  })
  laserWaveMesh = new THREE.Mesh(laserGeom, laserMat)
  laserWaveMesh.rotation.x = Math.PI / 2
  laserWaveMesh.visible = false
  scene.add(laserWaveMesh)

  const pointerGeom = new THREE.ConeGeometry(0.3, 0.6, 16)
  const pointerMat = new THREE.MeshBasicMaterial({ color: 0xef4444 })
  pointerCursorMesh = new THREE.Mesh(pointerGeom, pointerMat)
  pointerCursorMesh.rotation.x = Math.PI
  pointerCursorMesh.visible = false
  scene.add(pointerCursorMesh)

  buildCubes()
  renderAxes()

  const animate = () => {
    animFrameId = requestAnimationFrame(animate)

    // Vectorized wave visual
    if (activeMode.value === 'vectorized') {
      if (progress.value > 0 && progress.value < 1) {
        laserWaveMesh!.visible = true
        pointerCursorMesh!.visible = false
        const startX = -3.5
        const endX = 3.5
        laserWaveMesh!.position.x = THREE.MathUtils.lerp(startX, endX, progress.value)
        laserWaveMesh!.position.y = 0
        laserWaveMesh!.position.z = 0
      } else {
        laserWaveMesh!.visible = false
      }
    } else {
      // Loop pointer visual
      laserWaveMesh!.visible = false
      if (loopIndex.value >= 0 && loopIndex.value < N) {
        pointerCursorMesh!.visible = true
        const dX = 1.05
        const offsetX = ((N - 1) * dX) / 2
        pointerCursorMesh!.position.set(loopIndex.value * dX - offsetX, 2.2, 0)
      } else {
        pointerCursorMesh!.visible = false
      }
    }

    controls?.update()
    renderer?.render(scene!, camera!)
  }

  animate()
  emitInspectInfo()
}

// Build 3 rows of 8 cubes: Array A (top), Array B (middle), Result (bottom)
const buildCubes = () => {
  if (!scene) return

  allCubes.forEach(c => {
    scene?.remove(c.mesh)
    c.mesh.geometry.dispose()
    ;(c.mesh.material as THREE.Material).dispose()
    c.wireframe.geometry.dispose()
  })
  allCubes.length = 0

  const boxGeom = new THREE.BoxGeometry(0.85, 0.85, 0.85)
  const edgesGeom = new THREE.EdgesGeometry(boxGeom)
  const dX = 1.05
  const offsetX = ((N - 1) * dX) / 2

  // Array A (Y = 1.3)
  for (let i = 0; i < N; i++) {
    const val = arrA[i]
    const tex = createNumberTexture(val, palA.bg, palA.text, palA.border)
    const mat = new THREE.MeshBasicMaterial({ map: tex })
    const mesh = new THREE.Mesh(boxGeom, mat)
    mesh.position.set(i * dX - offsetX, 1.3, 0)

    const wireMat = new THREE.LineBasicMaterial({ color: 0x1e40af, transparent: true, opacity: 0.3 })
    const wireframe = new THREE.LineSegments(edgesGeom, wireMat)
    mesh.add(wireframe)
    scene.add(mesh)
    allCubes.push({ mesh, wireframe, lane: 'A', idx: i, val })
  }

  // Array B (Y = 0.0)
  for (let i = 0; i < N; i++) {
    const val = arrB[i]
    const tex = createNumberTexture(val, palB.bg, palB.text, palB.border)
    const mat = new THREE.MeshBasicMaterial({ map: tex })
    const mesh = new THREE.Mesh(boxGeom, mat)
    mesh.position.set(i * dX - offsetX, 0.0, 0)

    const wireMat = new THREE.LineBasicMaterial({ color: 0x065f46, transparent: true, opacity: 0.3 })
    const wireframe = new THREE.LineSegments(edgesGeom, wireMat)
    mesh.add(wireframe)
    scene.add(mesh)
    allCubes.push({ mesh, wireframe, lane: 'B', idx: i, val })
  }

  // Result Array (Y = -1.3)
  for (let i = 0; i < N; i++) {
    const isComputed = activeMode.value === 'vectorized' ? progress.value >= 0.9 : i <= loopIndex.value
    const val = resultValues.value[i]
    const pal = isComputed ? palRes : palPending
    const textLabel = isComputed ? val : '?'
    const tex = createNumberTexture(textLabel as any, pal.bg, pal.text, pal.border)
    const mat = new THREE.MeshBasicMaterial({ map: tex })
    const mesh = new THREE.Mesh(boxGeom, mat)
    mesh.position.set(i * dX - offsetX, -1.3, 0)

    const wireMat = new THREE.LineBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.3 })
    const wireframe = new THREE.LineSegments(edgesGeom, wireMat)
    mesh.add(wireframe)
    scene.add(mesh)
    allCubes.push({ mesh, wireframe, lane: 'Result', idx: i, val })
  }
}

const renderAxes = () => {
  if (!scene || !axesGroup) return

  while (axesGroup.children.length > 0) {
    const obj = axesGroup.children[0]
    axesGroup.remove(obj)
  }

  const origin = new THREE.Vector3(-4.5, -2.0, -1.0)
  const arrowX = createBoldArrow(origin, new THREE.Vector3(1, 0, 0), 2.5, 0x2563eb)
  axesGroup.add(arrowX)
  const labelX = createTextSprite('axis 0 (elements: 8)', 0x2563eb)
  labelX.position.set(origin.x + 3.0, origin.y, origin.z)
  axesGroup.add(labelX)
}

const emitInspectInfo = () => {
  emit('inspect', {
    title: activeMode.value === 'vectorized' ? 'Vectorized Ufunc: Single SIMD Pass' : 'Python Sequential Loop: Step-by-Step',
    details: {
      'Operation': activeOp.value,
      'Mode': activeMode.value,
      'Array Size': `${N} elements`,
      'Array A Shape': '(8,)',
      'Array B Shape': '(8,)',
      'Hardware Speedup': activeMode.value === 'vectorized' ? '50x-200x Faster (SIMD vector registers, no GIL)' : 'Slow (Python interpreter overhead, dynamic type boxing)',
      'Progress': activeMode.value === 'vectorized' ? `${Math.round(progress.value * 100)}%` : `${Math.max(0, loopIndex.value + 1)} / ${N} elements`
    }
  })
}

const triggerExecution = () => {
  isPlaying.value = true
  if (activeMode.value === 'vectorized') {
    progress.value = 0
    let step = 0
    const interval = setInterval(() => {
      step += 0.08
      progress.value = Math.min(1, step)
      if (progress.value >= 1) {
        clearInterval(interval)
        isPlaying.value = false
        buildCubes()
        emitInspectInfo()
      }
    }, 40)
  } else {
    loopIndex.value = -1
    buildCubes()
    loopTimer = setInterval(() => {
      if (loopIndex.value < N - 1) {
        loopIndex.value++
        buildCubes()
        emitInspectInfo()
      } else {
        clearInterval(loopTimer!)
        isPlaying.value = false
      }
    }, 350)
  }
}

const resetSimulation = () => {
  isPlaying.value = false
  if (loopTimer) clearInterval(loopTimer)
  progress.value = 0
  loopIndex.value = -1
  buildCubes()
  emitInspectInfo()
}

const setMode = (m: ExecMode) => {
  activeMode.value = m
  resetSimulation()
}

const setOp = (op: UfuncOp) => {
  activeOp.value = op
  resetSimulation()
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
  }
})

onMounted(() => {
  initThree()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (animFrameId) cancelAnimationFrame(animFrameId)
  if (loopTimer) clearInterval(loopTimer)
  renderer?.dispose()
})
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <!-- Top Action Toolbar -->
    <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
      <!-- Mode Toggle: Vectorized vs Loop -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">Execution:</span>
        <button
          type="button"
          @click="setMode('vectorized')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeMode === 'vectorized' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <Zap class="w-3.5 h-3.5" />
          <span>Vectorized (SIMD C-speed)</span>
        </button>
        <button
          type="button"
          @click="setMode('loop')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeMode === 'loop' ? 'bg-amber-600 text-white font-bold border-amber-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <Clock class="w-3.5 h-3.5" />
          <span>Python for Loop</span>
        </button>

        <span class="text-line mx-1">|</span>

        <!-- Operator Selectors -->
        <span class="text-muted">ufunc:</span>
        <button
          type="button"
          @click="setOp('multiply')"
          class="px-2 py-0.5 rounded border text-[11px]"
          :class="activeOp === 'multiply' ? 'bg-brand-blue/15 text-brand-blue font-bold border-brand-blue/40' : 'bg-card border-line text-muted'"
        >
          a * b
        </button>
        <button
          type="button"
          @click="setOp('add')"
          class="px-2 py-0.5 rounded border text-[11px]"
          :class="activeOp === 'add' ? 'bg-brand-blue/15 text-brand-blue font-bold border-brand-blue/40' : 'bg-card border-line text-muted'"
        >
          a + b
        </button>
      </div>

      <!-- Performance Badge -->
      <div class="flex items-center gap-2 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <Cpu class="w-3.5 h-3.5" :class="activeMode === 'vectorized' ? 'text-emerald-500' : 'text-amber-500'" />
        <span class="font-bold text-ink">{{ activeMode === 'vectorized' ? '1 Cycle (Parallel)' : 'N Steps (Iterative)' }}</span>
      </div>
    </div>

    <!-- Main 3D Viewport -->
    <div class="relative w-full rounded-lg border border-line bg-stage shadow-xs min-h-[420px] h-[460px] overflow-hidden select-none">
      <div ref="containerRef" class="w-full h-full relative cursor-grab active:cursor-grabbing">
        <canvas ref="canvasRef" class="w-full h-full block" />

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

        <!-- Floating Lane Labels (Top-Left) -->
        <div class="absolute top-3 left-3 flex flex-col gap-1.5 bg-card/85 backdrop-blur-sm border border-line p-2.5 rounded-md shadow-xs text-xs font-mono">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-brand-blue" />
            <span>Array A: <code>[2, 4, 6, 8, 10, 12, 14, 16]</code></span>
          </div>
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-600" />
            <span>Array B: <code>[3, 1, 4, 2, 5, 2, 3, 1]</code></span>
          </div>
          <div class="flex items-center gap-2 border-t border-line/60 pt-1">
            <span class="w-2.5 h-2.5 rounded-full bg-purple-600" />
            <span class="font-bold text-ink">Result: <code>a {{ activeOp === 'multiply' ? '*' : '+' }} b</code></span>
          </div>
        </div>
      </div>

      <!-- Bottom Interactive Trigger Strip -->
      <div class="absolute bottom-3 left-3 flex items-center gap-2 bg-card/90 backdrop-blur-sm border border-line px-3 py-1.5 rounded-md text-xs font-mono">
        <button
          type="button"
          @click="triggerExecution"
          :disabled="isPlaying"
          class="flex items-center gap-1 px-3 py-1.5 rounded bg-brand-blue text-white font-bold cursor-pointer disabled:opacity-50"
        >
          <Play class="w-3.5 h-3.5 fill-current" />
          <span>{{ activeMode === 'vectorized' ? 'Execute SIMD Pass' : 'Run Python Loop' }}</span>
        </button>

        <button
          type="button"
          @click="resetSimulation"
          class="px-2.5 py-1.5 rounded border border-line text-muted hover:text-ink cursor-pointer"
        >
          Reset
        </button>
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active Ufunc Implementation:</span>
        <span class="text-brand-blue font-semibold">{{ activeMode === 'vectorized' ? 'Compiled C-Loop (SIMD)' : 'Interpreted Python For-Loop' }}</span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ activeCodeSnippet }}</code></pre>
    </div>
  </div>
</template>

