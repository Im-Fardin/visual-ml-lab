<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  Activity,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  TrendingUp,
  Zap,
  Layers,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Sliders,
  Target
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'
import {
  REGRESSION_PRESETS,
  evaluateRegression,
  type RegressionPreset,
  type DataPoint
} from '~/utils/syntheticData'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Dataset Selection ------------------------------------------------------
type DatasetKey = 'clean' | 'noisy'
const activeDatasetKey = ref<DatasetKey>('clean')

const activePreset = computed<RegressionPreset>(() => {
  if (activeDatasetKey.value === 'clean') {
    return REGRESSION_PRESETS[0] // Study Hours
  }
  return REGRESSION_PRESETS[1] // House Prices (or noisy)
})

// --- Training Parameters & State --------------------------------------------
const epoch = ref<number>(0)
const isTraining = ref<boolean>(false)
let trainingTimer: any = null

// Learning Rate (alpha): 0.001 to 0.15, default 0.025
const learningRate = ref<number>(0.025)

// Current model parameters (w, b)
const currentW = ref<number>(0.5)
const currentB = ref<number>(10.0)

// Internal normalized parameters for stable, scaled gradient descent
// y_norm = w_norm * x_norm + b_norm
const wNorm = ref<number>(0.05)
const bNorm = ref<number>(0.1)

// Gradient cache
const gradW = ref<number>(0)
const gradB = ref<number>(0)

// Status: 'idle' | 'forward' | 'backward' | 'converged' | 'diverged'
const engineStatus = ref<'idle' | 'forward' | 'backward' | 'converged' | 'diverged'>('idle')

// Epoch history for convergence plot
interface EpochRecord {
  epoch: number
  loss: number
  accuracy: number
  w: number
  b: number
}
const history = ref<EpochRecord[]>([])

// Normalization factors for the active dataset
const normStats = computed(() => {
  const pts = activePreset.value.points
  const n = pts.length
  let sumX = 0
  let sumY = 0
  for (const p of pts) {
    sumX += p.x
    sumY += p.y
  }
  const meanX = sumX / n
  const meanY = sumY / n

  let varX = 0
  let varY = 0
  for (const p of pts) {
    varX += (p.x - meanX) * (p.x - meanX)
    varY += (p.y - meanY) * (p.y - meanY)
  }
  const stdX = Math.sqrt(varX / n) || 1
  const stdY = Math.sqrt(varY / n) || 1

  return { meanX, meanY, stdX, stdY }
})

// Synchronize unnormalized (currentW, currentB) from normalized parameters
function syncRealParameters() {
  const { meanX, meanY, stdX, stdY } = normStats.value
  // y = stdY * (wNorm * ((x - meanX)/stdX) + bNorm) + meanY
  // y = (wNorm * stdY / stdX) * x + (stdY * bNorm + meanY - (wNorm * stdY / stdX) * meanX)
  const realW = (wNorm.value * stdY) / stdX
  const realB = stdY * bNorm.value + meanY - realW * meanX

  currentW.value = Number(realW.toFixed(3))
  currentB.value = Number(realB.toFixed(2))
}

// Compute metrics for current model
const currentMetrics = computed(() => {
  const pts = activePreset.value.points
  const n = pts.length
  const { meanY } = normStats.value

  let ssRes = 0
  let ssTot = 0
  for (const p of pts) {
    const yHat = currentW.value * p.x + currentB.value
    const err = p.y - yHat
    ssRes += err * err
    ssTot += (p.y - meanY) * (p.y - meanY)
  }

  const mse = ssRes / n
  const r2 = ssTot !== 0 ? Math.max(0, 1 - ssRes / ssTot) : 0
  const accuracyPct = Math.min(100, Math.max(0, r2 * 100))

  return {
    mse,
    r2,
    accuracyPct
  }
})

// Initialize or reset model
function resetModel() {
  stopTraining()
  epoch.value = 0
  engineStatus.value = 'idle'

  // Deliberately poor initial parameters: almost flat slope, low bias
  wNorm.value = 0.05
  bNorm.value = -0.5
  syncRealParameters()

  const m = currentMetrics.value
  history.value = [
    {
      epoch: 0,
      loss: m.mse,
      accuracy: m.accuracyPct,
      w: currentW.value,
      b: currentB.value
    }
  ]
  emitInspection()
}

