<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Play, Pause, StepForward, RotateCcw } from 'lucide-vue-next'
import { createNumberTexture, createWideTextTexture } from '~/utils/threeTexture'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', data: { title: string; details: Record<string, any> }): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

// Dot Product State
const xVec = [2, 3, 1, 4]
const wVec = [3, 1, 2, 2]
const pairProducts = xVec.map((x, i) => x * wVec[i]) // [6, 3, 2, 8]
const totalDotProduct = pairProducts.reduce((a, b) => a + b, 0) // 19

const currentStep = ref(0) // 0 to 4 (0 = idle, 1..4 = element processed)
const isPlaying = ref(false)
const selectedPair = ref<number | null>(0)

// Running sum up to currentStep
const runningSum = computed(() => {
  let sum = 0
  for (let i = 0; i < currentStep.value; i++) {
    sum += pairProducts[i]
  }
  return sum
})

const formulaInvariant = computed(() => {
  return props.topic?.invariant || 'x · w = ∑ (xᵢ × wᵢ) ∈ ℝ'
})

// Three.js instances
let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animFrameId = 0
const raycaster = new THREE.Raycaster()
const mouse = new THREE.Vector2(-999, -999)

interface MeshItem {
  mesh: THREE.Mesh
  index: number
  type: 'x' | 'w' | 'acc'
}
const interactiveMeshes: MeshItem[] = []
const initialCameraPos = new THREE.Vector3(0.8, 1.2, 8.2)
const initialCameraTarget = new THREE.Vector3(0, 0, 0)
const { isDark } = useTheme()

// Visual nodes
const xNodeMeshes: THREE.Mesh[] = []
const wNodeMeshes: THREE.Mesh[] = []
const linkLines: THREE.Line[] = []
let accumulatorMesh: THREE.Mesh | null = null

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

  // Controls (360° Free Orbit)
  controls = new OrbitControls(camera, canvasRef.value)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.minPolarAngle = 0.2
  controls.maxPolarAngle = Math.PI / 2 + 0.1
  controls.target.copy(initialCameraTarget)

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, isDark.value ? 1.5 : 1.3)
  scene.add(ambientLight)

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0)
  dirLight.position.set(5, 10, 8)
  scene.add(dirLight)

  // Floor grid helper
  const gridHelper = new THREE.GridHelper(12, 12, isDark.value ? 0x2b3340 : 0xd1d5db, isDark.value ? 0x1f242e : 0xe5e7eb)
  gridHelper.position.y = -2.6
  scene.add(gridHelper)

  // Square cube geometry (0.85x0.85x0.85) ensures 1:1 aspect ratio without texture distortion
  const n = xVec.length
  const spacing = 1.6
  const boxGeom = new THREE.BoxGeometry(0.85, 0.85, 0.85)
  const edgesGeom = new THREE.EdgesGeometry(boxGeom)

  // Vector X Row (Y = +1.5) with sharp 256x256 textures
  for (let i = 0; i < n; i++) {
    const xPos = (i - (n - 1) / 2) * spacing
    const numberTex = createNumberTexture(xVec[i], '#ffffff', '#1e40af', '#2563eb')
    const mat = new THREE.MeshBasicMaterial({
      map: numberTex,
      transparent: false
    })
    const mesh = new THREE.Mesh(boxGeom, mat)
    mesh.position.set(xPos, 1.5, 0)
    mesh.userData = { type: 'x', index: i, val: xVec[i] }

    const wireMat = new THREE.LineBasicMaterial({
      color: 0x2563eb,
      transparent: true,
      opacity: 0.35
    })
    mesh.add(new THREE.LineSegments(edgesGeom, wireMat))

    scene.add(mesh)
    xNodeMeshes.push(mesh)
    interactiveMeshes.push({ mesh, index: i, type: 'x' })
  }

  // Vector W Row (Y = 0.25) with sharp 256x256 textures
  for (let i = 0; i < n; i++) {
    const xPos = (i - (n - 1) / 2) * spacing
    const numberTex = createNumberTexture(wVec[i], '#ffffff', '#78350f', '#d97706')
    const mat = new THREE.MeshBasicMaterial({
      map: numberTex,
      transparent: false
    })
    const mesh = new THREE.Mesh(boxGeom, mat)
    mesh.position.set(xPos, 0.25, 0)
    mesh.userData = { type: 'w', index: i, val: wVec[i] }

    const wireMat = new THREE.LineBasicMaterial({
      color: 0xd97706,
      transparent: true,
      opacity: 0.35
    })
    mesh.add(new THREE.LineSegments(edgesGeom, wireMat))

    scene.add(mesh)
    wNodeMeshes.push(mesh)
    interactiveMeshes.push({ mesh, index: i, type: 'w' })

    // Link Line
    const lineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(xPos, 1.05, 0),
      new THREE.Vector3(xPos, 0.7, 0)
    ])
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x9aa5b5,
      transparent: true,
      opacity: 0.5
    })
    const line = new THREE.Line(lineGeom, lineMat)
    scene.add(line)
    linkLines.push(line)
  }

  // Accumulator Register Box at Bottom (Y = -1.4)
  // Uses dedicated 512x170 wide texture for crisp text without horizontal compression
  const accBoxGeom = new THREE.BoxGeometry(2.4, 0.8, 0.8)
  const accEdges = new THREE.EdgesGeometry(accBoxGeom)
  const accTex = createWideTextTexture('∑ = 0', 512, 170)
  const accMat = new THREE.MeshBasicMaterial({
    map: accTex,
    transparent: false
  })
  accumulatorMesh = new THREE.Mesh(accBoxGeom, accMat)
  accumulatorMesh.position.set(0, -1.4, 0)
  accumulatorMesh.userData = { type: 'acc', index: -1 }

  const accWireMat = new THREE.LineBasicMaterial({
    color: 0x16a34a,
    transparent: true,
    opacity: 0.6
  })
  accumulatorMesh.add(new THREE.LineSegments(accEdges, accWireMat))
  scene.add(accumulatorMesh)
  interactiveMeshes.push({ mesh: accumulatorMesh, index: -1, type: 'acc' })

  updateVisualStep()

  // Render Loop
  const animate = () => {
    animFrameId = requestAnimationFrame(animate)

    if (accumulatorMesh && currentStep.value > 0) {
      const pulseScale = 1 + Math.sin(Date.now() * 0.005) * 0.015
      accumulatorMesh.scale.set(pulseScale, pulseScale, pulseScale)
    }

    controls?.update()
    renderer?.render(scene!, camera!)
  }

  animate()
}

