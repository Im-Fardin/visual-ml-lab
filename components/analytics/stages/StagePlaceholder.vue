<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RotateCcw, Play, Pause, Clock } from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', data: { title: string; details: Record<string, any> }): void
}>()

const containerRef = ref<HTMLDivElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const isSpinning = ref(true)

let scene: THREE.Scene | null = null
let camera: THREE.PerspectiveCamera | null = null
let renderer: THREE.WebGLRenderer | null = null
let controls: OrbitControls | null = null
let animFrameId = 0
let meshGroup: THREE.Group | null = null

const { isDark } = useTheme()

const initThree = () => {
  if (!containerRef.value || !canvasRef.value) return

  const width = containerRef.value.clientWidth
  const height = containerRef.value.clientHeight

  scene = new THREE.Scene()
  const bgCol = isDark.value ? 0x151a22 : 0xfbfaf7
  scene.background = new THREE.Color(bgCol)

  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100)
  camera.position.set(0, 3, 6)

  renderer = new THREE.WebGLRenderer({
    canvas: canvasRef.value,
    antialias: true,
    alpha: true
  })
  renderer.setSize(width, height)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

  controls = new OrbitControls(camera, canvasRef.value)
  controls.enableDamping = true
  controls.dampingFactor = 0.08

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, isDark.value ? 1.4 : 1.2)
  scene.add(ambientLight)

  const dirLight = new THREE.DirectionalLight(0x6ea0ff, 1.2)
  dirLight.position.set(5, 10, 7)
  scene.add(dirLight)

  // Ground Grid
  const grid = new THREE.GridHelper(12, 12, isDark.value ? 0x2b3340 : 0xd1d5db, isDark.value ? 0x1f242e : 0xe5e7eb)
  grid.position.y = -2.0
  scene.add(grid)

  // Geometric Mathematical Crystal Wireframe
  meshGroup = new THREE.Group()

  const geom1 = new THREE.IcosahedronGeometry(1.5, 1)
  const mat1 = new THREE.MeshStandardMaterial({
    color: isDark.value ? 0x6ea0ff : 0x1f5fd6,
    wireframe: true,
    transparent: true,
    opacity: 0.5
  })
  const mesh1 = new THREE.Mesh(geom1, mat1)
  meshGroup.add(mesh1)

  const geom2 = new THREE.BoxGeometry(1.2, 1.2, 1.2)
  const mat2 = new THREE.MeshStandardMaterial({
    color: isDark.value ? 0xf5a524 : 0xd97706,
    wireframe: true,
    transparent: true,
    opacity: 0.7
  })
  const mesh2 = new THREE.Mesh(geom2, mat2)
  meshGroup.add(mesh2)

  const geom3 = new THREE.OctahedronGeometry(0.7)
  const mat3 = new THREE.MeshStandardMaterial({
    color: isDark.value ? 0xa78bfa : 0x7c3aed,
    roughness: 0.3,
    metalness: 0.4
  })
  const mesh3 = new THREE.Mesh(geom3, mat3)
  meshGroup.add(mesh3)

  scene.add(meshGroup)

  const animate = () => {
    animFrameId = requestAnimationFrame(animate)

    if (isSpinning.value && meshGroup) {
      meshGroup.rotation.y += 0.008
      meshGroup.rotation.x += 0.004
    }

    controls?.update()
    renderer?.render(scene!, camera!)
  }

  animate()
  emitInspection()
}

const emitInspection = () => {
  emit('inspect', {
    title: `${props.topic.title} • Module Invariant`,
    details: {
      'Module ID': `#${props.topic.id} (${props.topic.moduleTitle})`,
      'Category': props.topic.partTitle,
      'Mathematical Invariant': props.topic.invariant,
      'Dimensional Shape': props.topic.shapeFormula,
      '3D Visual Engine': 'Under Active Architectural Construction',
      'Python Engine': 'Executable & Ready in Right Pane'
    }
  })
}

