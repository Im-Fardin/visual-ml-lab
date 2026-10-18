<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import {
  Activity,
  Sliders,
  Sparkles,
  RotateCcw,
  Info,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Square,
  Crosshair,
  Layers,
  Wand2,
  Zap
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'
import {
  REGRESSION_PRESETS,
  evaluateRegression,
  type RegressionPreset,
  type LossEvaluation
} from '~/utils/syntheticData'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- State ------------------------------------------------------------------
const activePresetId = ref<string>('study-hours')
const currentPreset = computed<RegressionPreset>(() => {
  return (
    REGRESSION_PRESETS.find((p) => p.id === activePresetId.value) ||
    REGRESSION_PRESETS[0]
  )
})

// Current user-adjusted parameters (w: slope, b: intercept)
const userW = ref<number>(3.0)
const userB = ref<number>(45.0)

// Visual Toggles
const showErrorSquares = ref<boolean>(true)
const showResidualStems = ref<boolean>(true)
const showOptimalLine = ref<boolean>(false)
const showCentroid = ref<boolean>(true)

// Hovered point for detailed tooltip
const hoveredPointId = ref<number | null>(null)

// Dynamic Slider Bounds based on active preset
const sliderConfig = computed(() => {
  const p = currentPreset.value
  const optW = p.optimalW
  const optB = p.optimalB

  const wSpan = Math.max(8, Math.abs(optW) * 1.6)
  const bSpan = Math.max(30, Math.abs(optB) * 0.8)

  return {
    wMin: Number((optW - wSpan).toFixed(2)),
    wMax: Number((optW + wSpan).toFixed(2)),
    wStep: Number((wSpan / 100).toFixed(2)) || 0.05,
    bMin: Number((optB - bSpan).toFixed(1)),
    bMax: Number((optB + bSpan).toFixed(1)),
    bStep: Number((bSpan / 100).toFixed(1)) || 0.5
  }
})

// Initialize parameters when preset changes
function initPreset(preset: RegressionPreset) {
  // Start with a reasonable initial guess: half optimal slope, intercept shifted
  userW.value = Number((preset.optimalW * 0.6).toFixed(2))
  userB.value = Number((preset.meanY - userW.value * preset.meanX + (preset.optimalB * 0.2)).toFixed(1))
  emitInspection()
}

watch(activePresetId, () => {
  initPreset(currentPreset.value)
})

// --- Loss & Residuals Evaluation --------------------------------------------
const evaluation = computed<LossEvaluation>(() => {
  return evaluateRegression(
    currentPreset.value.points,
    userW.value,
    userB.value
  )
})

// Loss comparison vs. analytical OLS optimum
const lossComparison = computed(() => {
  const optMse = currentPreset.value.optimalMse
  const curMse = evaluation.value.mse
  const ratio = optMse > 0 ? curMse / optMse : 1
  const pctOver = Math.max(0, (ratio - 1) * 100)
  const isNearOptimal = ratio <= 1.05

  return {
    ratio,
    pctOver,
    isNearOptimal,
    diffMse: curMse - optMse
  }
})

// --- SVG Layout & Coordinates (Standard 800 x 500) ---------------------------
const SVG_WIDTH = 800
const SVG_HEIGHT = 500
const MARGIN = { top: 35, right: 35, bottom: 70, left: 65 }

const plotWidth = SVG_WIDTH - MARGIN.left - MARGIN.right // 700
const plotHeight = SVG_HEIGHT - MARGIN.top - MARGIN.bottom // 395
const baselineY = SVG_HEIGHT - MARGIN.bottom // 430

const scaleX = (x: number): number => {
  const [xMin, xMax] = currentPreset.value.xDomain
  return MARGIN.left + ((x - xMin) / (xMax - xMin)) * plotWidth
}

const scaleY = (y: number): number => {
  const [yMin, yMax] = currentPreset.value.yDomain
  return baselineY - ((y - yMin) / (yMax - yMin)) * plotHeight
}

// Generate nice coordinate grid ticks
const gridTicks = computed(() => {
  const [xMin, xMax] = currentPreset.value.xDomain
  const [yMin, yMax] = currentPreset.value.yDomain

  const xTicks: number[] = []
  const xStep = (xMax - xMin) / 5
  for (let i = 0; i <= 5; i++) {
    xTicks.push(Number((xMin + i * xStep).toFixed(1)))
  }

  const yTicks: number[] = []
  const yStep = (yMax - yMin) / 5
  for (let i = 0; i <= 5; i++) {
    yTicks.push(Number((yMin + i * yStep).toFixed(1)))
  }

  return { xTicks, yTicks }
})

// User Hypothesis Line SVG Endpoints
const userLineCoords = computed(() => {
  const [xMin, xMax] = currentPreset.value.xDomain
  const y1 = userW.value * xMin + userB.value
  const y2 = userW.value * xMax + userB.value
  return {
    x1: scaleX(xMin),
    y1: scaleY(y1),
    x2: scaleX(xMax),
    y2: scaleY(y2)
  }
})

// Optimal OLS Line SVG Endpoints
const optimalLineCoords = computed(() => {
  const p = currentPreset.value
  const [xMin, xMax] = p.xDomain
  const y1 = p.optimalW * xMin + p.optimalB
  const y2 = p.optimalW * xMax + p.optimalB
  return {
    x1: scaleX(xMin),
    y1: scaleY(y1),
    x2: scaleX(xMax),
    y2: scaleY(y2)
  }
})

// Centroid SVG Coordinates
const centroidCoords = computed(() => {
  return {
    x: scaleX(currentPreset.value.meanX),
    y: scaleY(currentPreset.value.meanY)
  }
})

// Error Squares Geometry: Draw geometric square of area (y - yHat)^2
const errorSquaresGeometry = computed(() => {
  return evaluation.value.residuals.map((res, idx) => {
    const ptX = scaleX(res.x)
    const ptY = scaleY(res.y)
    const lineY = scaleY(res.yHat)

    // Pixel height difference
    const sidePx = Math.abs(ptY - lineY)
    const topY = Math.min(ptY, lineY)

    // Position square to the right of the point (or left if near right margin)
    const isRightNearEdge = ptX + sidePx > SVG_WIDTH - MARGIN.right
    const rectX = isRightNearEdge ? ptX - sidePx : ptX

    return {
      id: idx,
      x: rectX,
      y: topY,
      size: sidePx,
      residual: res.residual,
      squaredError: res.squaredError
    }
  })
})

// 1D MSE Curve (Slice through w while keeping b fixed)
const mseCurvePoints = computed(() => {
  const p = currentPreset.value
  const optW = p.optimalW
  const span = Math.max(6, Math.abs(optW) * 1.5)
  const minW = optW - span
  const maxW = optW + span
  const steps = 40

  const pts: Array<{ w: number; mse: number }> = []
  let maxMse = 0
  for (let i = 0; i <= steps; i++) {
    const w = minW + (i / steps) * (maxW - minW)
    const ev = evaluateRegression(p.points, w, userB.value)
    if (ev.mse > maxMse) maxMse = ev.mse
    pts.push({ w, mse: ev.mse })
  }

  return { pts, minW, maxW, maxMse }
})

// Actions
function snapToOptimal() {
  userW.value = currentPreset.value.optimalW
  userB.value = currentPreset.value.optimalB
  showOptimalLine.value = true
  emitInspection()
}

function resetGuess() {
  // Horizontal baseline at y = mean(Y)
  userW.value = 0
  userB.value = Number(currentPreset.value.meanY.toFixed(1))
  emitInspection()
}

// Telemetry Inspection emit
const emitInspection = () => {
  const p = currentPreset.value
  const ev = evaluation.value
  const comp = lossComparison.value

  emit('inspect', {
    title: 'Manual Linear Regression & Loss Geometry',
    details: {
      'Active Dataset': p.name,
      'Hypothesis Model': `ŷ = ${userW.value.toFixed(2)}·x + ${userB.value >= 0 ? '+' : ''}${userB.value.toFixed(1)}`,
      'Current MSE': ev.mse.toFixed(2),
      'Analytical Optimal MSE': p.optimalMse.toFixed(2),
      'Loss vs. Minimum': comp.isNearOptimal ? 'OPTIMAL (Global Minimum)' : `+${comp.pctOver.toFixed(1)}% above minimum`,
      'R² Score': `${(ev.r2 * 100).toFixed(1)}% (Optimal: ${(p.optimalR2 * 100).toFixed(1)}%)`,
      'Mean Absolute Error (MAE)': ev.mae.toFixed(2),
      'Root Mean Squared Error (RMSE)': ev.rmse.toFixed(2),
      'Centroid Invariant (X̄, Ȳ)': `(${p.meanX.toFixed(2)}, ${p.meanY.toFixed(2)}) — OLS line must pass through this point`,
      'Core Invariant': 'OLS analytically minimizes MSE: argmin_{w,b} (1/n)·Σ(y_i - (wx_i + b))²'
    }
  })
}

onMounted(() => {
  initPreset(currentPreset.value)
})
</script>

<template>
  <div class="w-full flex flex-col gap-2 p-2 sm:p-3 pb-12 max-h-[calc(100vh-185px)] overflow-y-auto pr-1">
    <!-- Top Controls Header -->
    <header class="flex-none mb-1 space-y-1.5">
      <!-- Row 1: Presets & Action Buttons -->
      <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
        <!-- Preset Scenarios -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-muted">Dataset:</span>
          <button
            v-for="preset in REGRESSION_PRESETS"
            :key="preset.id"
            type="button"
            @click="activePresetId = preset.id"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="activePresetId === preset.id ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            {{ preset.name }}
          </button>
        </div>

        <!-- Action Tools: Auto-Fit, Reset, Toggles -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <!-- Snap to OLS Optimum -->
          <button
            type="button"
            @click="snapToOptimal"
            class="px-2.5 py-1 rounded-md border text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs font-bold"
            title="Snap parameters to exact analytical OLS minimum"
          >
            <Wand2 class="w-3.5 h-3.5" />
            Auto-Fit (OLS)
          </button>

          <!-- Reset Sliders -->
          <button
            type="button"
            @click="resetGuess"
            class="px-2 py-1 rounded-md border border-line bg-card hover:bg-card-subtle text-muted hover:text-ink transition-colors flex items-center gap-1 cursor-pointer text-[11px]"
            title="Reset to horizontal baseline y = mean(y)"
          >
            <RotateCcw class="w-3 h-3" />
            Baseline (w=0)
          </button>

          <!-- Toggle: Error Squares -->
          <button
            type="button"
            @click="showErrorSquares = !showErrorSquares"
            class="px-2 py-1 rounded-md border text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer"
            :class="showErrorSquares ? 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-bold' : 'bg-card border-line text-muted hover:text-ink'"
            title="Toggle visualization of squared error area"
          >
            <Square class="w-3 h-3 text-rose-500" />
            Error Squares
          </button>

          <!-- Toggle: Optimal Ghost Line -->
          <button
            type="button"
            @click="showOptimalLine = !showOptimalLine"
            class="px-2 py-1 rounded-md border text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer"
            :class="showOptimalLine ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold' : 'bg-card border-line text-muted hover:text-ink'"
            title="Show analytical OLS best-fit comparison line"
          >
            Optimal Line
          </button>

          <!-- Toggle: Centroid Crosshair -->
          <button
            type="button"
            @click="showCentroid = !showCentroid"
            class="px-2 py-1 rounded-md border text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer"
            :class="showCentroid ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 font-bold' : 'bg-card border-line text-muted hover:text-ink'"
            title="Show dataset centroid (mean X, mean Y)"
          >
            <Crosshair class="w-3 h-3 text-indigo-500" />
            Centroid (X̄, Ȳ)
          </button>
        </div>
      </div>

      <!-- Row 2: Interactive Parameter Sliders (Slope w & Intercept b) -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
        <!-- Slope Slider (w) -->
        <div class="p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1 font-mono text-xs">
          <div class="flex items-center justify-between">
            <span class="font-bold text-ink flex items-center gap-1.5">
              <Sliders class="w-3.5 h-3.5 text-brand-blue" />
              Slope Parameter (w / Weight):
              <span class="text-brand-blue font-bold px-1.5 py-0.5 rounded bg-brand-blue/10">
                w = {{ userW.toFixed(2) }}
              </span>
            </span>
            <span class="text-[10.5px] text-muted">
              Optimal: <strong class="text-emerald-600 dark:text-emerald-400">{{ currentPreset.optimalW.toFixed(2) }}</strong>
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-[10px] text-muted font-bold">{{ sliderConfig.wMin }}</span>
            <input
              v-model.number="userW"
              type="range"
              :min="sliderConfig.wMin"
              :max="sliderConfig.wMax"
              :step="sliderConfig.wStep"
              @input="emitInspection"
              class="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-blue"
            />
            <span class="text-[10px] text-muted font-bold">{{ sliderConfig.wMax }}</span>
          </div>
        </div>

        <!-- Intercept Slider (b) -->
        <div class="p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1 font-mono text-xs">
          <div class="flex items-center justify-between">
            <span class="font-bold text-ink flex items-center gap-1.5">
              <Sliders class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              Intercept Parameter (b / Bias):
              <span class="text-purple-600 dark:text-purple-400 font-bold px-1.5 py-0.5 rounded bg-purple-500/10">
                b = {{ userB >= 0 ? '+' : '' }}{{ userB.toFixed(1) }}
              </span>
            </span>
            <span class="text-[10.5px] text-muted">
              Optimal: <strong class="text-emerald-600 dark:text-emerald-400">{{ currentPreset.optimalB >= 0 ? '+' : '' }}{{ currentPreset.optimalB.toFixed(1) }}</strong>
            </span>
          </div>

          <div class="flex items-center gap-2">
            <span class="text-[10px] text-muted font-bold">{{ sliderConfig.bMin }}</span>
            <input
              v-model.number="userB"
              type="range"
              :min="sliderConfig.bMin"
              :max="sliderConfig.bMax"
              :step="sliderConfig.bStep"
              @input="emitInspection"
              class="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
            />
            <span class="text-[10px] text-muted font-bold">{{ sliderConfig.bMax }}</span>
          </div>
        </div>
      </div>

      <!-- Live Loss Scoreboard HUD Ribbon -->
      <div class="p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between flex-wrap gap-3 font-mono text-xs">
        <!-- Current Model Equation -->
        <div class="flex items-center gap-2">
          <span class="text-muted">Model:</span>
          <span class="font-bold px-2 py-0.5 rounded bg-card text-ink border border-line text-[11.5px]">
            ŷ = {{ userW.toFixed(2) }}x {{ userB >= 0 ? '+' : '-' }} {{ Math.abs(userB).toFixed(1) }}
          </span>
        </div>

        <!-- MSE Loss Display -->
        <div class="flex items-center gap-2">
          <span class="text-muted">Mean Squared Error (MSE):</span>
          <span
            class="font-bold px-2 py-0.5 rounded text-[12px]"
            :class="lossComparison.isNearOptimal ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30'"
          >
            L = {{ evaluation.mse.toFixed(2) }}
          </span>
          <span class="text-[10.5px] text-muted">
            (Optimal: <strong>{{ currentPreset.optimalMse.toFixed(2) }}</strong>)
          </span>
        </div>

        <!-- R^2 Score -->
        <div class="flex items-center gap-2">
          <span class="text-muted">R² Score:</span>
          <span
            class="font-bold px-2 py-0.5 rounded text-[11.5px]"
            :class="evaluation.r2 > 0.8 ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : evaluation.r2 > 0.4 ? 'text-amber-600 dark:text-amber-400 bg-amber-500/10' : 'text-rose-600 dark:text-rose-400 bg-rose-500/10'"
          >
            {{ (evaluation.r2 * 100).toFixed(1) }}%
          </span>
        </div>

        <!-- Status Pill -->
        <div class="flex items-center gap-1.5">
          <span
            class="px-2 py-0.5 rounded-full text-[10.5px] font-bold flex items-center gap-1"
            :class="lossComparison.isNearOptimal ? 'bg-emerald-500 text-white' : 'bg-amber-500/20 text-amber-800 dark:text-amber-200 border border-amber-500/30'"
          >
            <CheckCircle2 v-if="lossComparison.isNearOptimal" class="w-3 h-3" />
            <AlertTriangle v-else class="w-3 h-3 text-amber-600 dark:text-amber-400" />
            {{ lossComparison.isNearOptimal ? 'Optimal Fit!' : `+${lossComparison.pctOver.toFixed(0)}% Above Min` }}
          </span>
        </div>
      </div>
    </header>

    <!-- Main SVG Visualization Canvas -->
    <main class="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-2 sm:p-3">
      <!-- Title & Live Area Ribbon -->
      <div class="w-full flex items-center justify-between text-xs font-mono mb-1 flex-none px-1">
        <span class="font-bold text-ink flex items-center gap-1.5">
          <Activity class="w-3.5 h-3.5 text-brand-blue" />
          Interactive Scatter Plane: Geometric Squared Errors & Residual Stems
        </span>
        <div class="flex items-center gap-3 text-[10.5px]">
          <span class="flex items-center gap-1 text-rose-600 dark:text-rose-400">
            <span class="w-2.5 h-2.5 rounded-sm bg-rose-500/20 border border-rose-500 inline-block"></span>
            Total Square Area: Σ(y - ŷ)² = {{ evaluation.totalSquaredError.toFixed(1) }}
          </span>
          <span class="flex items-center gap-1 text-brand-blue">
            <span class="w-3.5 h-0.5 bg-brand-blue inline-block"></span>
            Current Hypothesis ŷ
          </span>
        </div>
      </div>

      <!-- Chart Container: Fully visible, responsive aspect ratio -->
      <div class="w-full flex-1 flex items-center justify-center py-2 px-2 sm:px-4">
        <div class="w-full max-w-4xl aspect-[16/10] relative flex items-center justify-center">
          <svg
            viewBox="0 0 800 500"
            preserveAspectRatio="xMidYMid meet"
            class="w-full h-full block select-none"
          >
            <!-- Background Plane -->
            <rect
              :x="MARGIN.left"
              :y="MARGIN.top"
              :width="plotWidth"
              :height="plotHeight"
              fill="rgba(240, 244, 248, 0.15)"
              stroke="none"
            />

            <!-- Coordinate Grid Lines & Labels -->
            <!-- Vertical Grid (X) -->
            <g v-for="t in gridTicks.xTicks" :key="'xtick-' + t">
              <line
                :x1="scaleX(t)"
                :y1="MARGIN.top"
                :x2="scaleX(t)"
                :y2="baselineY"
                stroke="currentColor"
                stroke-width="0.8"
                stroke-dasharray="2 3"
                class="text-line/60"
              />
              <text
                :x="scaleX(t)"
                :y="baselineY + 16"
                text-anchor="middle"
                font-family="monospace"
                font-size="9.5"
                fill="currentColor"
                class="text-muted"
              >
                {{ t }}
              </text>
            </g>

            <!-- Horizontal Grid (Y) -->
            <g v-for="t in gridTicks.yTicks" :key="'ytick-' + t">
              <line
                :x1="MARGIN.left"
                :y1="scaleY(t)"
                :x2="SVG_WIDTH - MARGIN.right"
                :y2="scaleY(t)"
                stroke="currentColor"
                stroke-width="0.8"
                stroke-dasharray="2 3"
                class="text-line/60"
              />
              <text
                :x="MARGIN.left - 8"
                :y="scaleY(t) + 3.5"
                text-anchor="end"
                font-family="monospace"
                font-size="9.5"
                fill="currentColor"
                class="text-muted"
              >
                {{ t }}
              </text>
            </g>

            <!-- Plot Axes -->
            <line
              :x1="MARGIN.left"
              :y1="baselineY"
              :x2="SVG_WIDTH - MARGIN.right"
              :y2="baselineY"
              stroke="currentColor"
              stroke-width="1.6"
              class="text-line"
            />
            <line
              :x1="MARGIN.left"
              :y1="MARGIN.top"
              :x2="MARGIN.left"
              :y2="baselineY"
              stroke="currentColor"
              stroke-width="1.6"
              class="text-line"
            />

            <!-- Axis Titles -->
            <text
              :x="SVG_WIDTH / 2"
              :y="baselineY + 38"
              text-anchor="middle"
              font-family="monospace"
              font-size="11"
              font-weight="bold"
              fill="currentColor"
              class="text-ink"
            >
              {{ currentPreset.xLabel }}
            </text>
            <text
              :x="18"
              :y="SVG_HEIGHT / 2"
              text-anchor="middle"
              transform="rotate(-90 18 250)"
              font-family="monospace"
              font-size="11"
              font-weight="bold"
              fill="currentColor"
              class="text-ink"
            >
              {{ currentPreset.yLabel }}
            </text>

            <!-- 1. Geometric Error Squares: Area = (y - ŷ)² -->
            <g v-if="showErrorSquares">
              <rect
                v-for="sq in errorSquaresGeometry"
                :key="'sq-' + sq.id"
                :x="sq.x"
                :y="sq.y"
                :width="sq.size"
                :height="sq.size"
                fill="rgba(244, 63, 94, 0.16)"
                stroke="#f43f5e"
                stroke-width="1"
                stroke-dasharray="3 2"
                class="transition-all duration-75"
              />
            </g>

            <!-- 2. Residual Stems: Vertical distance e_i = y_i - ŷ_i -->
            <g v-if="showResidualStems">
              <line
                v-for="res in evaluation.residuals"
                :key="'stem-' + res.x"
                :x1="scaleX(res.x)"
                :y1="scaleY(res.y)"
                :x2="scaleX(res.x)"
                :y2="scaleY(res.yHat)"
                :stroke="res.residual >= 0 ? '#10b981' : '#f59e0b'"
                stroke-width="2"
                stroke-linecap="round"
              />
            </g>

            <!-- 3. Analytical Optimal OLS Line (Ghosted / Comparison) -->
            <line
              v-if="showOptimalLine"
              :x1="optimalLineCoords.x1"
              :y1="optimalLineCoords.y1"
              :x2="optimalLineCoords.x2"
              :y2="optimalLineCoords.y2"
              stroke="#10b981"
              stroke-width="2.5"
              stroke-dasharray="6 4"
              opacity="0.85"
            />

            <!-- 4. User Hypothesis Line (ŷ = wx + b) -->
            <line
              :x1="userLineCoords.x1"
              :y1="userLineCoords.y1"
              :x2="userLineCoords.x2"
              :y2="userLineCoords.y2"
              stroke="#2563eb"
              stroke-width="3"
              stroke-linecap="round"
            />

            <!-- 5. Centroid Crosshair (X̄, Ȳ) -->
            <g v-if="showCentroid">
              <line
                :x1="centroidCoords.x"
                :y1="MARGIN.top"
                :x2="centroidCoords.x"
                :y2="baselineY"
                stroke="#6366f1"
                stroke-width="1.2"
                stroke-dasharray="3 3"
              />
              <line
                :x1="MARGIN.left"
                :y1="centroidCoords.y"
                :x2="SVG_WIDTH - MARGIN.right"
                :y2="centroidCoords.y"
                stroke="#6366f1"
                stroke-width="1.2"
                stroke-dasharray="3 3"
              />
              <!-- Centroid Marker -->
              <circle
                :cx="centroidCoords.x"
                :cy="centroidCoords.y"
                r="5"
                fill="#6366f1"
                stroke="#ffffff"
                stroke-width="2"
              />
              <text
                :x="centroidCoords.x + 8"
                :y="centroidCoords.y - 8"
                font-family="monospace"
                font-size="9"
                font-weight="bold"
                fill="#6366f1"
              >
                Centroid (X̄={{ currentPreset.meanX.toFixed(1) }}, Ȳ={{ currentPreset.meanY.toFixed(1) }})
              </text>
            </g>

            <!-- 6. Data Points -->
            <g
              v-for="p in currentPreset.points"
              :key="'pt-' + p.id"
              class="cursor-pointer"
              @mouseenter="hoveredPointId = p.id"
              @mouseleave="hoveredPointId = null"
            >
              <circle
                :cx="scaleX(p.x)"
                :cy="scaleY(p.y)"
                :r="hoveredPointId === p.id ? 7 : 4.5"
                fill="#2563eb"
                stroke="#ffffff"
                stroke-width="1.5"
                class="transition-all duration-100"
              />
            </g>

            <!-- Hover Tooltip Callout -->
            <g v-if="hoveredPointId !== null">
              <template v-for="res in evaluation.residuals" :key="'tt-' + res.x">
                <g
                  v-if="currentPreset.points.find(p => p.id === hoveredPointId)?.x === res.x"
                  :transform="`translate(${Math.min(scaleX(res.x) + 12, SVG_WIDTH - MARGIN.right - 145)}, ${Math.max(scaleY(res.y) - 50, MARGIN.top + 10)})`"
                >
                  <rect
                    width="140"
                    height="48"
                    rx="6"
                    fill="rgba(15, 23, 42, 0.92)"
                    stroke="#64748b"
                    stroke-width="1"
                  />
                  <text x="10" y="16" font-family="monospace" font-size="9" fill="#ffffff">
                    Point: ({{ res.x.toFixed(1) }}, {{ res.y.toFixed(1) }})
                  </text>
                  <text x="10" y="30" font-family="monospace" font-size="8.5" fill="#94a3b8">
                    Prediction ŷ: {{ res.yHat.toFixed(1) }}
                  </text>
                  <text
                    x="10"
                    y="43"
                    font-family="monospace"
                    font-size="8.5"
                    font-weight="bold"
                    :fill="res.residual >= 0 ? '#34d399' : '#f87171'"
                  >
                    Error: {{ res.residual >= 0 ? '+' : '' }}{{ res.residual.toFixed(1) }} (Sq: {{ res.squaredError.toFixed(1) }})
                  </text>
                </g>
              </template>
            </g>
          </svg>
        </div>
      </div>

      <!-- Footnote Legend -->
      <div class="mt-1 px-1 flex items-center justify-between text-[11px] font-mono text-muted border-t border-line/40 pt-1.5 flex-wrap gap-2">
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1.5">
            <span class="w-3.5 h-0.5 bg-brand-blue inline-block"></span>
            User Model ŷ = wx + b
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-3.5 h-0.5 bg-emerald-500 inline-block border-b border-dashed"></span>
            Optimal OLS Line ŷ*
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 bg-rose-500/20 border border-rose-500 inline-block"></span>
            Squared Error Area eᵢ²
          </span>
        </div>
        <div>
          Sample Size: <strong>N = {{ currentPreset.points.length }}</strong> observations
        </div>
      </div>
    </main>

    <!-- Mathematical Foundations & Loss Geometry (2-Column Grid) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-0.5">
      <!-- 1. The Geometry of Ordinary Least Squares -->
      <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm space-y-2 font-mono text-xs">
        <div class="flex items-center gap-1.5 font-bold text-ink">
          <TrendingUp class="w-3.5 h-3.5 text-brand-blue" />
          The Geometry of Ordinary Least Squares (OLS)
        </div>
        <p class="text-[11px] text-muted leading-relaxed">
          Linear regression minimizes the vertical distance between observed targets $y_i$ and predictions $\hat{y}_i$:
        </p>

        <div class="p-2 rounded bg-card border border-line text-[11px] space-y-1">
          <div class="flex justify-between items-center">
            <span class="text-muted">Mean Squared Error (MSE):</span>
            <span class="font-bold text-ink">L(w, b) = (1/N) · Σ (yᵢ - (w·xᵢ + b))²</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-muted">Analytical Optimal Slope:</span>
            <span class="font-bold text-emerald-600 dark:text-emerald-400">w* = Cov(X,Y) / Var(X)</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-muted">Analytical Optimal Bias:</span>
            <span class="font-bold text-purple-600 dark:text-purple-400">b* = Ȳ - w*·X̄</span>
          </div>
        </div>

        <div class="text-[10.5px] text-muted flex items-center gap-1.5 pt-0.5">
          <Info class="w-3.5 h-3.5 text-brand-blue flex-none" />
          <span>Notice that at the optimum, the regression line is mathematically guaranteed to pass directly through the centroid $(\bar{x}, \bar{y})$.</span>
        </div>
      </div>

      <!-- 2. Why Square Errors? (L2 vs. L1 Loss) -->
      <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm space-y-2 font-mono text-xs">
        <div class="flex items-center gap-1.5 font-bold text-ink">
          <Square class="w-3.5 h-3.5 text-rose-500" />
          Why Square Errors? (L2 vs. L1 Loss)
        </div>
        <p class="text-[11px] text-muted leading-relaxed">
          Squaring the vertical residuals $e_i = y_i - \hat{y}_i$ imparts fundamental mathematical properties:
        </p>

        <div class="space-y-1.5 text-[11px]">
          <div class="flex items-start gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 flex-none"></span>
            <span>
              <strong>Outlier Penalty:</strong> Squaring penalizes errors non-linearly. An error of $4$ creates a square of area $16$, sixteen times more punishing than an error of $1$.
            </span>
          </div>
          <div class="flex items-start gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 flex-none"></span>
            <span>
              <strong>Strict Convexity & Differentiability:</strong> The MSE loss function is a smooth quadratic bowl with continuous derivatives everywhere ($\frac{\partial L}{\partial w}, \frac{\partial L}{\partial b}$), enabling exact closed-form solutions and gradient descent.
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Scikit-Learn & NumPy Production Formulation -->
    <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm space-y-1 font-mono text-xs">
      <span class="text-[10px] text-muted uppercase font-bold tracking-wider">
        Production OLS Regression Formulation:
      </span>
      <pre class="text-[11px] text-ink whitespace-pre-wrap bg-card-subtle p-2.5 rounded border border-line/40">import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, r2_score

# Fit analytical Ordinary Least Squares (OLS) via Normal Equation (X^T X)^(-1) X^T y
model = LinearRegression(fit_intercept=True)
model.fit(X.reshape(-1, 1), y)

w_optimal = model.coef_[0]
b_optimal = model.intercept_
y_pred = model.predict(X.reshape(-1, 1))

print(f"Optimal Model: y_hat = {w_optimal:.3f} * x + {b_optimal:.2f}")
print(f"MSE: {mean_squared_error(y, y_pred):.3f} | R²: {r2_score(y, y_pred):.3f}")</pre>
    </div>
  </div>
</template>