// Single Epoch Step (Forward Pass -> Loss -> Backward Pass -> Parameter Update)
function performStep() {
  if (engineStatus.value === 'diverged') return

  const pts = activePreset.value.points
  const n = pts.length
  const { meanX, meanY, stdX, stdY } = normStats.value

  // 1. Forward Pass in normalized space
  engineStatus.value = 'forward'

  let dL_dwNorm = 0
  let dL_dbNorm = 0
  let totalNormSqErr = 0

  for (const p of pts) {
    const xNorm = (p.x - meanX) / stdX
    const yNorm = (p.y - meanY) / stdY
    const yHatNorm = wNorm.value * xNorm + bNorm.value
    const diff = yHatNorm - yNorm // (yHat - y)

    dL_dwNorm += 2 * diff * xNorm
    dL_dbNorm += 2 * diff
    totalNormSqErr += diff * diff
  }

  dL_dwNorm /= n
  dL_dbNorm /= n

  // 2. Backward Pass (Chain Rule gradients)
  engineStatus.value = 'backward'
  gradW.value = Number(dL_dwNorm.toFixed(4))
  gradB.value = Number(dL_dbNorm.toFixed(4))

  // Check for divergence (gradient explosion with huge learning rates)
  const isExploding =
    learningRate.value >= 0.10 &&
    (Math.abs(dL_dwNorm) > 15 || Math.abs(wNorm.value) > 8 || totalNormSqErr > 50)

  if (isExploding) {
    engineStatus.value = 'diverged'
    stopTraining()
    // Simulate divergence spike
    wNorm.value *= 1.8
    bNorm.value *= 1.8
    syncRealParameters()

    const divergedLoss = Math.min(9999, currentMetrics.value.mse * 4)
    epoch.value++
    history.value.push({
      epoch: epoch.value,
      loss: divergedLoss,
      accuracy: 0,
      w: currentW.value,
      b: currentB.value
    })
    emitInspection()
    return
  }

  // 3. Weight Updates via Gradient Descent
  wNorm.value -= learningRate.value * dL_dwNorm
  bNorm.value -= learningRate.value * dL_dbNorm

  syncRealParameters()
  epoch.value++

  const m = currentMetrics.value
  history.value.push({
    epoch: epoch.value,
    loss: m.mse,
    accuracy: m.accuracyPct,
    w: currentW.value,
    b: currentB.value
  })

  // Check for convergence (near analytical OLS optimum)
  const diffFromOpt = Math.abs(currentW.value - activePreset.value.optimalW)
  if (diffFromOpt < 0.05 && epoch.value > 10 && !isExploding) {
    engineStatus.value = 'converged'
  } else {
    engineStatus.value = 'idle'
  }

  emitInspection()
}

// Continuous Playback Loop
function toggleTraining() {
  if (isTraining.value) {
    stopTraining()
  } else {
    startTraining()
  }
}

function startTraining() {
  if (engineStatus.value === 'diverged') {
    resetModel()
  }
  isTraining.value = true
  trainingTimer = setInterval(() => {
    if (epoch.value >= 70 || engineStatus.value === 'converged') {
      stopTraining()
    } else {
      performStep()
    }
  }, 75)
}

function stopTraining() {
  isTraining.value = false
  if (trainingTimer) {
    clearInterval(trainingTimer)
    trainingTimer = null
  }
}

// Preset Learning Rate Snaps
function setLrPreset(rate: number) {
  learningRate.value = rate
  emitInspection()
}

// --- Watchers & Lifecycle ---------------------------------------------------
watch(activeDatasetKey, () => {
  resetModel()
})

onMounted(() => {
  resetModel()
})

onUnmounted(() => {
  stopTraining()
})

// --- SVG Layout & Dual-Zone Coordinates (800 x 500) -------------------------
const SVG_WIDTH = 800
const SVG_HEIGHT = 500

// Zone 1: Computational Graph (Top, Y: 18 to 155)
const graphNodes = computed(() => {
  const samplePt = activePreset.value.points[3] || activePreset.value.points[0]
  const sampleYHat = currentW.value * samplePt.x + currentB.value
  const sampleLoss = Math.pow(samplePt.y - sampleYHat, 2)

  return [
    { id: 'input', label: 'Input x', value: samplePt.x.toFixed(1), x: 70, y: 75, color: '#3b82f6' },
    { id: 'mult', label: '× w', value: `w=${currentW.value.toFixed(2)}`, x: 220, y: 75, color: '#6366f1' },
    { id: 'add', label: '+ b', value: `b=${currentB.value.toFixed(1)}`, x: 370, y: 75, color: '#8b5cf6' },
    { id: 'pred', label: 'Prediction ŷ', value: sampleYHat.toFixed(1), x: 520, y: 75, color: '#10b981' },
    { id: 'loss', label: 'Loss (y - ŷ)²', value: sampleLoss.toFixed(1), x: 690, y: 75, color: '#f43f5e' }
  ]
})

// Zone 2: Bottom-Left Model Scatter (X: 45 to 390, Y: 195 to 445)
const scatterBox = {
  left: 45,
  right: 390,
  top: 195,
  bottom: 445
}
const scatterW = scatterBox.right - scatterBox.left // 345
const scatterH = scatterBox.bottom - scatterBox.top // 250

const scaleScatterX = (x: number): number => {
  const [xMin, xMax] = activePreset.value.xDomain
  return scatterBox.left + ((x - xMin) / (xMax - xMin)) * scatterW
}