const updateVisualStep = () => {
  const step = currentStep.value

  for (let i = 0; i < xVec.length; i++) {
    const isCurrent = i === step - 1
    const isProcessed = i < step
    const lineMat = linkLines[i].material as THREE.LineBasicMaterial

    if (isCurrent) {
      lineMat.color.setHex(0x16a34a)
      lineMat.opacity = 1.0
      xNodeMeshes[i].scale.set(1.12, 1.12, 1.12)
      wNodeMeshes[i].scale.set(1.12, 1.12, 1.12)
    } else if (isProcessed) {
      lineMat.color.setHex(0x2f9e44)
      lineMat.opacity = 0.5
      xNodeMeshes[i].scale.set(1.0, 1.0, 1.0)
      wNodeMeshes[i].scale.set(1.0, 1.0, 1.0)
    } else {
      lineMat.color.setHex(0x9aa5b5)
      lineMat.opacity = 0.25
      xNodeMeshes[i].scale.set(1.0, 1.0, 1.0)
      wNodeMeshes[i].scale.set(1.0, 1.0, 1.0)
    }
  }

  // Update Accumulator Box Texture with live sum
  if (accumulatorMesh) {
    const accTex = createWideTextTexture(`∑ = ${runningSum.value}`, 512, 170)
    ;(accumulatorMesh.material as THREE.MeshBasicMaterial).map = accTex
  }

  emitInspection()
}

const emitInspection = () => {
  const step = currentStep.value
  const activePairIdx = selectedPair.value ?? Math.max(0, step - 1)
  const isDone = step === xVec.length

  emit('inspect', {
    title: `Dot Product Accumulator: ${runningSum.value} / ${totalDotProduct}`,
    details: {
      'Current Step': `${step} of ${xVec.length} pairs processed`,
      'Active Pair': `x[${activePairIdx}] = ${xVec[activePairIdx]}, w[${activePairIdx}] = ${wVec[activePairIdx]}`,
      'Product Term': `${xVec[activePairIdx]} × ${wVec[activePairIdx]} = ${pairProducts[activePairIdx]}`,
      'Accumulator Value': `∑ = ${runningSum.value}`,
      'Final Invariant': `x · w = 19 (Status: ${isDone ? 'Completed' : 'Running'})`,
      'Geometric Meaning': 'Scalar Projection of x onto w'
    }
  })
}

// Raycaster Cell Selection
const onCanvasPointerDown = (event: MouseEvent) => {
  if (!canvasRef.value || !camera || !scene) return

  const rect = canvasRef.value.getBoundingClientRect()
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

  raycaster.setFromCamera(mouse, camera)
  const intersects = raycaster.intersectObjects(interactiveMeshes.map((m) => m.mesh))

  if (intersects.length > 0) {
    const hit = intersects[0].object as THREE.Mesh
    const data = hit.userData
    if (data && data.index >= 0) {
      selectedPair.value = data.index
      emitInspection()
    }
  }
}

// Controls
const stepForward = () => {
  if (currentStep.value >= xVec.length) {
    currentStep.value = 0
  } else {
    currentStep.value++
  }
  selectedPair.value = Math.max(0, currentStep.value - 1)
  updateVisualStep()
}

let playTimeout: ReturnType<typeof setTimeout> | null = null
const togglePlay = () => {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) {
    runAutoPlay()
  } else if (playTimeout) {
    clearTimeout(playTimeout)
  }
}