const toggleSpin = () => {
  isSpinning.value = !isSpinning.value
}

const resetCamera = () => {
  if (!camera || !controls) return
  camera.position.set(0, 3, 6)
  controls.target.set(0, 0, 0)
  controls.update()
}

const handleResize = () => {
  if (!containerRef.value || !renderer || !camera) return
  const w = containerRef.value.clientWidth
  const h = containerRef.value.clientHeight
  camera.aspect = w / h
  camera.updateProjectionMatrix()
  renderer.setSize(w, h)
}

onMounted(() => {
  initThree()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(animFrameId)
  window.removeEventListener('resize', handleResize)

  if (meshGroup) {
    meshGroup.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose()
        ;(child.material as THREE.Material).dispose()
      }
    })
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

        <!-- Development Overlay -->
        <div class="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
          <div class="pointer-events-auto max-w-sm rounded-lg border border-line bg-card/90 backdrop-blur-md p-4 shadow-md text-center space-y-2">
            <div class="w-8 h-8 rounded-lg bg-brand-amber-soft border border-brand-amber/20 text-brand-amber mx-auto flex items-center justify-center">
              <Clock class="w-4 h-4" />
            </div>

            <h3 class="text-xs sm:text-sm font-bold text-ink">
              3D Stage in Development
            </h3>

            <p class="text-[11px] text-muted leading-relaxed">
              Custom interactive 3D simulation for <strong class="text-ink">{{ topic.title }}</strong> is scheduled for the next release.
            </p>

            <div class="p-2 rounded bg-card-subtle border border-line text-left text-[10px] font-mono space-y-0.5">
              <div class="flex justify-between">
                <span class="text-muted">Invariant:</span>
                <span class="text-ink font-bold truncate max-w-[150px]">{{ topic.invariant }}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-muted">Shape:</span>
                <span class="text-brand-blue truncate max-w-[150px]">{{ topic.shapeFormula }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="absolute top-2.5 right-2.5 text-[0.68rem] text-muted bg-card/90 border border-line px-2 py-0.5 rounded select-none pointer-events-none hidden sm:block">
          Drag: Orbit 360°
        </div>
      </div>
    </div>

    <!-- Compact Execution Toolbar -->
    <div class="bg-card border border-line rounded-lg p-2.5 flex items-center justify-between gap-2.5 shadow-xs">
      <button
        type="button"
        @click="toggleSpin"
        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-colors shadow-xs"
        :class="isSpinning ? 'bg-card border border-line text-ink' : 'bg-brand-blue text-white'"
      >
        <Pause v-if="isSpinning" class="w-3.5 h-3.5" />
        <Play v-else class="w-3.5 h-3.5 fill-current" />
        <span>{{ isSpinning ? 'Pause Rotation' : 'Spin 3D Wireframe' }}</span>
      </button>

      <button
        type="button"
        @click="resetCamera"
        class="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-xs font-mono text-muted hover:text-ink transition-colors"
      >
        <RotateCcw class="w-3.5 h-3.5" />
        <span>Reset Camera</span>
      </button>
    </div>

    <!-- Fluid Telemetry HUD Grid with Formula Invariant -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Shape</div>
        <div class="font-bold text-brand-blue truncate" :title="topic.shapeFormula">{{ topic.shapeFormula }}</div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Formula Invariant</div>
        <div class="font-bold text-ink truncate text-[11px]" :title="topic.invariant">{{ topic.invariant }}</div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Status</div>
        <div class="font-bold text-brand-amber truncate">Curriculum Preview</div>
      </div>
      <div class="bg-card border border-line rounded-md p-2 flex flex-col justify-between">
        <div class="text-[0.68rem] uppercase text-muted font-semibold">Python Code</div>
        <div class="font-bold text-brand-green truncate">100% Executable</div>
      </div>
    </div>
  </div>
</template>