const scaleScatterY = (y: number): number => {
  const [yMin, yMax] = activePreset.value.yDomain
  return scatterBox.bottom - ((y - yMin) / (yMax - yMin)) * scatterH
}

// Regression Lines coordinates in Scatter box
const modelLineCoords = computed(() => {
  const [xMin, xMax] = activePreset.value.xDomain
  const y1 = currentW.value * xMin + currentB.value
  const y2 = currentW.value * xMax + currentB.value
  return {
    x1: scaleScatterX(xMin),
    y1: scaleScatterY(y1),
    x2: scaleScatterX(xMax),
    y2: scaleScatterY(y2)
  }
})

const optimalLineCoords = computed(() => {
  const [xMin, xMax] = activePreset.value.xDomain
  const p = activePreset.value
  const y1 = p.optimalW * xMin + p.optimalB
  const y2 = p.optimalW * xMax + p.optimalB
  return {
    x1: scaleScatterX(xMin),
    y1: scaleScatterY(y1),
    x2: scaleScatterX(xMax),
    y2: scaleScatterY(y2)
  }
})

// Zone 3: Bottom-Right Dual Convergence Plot (X: 445 to 755, Y: 195 to 445)
const convBox = {
  left: 445,
  right: 755,
  top: 195,
  bottom: 445
}
const convW = convBox.right - convBox.left // 310
const convH = convBox.bottom - convBox.top // 250

// Max epoch shown on X axis
const maxDisplayEpoch = computed(() => {
  return Math.max(35, Math.ceil((epoch.value + 5) / 10) * 10)
})

// Max loss shown on Left Y axis
const maxDisplayLoss = computed(() => {
  const initialLoss = history.value[0]?.loss || 100
  const maxRecorded = Math.max(...history.value.map((h) => h.loss), 10)
  return Math.min(9999, Math.max(initialLoss * 1.1, maxRecorded * 1.05))
})

const scaleEpochX = (ep: number): number => {
  return convBox.left + (ep / maxDisplayEpoch.value) * convW
}

// Left scale: Loss (MSE) -> 0 at bottom, maxDisplayLoss at top
const scaleLossY = (loss: number): number => {
  const clamped = Math.max(0, Math.min(loss, maxDisplayLoss.value))
  return convBox.bottom - (clamped / maxDisplayLoss.value) * convH
}

// Right scale: Accuracy % -> 0% at bottom, 100% at top
const scaleAccY = (acc: number): number => {
  const clamped = Math.max(0, Math.min(acc, 100))
  return convBox.bottom - (clamped / 100) * convH
}

// SVG Path for Loss curve
const lossPath = computed(() => {
  if (history.value.length === 0) return ''
  return history.value
    .map((h, i) => `${i === 0 ? 'M' : 'L'} ${scaleEpochX(h.epoch).toFixed(1)} ${scaleLossY(h.loss).toFixed(1)}`)
    .join(' ')
})

// SVG Path for Accuracy curve
const accPath = computed(() => {
  if (history.value.length === 0) return ''
  return history.value
    .map((h, i) => `${i === 0 ? 'M' : 'L'} ${scaleEpochX(h.epoch).toFixed(1)} ${scaleAccY(h.accuracy).toFixed(1)}`)
    .join(' ')
})

// Latest Epoch Pointer positions
const latestLossPoint = computed(() => {
  const last = history.value[history.value.length - 1]
  if (!last) return { x: convBox.left, y: convBox.bottom }
  return {
    x: scaleEpochX(last.epoch),
    y: scaleLossY(last.loss),
    loss: last.loss
  }
})

const latestAccPoint = computed(() => {
  const last = history.value[history.value.length - 1]
  if (!last) return { x: convBox.left, y: convBox.bottom }
  return {
    x: scaleEpochX(last.epoch),
    y: scaleAccY(last.accuracy),
    acc: last.accuracy
  }
})

// Telemetry Inspection emit
const emitInspection = () => {
  const m = currentMetrics.value
  emit('inspect', {
    title: 'Interactive Gradient Descent Training Engine',
    details: {
      'Current Epoch': epoch.value,
      'Engine Status': engineStatus.value.toUpperCase(),
      'Learning Rate (α)': learningRate.value.toFixed(4),
      'Active Model': `ŷ = ${currentW.value.toFixed(3)}·x + ${currentB.value >= 0 ? '+' : ''}${currentB.value.toFixed(2)}`,
      'Target Optimal OLS': `ŷ* = ${activePreset.value.optimalW.toFixed(3)}·x + ${activePreset.value.optimalB.toFixed(2)}`,
      'Current Loss (MSE)': `${m.mse.toFixed(2)} (Optimal: ${activePreset.value.optimalMse.toFixed(2)})`,
      'Current Accuracy (R²)': `${m.accuracyPct.toFixed(1)}% (Optimal: ${(activePreset.value.optimalR2 * 100).toFixed(1)}%)`,
      'Weight Gradient ∇w': gradW.value.toFixed(4),
      'Bias Gradient ∇b': gradB.value.toFixed(4),
      'Convergence Dynamic':
        engineStatus.value === 'diverged'
          ? 'EXPLODING: Learning rate α too large, overshoot gradient step'
          : engineStatus.value === 'converged'
          ? 'CONVERGED: Minimal residual gradient reached'
          : 'DESCENT: Monotonic loss reduction'
    }
  })
}
</script>