const runAutoPlay = () => {
  if (!isPlaying.value) return
  if (currentStep.value >= xVec.length) {
    currentStep.value = 0
  } else {
    currentStep.value++
  }
  selectedPair.value = Math.max(0, currentStep.value - 1)
  updateVisualStep()

  if (currentStep.value < xVec.length) {
    playTimeout = setTimeout(runAutoPlay, 1200)
  } else {
    isPlaying.value = false // Strict no auto-run
  }
}

const resetSimulation = () => {
  isPlaying.value = false
  if (playTimeout) clearTimeout(playTimeout)
  currentStep.value = 0
  selectedPair.value = 0
  updateVisualStep()
}

const resetCamera = () => {
  if (!camera || !controls) return
  camera.position.copy(initialCameraPos)
  controls.target.copy(initialCameraTarget)
  controls.update()
}

const handleResize = () => {
  if (!containerRef.value || !renderer || !camera) return
  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
}

onMounted(() => {
  initThree()
  window.addEventListener('resize', handleResize)
  canvasRef.value?.addEventListener('pointerdown', onCanvasPointerDown)
  emitInspection()
})

onBeforeUnmount(() => {
  if (playTimeout) clearTimeout(playTimeout)
  cancelAnimationFrame(animFrameId)
  window.removeEventListener('resize', handleResize)
  canvasRef.value?.removeEventListener('pointerdown', onCanvasPointerDown)

  for (const m of interactiveMeshes) {
    m.mesh.geometry.dispose()
    ;(m.mesh.material as THREE.Material).dispose()
  }
  for (const l of linkLines) {
    l.geometry.dispose()
    ;(l.material as THREE.Material).dispose()
  }
  controls?.dispose()
  renderer?.dispose()
})

watch(isDark, (dark) => {
  if (scene) {
    scene.background = new THREE.Color(dark ? 0x151a22 : 0xfbfaf7)
  }
})
</script>

<template>
  <div class="flex flex-col gap-2.5 w-full select-none">
    <!-- 3D Canvas Stage Card: Strictly clamped height -->
    <div class="relative bg-card border border-line rounded-lg p-1.5 flex flex-col shadow-xs">
      <div
        ref="containerRef"
        class="w-full h-[300px] sm:h-[330px] lg:h-[360px] max-h-[46vh] rounded-md bg-stage border border-line overflow-hidden relative cursor-grab active:cursor-grabbing"
      >
        <canvas ref="canvasRef" class="w-full h-full block outline-none" />

        <!-- Floating Vector Indicators -->
        <div class="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 bg-card/90 backdrop-blur-md p-1.5 rounded-md border border-line shadow-xs text-xs font-mono">
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded bg-brand-blue" />
            <span class="text-ink font-semibold">x = [2, 3, 1, 4]</span>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded bg-brand-amber" />
            <span class="text-ink font-semibold">w = [3, 1, 2, 2]</span>
          </div>
        </div>

        <!-- 360 Orbit Hint -->
        <div class="absolute top-2.5 right-2.5 text-[0.68rem] text-muted bg-card/90 border border-line px-2 py-0.5 rounded select-none pointer-events-none hidden sm:block">
          Drag: Orbit 360° • Click: Inspect
        </div>
      </div>
    </div>

    <!-- Compact Execution Control Toolbar: Positioned IMMEDIATELY below stage -->
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
          <span>{{ isPlaying ? 'Pause' : 'Play Accumulation' }}</span>
        </button>

        <button
          type="button"
          @click="stepForward"
          class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono font-medium text-ink transition-colors"
          title="Step forward one element product"
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

      <!-- Step Progress Slider -->
      <div class="flex items-center gap-2 text-xs font-mono text-muted">
        <label for="dotStepSlider">Step</label>
        <input
          id="dotStepSlider"
          type="range"
          min="0"
          max="4"
          step="1"
          :value="currentStep"
          @input="currentStep = Number(($event.target as HTMLInputElement).value); updateVisualStep()"
          class="w-20 accent-brand-blue cursor-pointer"
        />
        <span class="font-bold text-brand-blue">{{ currentStep }}/4</span>
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

    <!-- Fluid Telemetry HUD Grid with Formula Invariant -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Shape</div>
        <div class="font-bold text-brand-blue truncate" title="(N,) · (N,) → ()">(N,) · (N,) → ()</div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Formula Invariant</div>
        <div class="font-bold text-ink truncate text-[11px]" :title="formulaInvariant">{{ formulaInvariant }}</div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Accumulator</div>
        <div class="font-bold text-brand-green truncate">∑ = {{ runningSum }}</div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Active Product</div>
        <div class="font-bold text-ink truncate">
          {{ currentStep > 0 ? `${xVec[currentStep - 1]} × ${wVec[currentStep - 1]} = ${pairProducts[currentStep - 1]}` : 'Idle (x · w)' }}
        </div>
      </div>
    </div>
  </div>
</template>