<template>
  <div class="w-full flex flex-col gap-2 p-2 sm:p-3 pb-12 max-h-[calc(100vh-185px)] overflow-y-auto pr-1">
    <!-- Top Controls Header -->
    <header class="flex-none mb-1 space-y-1.5">
      <!-- Row 1: Playback Buttons & Dataset Switcher -->
      <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
        <!-- Playback Actions -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            @click="toggleTraining"
            class="px-3 py-1.5 rounded-md text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs text-white"
            :class="isTraining ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'"
          >
            <component :is="isTraining ? Pause : Play" class="w-3.5 h-3.5" />
            {{ isTraining ? 'Pause Engine' : 'Train Engine' }}
          </button>

          <button
            type="button"
            @click="performStep"
            :disabled="isTraining || engineStatus === 'diverged'"
            class="px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-ink font-medium text-[11px] transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
            title="Execute exactly 1 training epoch (Forward -> Loss -> Backward -> Update)"
          >
            <SkipForward class="w-3.5 h-3.5 text-brand-blue" />
            Step 1 Epoch
          </button>

          <button
            type="button"
            @click="resetModel"
            class="px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-muted hover:text-ink text-[11px] transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
            title="Reset model weights and clear training history"
          >
            <RotateCcw class="w-3 h-3" />
            Reset
          </button>
        </div>

        <!-- Learning Rate Presets & Dataset Toggle -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Learning Rate Presets -->
          <div class="flex items-center gap-1 bg-card px-1.5 py-1 rounded-md border border-line shadow-2xs">
            <span class="text-[10px] text-muted mr-1">LR Preset:</span>
            <button
              type="button"
              @click="setLrPreset(0.002)"
              class="px-1.5 py-0.5 rounded text-[10px] transition-colors"
              :class="learningRate === 0.002 ? 'bg-slate-700 text-white font-bold' : 'text-muted hover:text-ink'"
            >
              Too Small (0.002)
            </button>
            <button
              type="button"
              @click="setLrPreset(0.025)"
              class="px-1.5 py-0.5 rounded text-[10px] transition-colors"
              :class="learningRate === 0.025 ? 'bg-brand-blue text-white font-bold' : 'text-muted hover:text-ink'"
            >
              Optimal (0.025)
            </button>
            <button
              type="button"
              @click="setLrPreset(0.12)"
              class="px-1.5 py-0.5 rounded text-[10px] transition-colors"
              :class="learningRate === 0.12 ? 'bg-rose-600 text-white font-bold' : 'text-muted hover:text-ink'"
            >
              Too Large / Diverge (0.12)
            </button>
          </div>

          <!-- Dataset Toggle -->
          <div class="flex items-center gap-1 bg-card px-1.5 py-1 rounded-md border border-line shadow-2xs">
            <button
              type="button"
              @click="activeDatasetKey = 'clean'"
              class="px-2 py-0.5 rounded text-[10.5px] transition-colors"
              :class="activeDatasetKey === 'clean' ? 'bg-brand-blue text-white font-bold' : 'text-muted hover:text-ink'"
            >
              Clean Linear
            </button>
            <button
              type="button"
              @click="activeDatasetKey = 'noisy'"
              class="px-2 py-0.5 rounded text-[10.5px] transition-colors"
              :class="activeDatasetKey === 'noisy' ? 'bg-brand-purple text-white font-bold' : 'text-muted hover:text-ink'"
            >
              Real-World
            </button>
          </div>
        </div>
      </div>

      <!-- Row 2: Learning Rate Slider & Live Engine Telemetry Ribbon -->
      <div class="p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-2 font-mono text-xs">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <Sliders class="w-3.5 h-3.5 text-brand-blue" />
            <span class="font-bold text-ink">Learning Rate (α / Step Size):</span>
            <span class="font-bold px-1.5 py-0.5 rounded bg-brand-blue/10 text-brand-blue">
              α = {{ learningRate.toFixed(3) }}
            </span>
          </div>

          <!-- Telemetry Badges -->
          <div class="flex items-center gap-3 text-[11px] flex-wrap">
            <span class="text-muted">Epoch: <strong class="text-ink">#{{ epoch }}</strong></span>
            <span class="text-muted">
              Loss: <strong class="text-rose-600 dark:text-rose-400 font-bold">{{ currentMetrics.mse.toFixed(1) }}</strong>
            </span>
            <span class="text-muted">
              Accuracy: <strong class="text-emerald-600 dark:text-emerald-400 font-bold">{{ currentMetrics.accuracyPct.toFixed(1) }}%</strong>
            </span>
            <span
              class="px-2 py-0.5 rounded-full text-[10.5px] font-bold flex items-center gap-1"
              :class="
                engineStatus === 'diverged'
                  ? 'bg-rose-500 text-white'
                  : engineStatus === 'converged'
                  ? 'bg-emerald-500 text-white'
                  : isTraining
                  ? 'bg-brand-blue text-white animate-pulse'
                  : 'bg-card border border-line text-muted'
              "
            >
              <AlertTriangle v-if="engineStatus === 'diverged'" class="w-3 h-3" />
              <CheckCircle2 v-else-if="engineStatus === 'converged'" class="w-3 h-3" />
              <Sparkles v-else-if="isTraining" class="w-3 h-3" />
              {{
                engineStatus === 'diverged'
                  ? 'Diverging / Exploding!'
                  : engineStatus === 'converged'
                  ? 'Converged to Optimum!'
                  : isTraining
                  ? 'Training Active...'
                  : 'Engine Idle'
              }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-[10px] text-muted font-bold">0.001 (Slow)</span>
          <input
            v-model.number="learningRate"
            type="range"
            min="0.001"
            max="0.15"
            step="0.001"
            @input="emitInspection"
            class="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-blue"
          />
          <span class="text-[10px] text-rose-500 font-bold">0.150 (Divergent)</span>
        </div>
      </div>
    </header>

    <!-- Main Dual-Zone SVG Visualization Stage -->
    <main class="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-2 sm:p-3">
      <!-- Title Ribbon -->
      <div class="w-full flex items-center justify-between text-xs font-mono mb-1 flex-none px-1">
        <span class="font-bold text-ink flex items-center gap-1.5">
          <Activity class="w-3.5 h-3.5 text-brand-blue" />
          Interactive Forward/Backward Graph &amp; Dual Convergence Plane
        </span>
        <div class="flex items-center gap-3 text-[10.5px]">
          <span class="flex items-center gap-1 text-rose-600 dark:text-rose-400">
            <span class="w-2.5 h-0.5 bg-rose-500 inline-block"></span>
            Loss (MSE ↓)
          </span>
          <span class="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <span class="w-2.5 h-0.5 bg-emerald-500 inline-block"></span>
            Accuracy (R² % ↑)
          </span>
          <span class="flex items-center gap-1 text-brand-blue">
            <span class="w-2.5 h-0.5 bg-brand-blue inline-block"></span>
            Model ŷ = wx + b
          </span>
        </div>
      </div>

      <!-- Chart Container: Responsive aspect-ratio standard -->
      <div class="w-full flex-1 flex items-center justify-center py-2 px-2 sm:px-4">
        <div class="w-full max-w-4xl aspect-[16/10] relative flex items-center justify-center">
          <svg
            viewBox="0 0 800 500"
            preserveAspectRatio="xMidYMid meet"
            class="w-full h-full block select-none"
          >
            <!-- Background Frame -->
            <rect
              x="20"
              y="15"
              width="760"
              height="465"
              rx="8"
              fill="rgba(240, 244, 248, 0.12)"
              stroke="none"
            />

            <!-- ======================================================== -->
            <!-- ZONE 1: COMPUTATIONAL GRAPH (TOP, Y: 15 to 165)           -->
            <!-- ======================================================== -->
            <g>
              <!-- Zone Header -->
              <text
                x="35"
                y="34"
                font-family="monospace"
                font-size="10"
                font-weight="bold"
                fill="currentColor"
                class="text-muted"
              >
                1. Computational Graph Architecture (Forward Pass → &amp; Backward Pass ←)
              </text>

              <!-- Forward Flow Connectors (Left to Right) -->
              <g stroke-linecap="round">
                <!-- Node 1 -> Node 2 -->
                <line x1="120" y1="75" x2="170" y2="75" stroke="#3b82f6" stroke-width="2" />
                <polygon points="170,72 178,75 170,78" fill="#3b82f6" />

                <!-- Node 2 -> Node 3 -->
                <line x1="270" y1="75" x2="320" y2="75" stroke="#6366f1" stroke-width="2" />
                <polygon points="320,72 328,75 320,78" fill="#6366f1" />

                <!-- Node 3 -> Node 4 -->
                <line x1="420" y1="75" x2="470" y2="75" stroke="#8b5cf6" stroke-width="2" />
                <polygon points="470,72 478,75 470,78" fill="#8b5cf6" />

                <!-- Node 4 -> Node 5 -->
                <line x1="570" y1="75" x2="640" y2="75" stroke="#10b981" stroke-width="2" />
                <polygon points="640,72 648,75 640,78" fill="#10b981" />
              </g>

              <!-- Backward Chain-Rule Gradient Arrows (Right to Left, Curved Below) -->
              <g fill="none" stroke-linecap="round">
                <!-- Loss -> Pred (dL/dyHat = -2(y - yHat)) -->
                <path
                  d="M 640 98 Q 605 125 570 98"
                  stroke="#f43f5e"
                  stroke-width="1.8"
                  stroke-dasharray="3 2"
                />
                <polygon points="575,98 565,96 572,104" fill="#f43f5e" />

                <!-- Pred -> Bias (dL/db = dL/dyHat * 1) -->
                <path
                  d="M 470 98 Q 445 125 420 98"
                  stroke="#ec4899"
                  stroke-width="1.8"
                  stroke-dasharray="3 2"
                />
                <polygon points="425,98 415,96 422,104" fill="#ec4899" />

                <!-- Pred -> Weight (dL/dw = dL/dyHat * x) -->
                <path
                  d="M 320 98 Q 295 125 270 98"
                  stroke="#f59e0b"
                  stroke-width="1.8"
                  stroke-dasharray="3 2"
                />
                <polygon points="275,98 265,96 272,104" fill="#f59e0b" />
              </g>

              <!-- Backward Gradient Text Labels -->
              <text x="605" y="130" text-anchor="middle" font-family="monospace" font-size="8" fill="#f43f5e">
                ∂L/∂ŷ = -2(y - ŷ)
              </text>
              <text x="445" y="130" text-anchor="middle" font-family="monospace" font-size="8" fill="#ec4899">
                ∂L/∂b = ∇b
              </text>
              <text x="295" y="130" text-anchor="middle" font-family="monospace" font-size="8" fill="#f59e0b">
                ∂L/∂w = ∇w
              </text>

              <!-- Nodes Rendering -->
              <g v-for="node in graphNodes" :key="node.id">
                <rect
                  :x="node.x - 48"
                  :y="node.y - 24"
                  width="96"
                  height="48"
                  rx="6"
                  fill="rgba(15, 23, 42, 0.9)"
                  :stroke="node.color"
                  stroke-width="1.8"
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
                />
                <text
                  :x="node.x"
                  :y="node.y - 6"
                  text-anchor="middle"
                  font-family="monospace"
                  font-size="9.5"
                  font-weight="bold"
                  fill="#ffffff"
                >
                  {{ node.label }}
                </text>
                <text
                  :x="node.x"
                  :y="node.y + 12"
                  text-anchor="middle"
                  font-family="monospace"
                  font-size="8.5"
                  :fill="node.color"
                  font-weight="bold"
                >
                  {{ node.value }}
                </text>
              </g>

              <!-- Divider line between Zone 1 and Lower Zones -->
              <line x1="30" y1="165" x2="770" y2="165" stroke="currentColor" stroke-width="1" class="text-line/60" />
            </g>

            <!-- ======================================================== -->
            <!-- ZONE 2: MODEL SCATTER & LIVE FIT LINE (BOTTOM-LEFT)       -->
            <!-- ======================================================== -->
            <g>
              <!-- Zone Header -->
              <text
                :x="scatterBox.left"
                y="182"
                font-family="monospace"
                font-size="10"
                font-weight="bold"
                fill="currentColor"
                class="text-muted"
              >
                2. Live Regression Fit (ŷ = {{ currentW.toFixed(2) }}x + {{ currentB.toFixed(1) }})
              </text>

              <!-- Scatter Canvas Background -->
              <rect
                :x="scatterBox.left"
                :y="scatterBox.top"
                :width="scatterW"
                :height="scatterH"
                fill="rgba(240, 244, 248, 0.2)"
                stroke="none"
              />

              <!-- Axes -->
              <line
                :x1="scatterBox.left"
                :y1="scatterBox.bottom"
                :x2="scatterBox.right"
                :y2="scatterBox.bottom"
                stroke="currentColor"
                stroke-width="1.5"
                class="text-line"
              />
              <line
                :x1="scatterBox.left"
                :y1="scatterBox.top"
                :x2="scatterBox.left"
                :y2="scatterBox.bottom"
                stroke="currentColor"
                stroke-width="1.5"
                class="text-line"
              />

              <!-- Target OLS Optimal Line (Dashed Green) -->
              <line
                :x1="optimalLineCoords.x1"
                :y1="optimalLineCoords.y1"
                :x2="optimalLineCoords.x2"
                :y2="optimalLineCoords.y2"
                stroke="#10b981"
                stroke-width="2"
                stroke-dasharray="4 3"
                opacity="0.8"
              />

              <!-- Current Model Fit Line (Solid Blue) -->
              <line
                :x1="modelLineCoords.x1"
                :y1="modelLineCoords.y1"
                :x2="modelLineCoords.x2"
                :y2="modelLineCoords.y2"
                stroke="#3b82f6"
                stroke-width="3"
                stroke-linecap="round"
              />

              <!-- Scatter Data Points -->
              <circle
                v-for="p in activePreset.points"
                :key="'pt-' + p.id"
                :cx="scaleScatterX(p.x)"
                :cy="scaleScatterY(p.y)"
                r="4.5"
                fill="#3b82f6"
                stroke="#ffffff"
                stroke-width="1.5"
              />

              <!-- Scatter Axis Labels -->
              <text
                :x="(scatterBox.left + scatterBox.right) / 2"
                :y="scatterBox.bottom + 22"
                text-anchor="middle"
                font-family="monospace"
                font-size="9.5"
                font-weight="bold"
                fill="currentColor"
                class="text-ink"
              >
                {{ activePreset.xLabel }}
              </text>
            </g>

            <!-- ======================================================== -->
            <!-- ZONE 3: DUAL-METRIC CONVERGENCE PLOT (BOTTOM-RIGHT)       -->
            <!-- ======================================================== -->
            <g>
              <!-- Zone Header -->
              <text
                :x="convBox.left"
                y="182"
                font-family="monospace"
                font-size="10"
                font-weight="bold"
                fill="currentColor"
                class="text-muted"
              >
                3. Dual Convergence Plane: Loss (MSE ↓) vs. Accuracy (R² % ↑)
              </text>

              <!-- Plot Canvas Background -->
              <rect
                :x="convBox.left"
                :y="convBox.top"
                :width="convW"
                :height="convH"
                fill="rgba(240, 244, 248, 0.2)"
                stroke="none"
              />

              <!-- Base Grid Lines -->
              <line
                v-for="step in [0.25, 0.5, 0.75, 1.0]"
                :key="'conv-grid-' + step"
                :x1="convBox.left"
                :y1="convBox.bottom - step * convH"
                :x2="convBox.right"
                :y2="convBox.bottom - step * convH"
                stroke="currentColor"
                stroke-width="0.8"
                stroke-dasharray="2 3"
                class="text-line/50"
              />

              <!-- Left Y-Axis (Loss - Rose) -->
              <line
                :x1="convBox.left"
                :y1="convBox.top"
                :x2="convBox.left"
                :y2="convBox.bottom"
                stroke="#f43f5e"
                stroke-width="1.5"
              />
              <text
                :x="convBox.left - 6"
                :y="convBox.top + 8"
                text-anchor="end"
                font-family="monospace"
                font-size="8.5"
                fill="#f43f5e"
                font-weight="bold"
              >
                {{ maxDisplayLoss.toFixed(0) }}
              </text>
              <text
                :x="convBox.left - 6"
                :y="convBox.bottom - 2"
                text-anchor="end"
                font-family="monospace"
                font-size="8.5"
                fill="#f43f5e"
                font-weight="bold"
              >
                0
              </text>
              <text
                :x="convBox.left - 24"
                :y="(convBox.top + convBox.bottom) / 2"
                text-anchor="middle"
                transform="rotate(-90 421 320)"
                font-family="monospace"
                font-size="9"
                font-weight="bold"
                fill="#f43f5e"
              >
                Loss (MSE ↓)
              </text>

              <!-- Right Y-Axis (Accuracy - Emerald) -->
              <line
                :x1="convBox.right"
                :y1="convBox.top"
                :x2="convBox.right"
                :y2="convBox.bottom"
                stroke="#10b981"
                stroke-width="1.5"
              />
              <text
                :x="convBox.right + 6"
                :y="convBox.top + 8"
                text-anchor="start"
                font-family="monospace"
                font-size="8.5"
                fill="#10b981"
                font-weight="bold"
              >
                100%
              </text>
              <text
                :x="convBox.right + 6"
                :y="convBox.bottom - 2"
                text-anchor="start"
                font-family="monospace"
                font-size="8.5"
                fill="#10b981"
                font-weight="bold"
              >
                0%
              </text>
              <text
                :x="convBox.right + 26"
                :y="(convBox.top + convBox.bottom) / 2"
                text-anchor="middle"
                transform="rotate(90 781 320)"
                font-family="monospace"
                font-size="9"
                font-weight="bold"
                fill="#10b981"
              >
                Accuracy (R² % ↑)
              </text>

              <!-- Baseline (Epochs Axis) -->
              <line
                :x1="convBox.left"
                :y1="convBox.bottom"
                :x2="convBox.right"
                :y2="convBox.bottom"
                stroke="currentColor"
                stroke-width="1.5"
                class="text-line"
              />
              <text
                :x="(convBox.left + convBox.right) / 2"
                :y="convBox.bottom + 22"
                text-anchor="middle"
                font-family="monospace"
                font-size="9.5"
                font-weight="bold"
                fill="currentColor"
                class="text-ink"
              >
                Training Epochs (0 to {{ maxDisplayEpoch }})
              </text>

              <!-- 1. Loss Curve (Rose / Red) -->
              <path
                :d="lossPath"
                fill="none"
                stroke="#f43f5e"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />

              <!-- 2. Accuracy Curve (Emerald / Cyan) -->
              <path
                :d="accPath"
                fill="none"
                stroke="#10b981"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />

              <!-- Live Epoch Tracking Crosshairs & Dots -->
              <!-- Loss Tracker -->
              <circle
                :cx="latestLossPoint.x"
                :cy="latestLossPoint.y"
                r="4.5"
                fill="#f43f5e"
                stroke="#ffffff"
                stroke-width="1.5"
              />
              <!-- Accuracy Tracker -->
              <circle
                :cx="latestAccPoint.x"
                :cy="latestAccPoint.y"
                r="4.5"
                fill="#10b981"
                stroke="#ffffff"
                stroke-width="1.5"
              />
            </g>
          </svg>
        </div>
      </div>
    </main>

    <!-- Mathematical Foundations & Conceptual Walkthrough (2-Column Grid) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-0.5">
      <!-- 1. Chain Rule & Gradient Descent Equations -->
      <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm space-y-2 font-mono text-xs">
        <div class="flex items-center gap-1.5 font-bold text-ink">
          <TrendingUp class="w-3.5 h-3.5 text-brand-blue" />
          The Chain Rule &amp; Parameter Update Invariant
        </div>
        <p class="text-[11px] text-muted leading-relaxed">
          Backpropagation computes how each parameter affects total loss $\mathcal{L} = \frac{1}{N} \sum (y_i - \hat{y}_i)^2$:
        </p>

        <div class="p-2 rounded bg-card border border-line text-[11px] space-y-1">
          <div class="flex justify-between items-center">
            <span class="text-muted">Weight Gradient:</span>
            <span class="font-bold text-ink">∇w = -(2/N) · Σ xᵢ (yᵢ - ŷᵢ)</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-muted">Bias Gradient:</span>
            <span class="font-bold text-ink">∇b = -(2/N) · Σ (yᵢ - ŷᵢ)</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-muted">Descent Step:</span>
            <span class="font-bold text-brand-blue">w ← w - α·∇w, &nbsp; b ← b - α·∇b</span>
          </div>
        </div>
      </div>

      <!-- 2. Dual Convergence Intuition & Learning Rate Dynamics -->
      <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm space-y-2 font-mono text-xs">
        <div class="flex items-center gap-1.5 font-bold text-ink">
          <Zap class="w-3.5 h-3.5 text-amber-500" />
          Dual Convergence Dynamics &amp; Learning Rate (α)
        </div>
        <p class="text-[11px] text-muted leading-relaxed">
          Watch both curves evolve simultaneously during optimization:
        </p>

        <div class="space-y-1.5 text-[11px]">
          <div class="flex items-start gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-none"></span>
            <span>
              <strong>Dual Invariant:</strong> As Loss $\mathcal{L}$ monotonically descends, the Coefficient of Determination ($R^2$ Accuracy) ascends asymptotically towards the theoretical ceiling.
            </span>
          </div>
          <div class="flex items-start gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 flex-none"></span>
            <span>
              <strong>Learning Rate Overshoot:</strong> When $\alpha$ is too large ($> 0.10$), the update step jumps over the loss basin minimum, causing Loss to explode and Accuracy to plunge to $0\%$.
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Scikit-Learn & PyTorch Code Formulation -->
    <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm space-y-1 font-mono text-xs">
      <span class="text-[10px] text-muted uppercase font-bold tracking-wider">
        PyTorch Production Training Loop Formulation:
      </span>
      <pre class="text-[11px] text-ink whitespace-pre-wrap bg-card-subtle p-2.5 rounded border border-line/40">import torch
import torch.nn as nn
import torch.optim as optim

# 1. Linear Model: y_hat = w * x + b
model = nn.Linear(in_features=1, out_features=1)
criterion = nn.MSELoss()
optimizer = optim.SGD(model.parameters(), lr=0.025)

# 2. Training Loop with Dual Metrics Tracking
for epoch in range(60):
    # Forward Pass
    y_pred = model(X_tensor)
    loss = criterion(y_pred, y_tensor)
    
    # Backward Pass (Chain Rule Automatic Differentiation)
    optimizer.zero_grad()
    loss.backward()
    
    # Gradient Descent Step
    optimizer.step()
    
    # Dual Evaluation: Loss & R^2 Accuracy
    r2_score = 1.0 - (loss.item() / torch.var(y_tensor, unbiased=False).item())
    if epoch % 10 == 0:
        print(f"Epoch {epoch:02d} | Loss: {loss.item():.3f} | Accuracy (R²): {r2_score*100:.1f}%")</pre>
    </div>
  </div>
</template>

