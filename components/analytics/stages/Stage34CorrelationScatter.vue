<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Activity,
  Sliders,
  Sparkles,
  RotateCcw,
  Info,
  CheckCircle2,
  TrendingUp,
  Layers,
  ArrowRight,
  Crosshair,
  AlertTriangle,
  Zap
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Deterministic Pseudo-Random Generator (seeded) ---
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Box-Muller transform for standard normal pairs
function generateNormalPairs(seed: number, count: number): Array<{ z1: number; z2: number }> {
  const rng = mulberry32(seed)
  const pairs: Array<{ z1: number; z2: number }> = []
  for (let i = 0; i < count; i++) {
    const u1 = Math.max(1e-7, rng())
    const u2 = rng()
    const r = Math.sqrt(-2.0 * Math.log(u1))
    const theta = 2.0 * Math.PI * u2
    const z1 = r * Math.cos(theta)
    const z2 = r * Math.sin(theta)
    pairs.push({ z1, z2 })
  }
  return pairs
}

// --- State ------------------------------------------------------------------
const seed = ref<number>(42)
const basePairs = computed(() => generateNormalPairs(seed.value, 50))

// Interactive controls
const targetR = ref<number>(0.75)
const isParabolaMode = ref<boolean>(false)
const injectOutlier = ref<boolean>(false)
const showCentroidCrosshairs = ref<boolean>(true)
const showResiduals = ref<boolean>(false)

// Hover probe point
const hoveredPoint = ref<{
  id: number
  x: number
  y: number
  dx: number
  dy: number
  prod: number
  isOutlier?: boolean
} | null>(null)

// --- Points Computation (Bivariate Projection & Parabola) --------------------
interface ScatterPoint {
  id: number
  x: number
  y: number
  isOutlier: boolean
}

const points = computed<ScatterPoint[]>(() => {
  if (isParabolaMode.value) {
    // Parabola non-linear trap: y = 4*(x-50)^2 / 30 + 18 + noise
    const rng = mulberry32(seed.value + 999)
    return basePairs.value.map((pair, idx) => {
      // Spread x evenly across [18, 82]
      const t = idx / (basePairs.value.length - 1)
      const x = 18 + t * 64 + (pair.z1 * 1.5)
      const u = (x - 50)
      const noise = (rng() - 0.5) * 6
      const y = 22 + (u * u) / 20 + noise
      return {
        id: idx,
        x: Math.max(10, Math.min(90, x)),
        y: Math.max(10, Math.min(90, y)),
        isOutlier: false
      }
    })
  }

  // Linear mode with Pearson target r using Cholesky factor:
  // X = z1, Y = r*z1 + sqrt(1 - r^2)*z2
  const r = targetR.value
  const factor = Math.sqrt(Math.max(0, 1 - r * r))

  const pts: ScatterPoint[] = basePairs.value.map((pair, idx) => {
    const rawX = pair.z1
    const rawY = r * pair.z1 + factor * pair.z2
    // Scale and center around (50, 50) with standard deviation ~13
    const x = 50 + rawX * 13
    const y = 50 + rawY * 13
    return {
      id: idx,
      x: Math.max(8, Math.min(92, x)),
      y: Math.max(8, Math.min(92, y)),
      isOutlier: false
    }
  })

  // High-leverage outlier injection
  if (injectOutlier.value) {
    pts.push({
      id: 999,
      x: 88,
      y: 14,
      isOutlier: true
    })
  }

  return pts
})

// --- Statistical Computations (OLS & Correlation) --------------------------
const stats = computed(() => {
  const pts = points.value
  const n = pts.length
  if (n === 0) {
    return {
      meanX: 50,
      meanY: 50,
      covXY: 0,
      varX: 1,
      varY: 1,
      r: 0,
      r2: 0,
      slope: 0,
      intercept: 50,
      positiveProdCount: 0,
      negativeProdCount: 0
    }
  }

  let sumX = 0
  let sumY = 0
  for (const p of pts) {
    sumX += p.x
    sumY += p.y
  }
  const meanX = sumX / n
  const meanY = sumY / n

  let ssXX = 0
  let ssYY = 0
  let ssXY = 0
  let posCount = 0
  let negCount = 0

  for (const p of pts) {
    const dx = p.x - meanX
    const dy = p.y - meanY
    const prod = dx * dy
    if (prod >= 0) posCount++
    else negCount++

    ssXX += dx * dx
    ssYY += dy * dy
    ssXY += prod
  }

  const varX = ssXX / (n - 1)
  const varY = ssYY / (n - 1)
  const covXY = ssXY / (n - 1)

  const denom = Math.sqrt(Math.max(1e-9, ssXX * ssYY))
  const empiricalR = denom === 0 ? 0 : Math.max(-1, Math.min(1, ssXY / denom))
  const r2 = empiricalR * empiricalR

  const slope = ssXX === 0 ? 0 : ssXY / ssXX
  const intercept = meanY - slope * meanX

  return {
    meanX,
    meanY,
    covXY,
    varX,
    varY,
    r: empiricalR,
    r2,
    slope,
    intercept,
    positiveProdCount: posCount,
    negativeProdCount: negCount
  }
})

// --- SVG Layout & Coordinates (Standard Aspect Ratio 800 x 420) -------------
const svgWidth = 800
const svgHeight = 420
const margin = { top: 20, right: 30, bottom: 42, left: 55 }

const plotWidth = computed(() => svgWidth - margin.left - margin.right)
const plotHeight = computed(() => svgHeight - margin.top - margin.bottom)

// Domain [0, 100] for both X and Y
const scaleX = (val: number): number => {
  return margin.left + (val / 100) * plotWidth.value
}

// Invert Y so 0 is at bottom baseline
const scaleY = (val: number): number => {
  return svgHeight - margin.bottom - (val / 100) * plotHeight.value
}

// Grid lines
const gridTicks = [10, 25, 50, 75, 90]

// OLS Line SVG Coordinates
const olsLineCoords = computed(() => {
  const { slope, intercept } = stats.value
  const x1 = 5
  const y1 = slope * x1 + intercept
  const x2 = 95
  const y2 = slope * x2 + intercept

  return {
    x1: scaleX(x1),
    y1: scaleY(Math.max(0, Math.min(100, y1))),
    x2: scaleX(x2),
    y2: scaleY(Math.max(0, Math.min(100, y2)))
  }
})

// Quadrant regions relative to Centroid (meanX, meanY)
const centroidCoord = computed(() => ({
  x: scaleX(stats.value.meanX),
  y: scaleY(stats.value.meanY)
}))

// --- Preset Actions ---------------------------------------------------------
const setPreset = (preset: 'perfect' | 'strong_pos' | 'zero' | 'strong_neg' | 'parabola') => {
  if (preset === 'parabola') {
    isParabolaMode.value = true
    injectOutlier.value = false
  } else {
    isParabolaMode.value = false
    if (preset === 'perfect') targetR.value = 1.0
    else if (preset === 'strong_pos') targetR.value = 0.85
    else if (preset === 'zero') targetR.value = 0.0
    else if (preset === 'strong_neg') targetR.value = -0.85
  }
  emitInspection()
}

const reseed = () => {
  seed.value = Math.floor(Math.random() * 10000)
  emitInspection()
}

// --- Telemetry Emit ---------------------------------------------------------
const emitInspection = () => {
  const s = stats.value
  emit('inspect', {
    title: isParabolaMode.value
      ? 'Non-Linear Correlation Trap (Parabolic U-Shape)'
      : 'Bivariate Correlation & OLS Linear Regression',
    details: {
      'Target Correlation (r)': isParabolaMode.value ? 'N/A (Non-Linear Mode)' : targetR.value.toFixed(2),
      'Empirical Pearson (r)': s.r.toFixed(4),
      'Coeff. of Determination (R²)': `${(s.r2 * 100).toFixed(1)}%`,
      'OLS Slope (β₁)': s.slope.toFixed(3),
      'OLS Intercept (β₀)': s.intercept.toFixed(2),
      'Centroid Coordinates (X̄, Ȳ)': `(${s.meanX.toFixed(1)}, ${s.meanY.toFixed(1)})`,
      'High-Leverage Outlier': injectOutlier.value ? 'ACTIVE (Pivots Slope & Collapses r)' : 'None',
      'Quadrant Concordance': `${s.positiveProdCount} Positive vs ${s.negativeProdCount} Negative Products`,
      'Core Invariant': isParabolaMode.value
        ? 'Pearson r measures LINEAR relationships only: perfect functional relationship can yield r ≈ 0'
        : 'Cov(X,Y) / (σx·σy) ∈ [-1.0, +1.0]'
    }
  })
}

onMounted(() => {
  emitInspection()
})
</script>

<template>
  <div class="w-full flex flex-col gap-2 p-2 sm:p-3 pb-12 max-h-[calc(100vh-185px)] overflow-y-auto pr-1">
    <!-- Top Controls Header -->
    <header class="flex-none mb-1.5 space-y-1.5">
      <!-- Preset Buttons & Action Toggles -->
      <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
        <!-- Preset Scenarios -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-muted">Presets:</span>
          <button
            type="button"
            @click="setPreset('perfect')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="!isParabolaMode && targetR === 1.0 ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Perfect (+1.0)
          </button>
          <button
            type="button"
            @click="setPreset('strong_pos')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="!isParabolaMode && targetR === 0.85 ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Strong (+0.85)
          </button>
          <button
            type="button"
            @click="setPreset('zero')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="!isParabolaMode && targetR === 0.0 ? 'bg-purple-600 text-white font-bold border-purple-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Zero (0.00)
          </button>
          <button
            type="button"
            @click="setPreset('strong_neg')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="!isParabolaMode && targetR === -0.85 ? 'bg-rose-600 text-white font-bold border-rose-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Negative (-0.85)
          </button>
          <button
            type="button"
            @click="setPreset('parabola')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="isParabolaMode ? 'bg-amber-600 text-white font-bold border-amber-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Non-Linear Trap (Parabola)
          </button>
        </div>

        <!-- Toggles: Outlier, Centroid, Residuals, Reseed -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <!-- Outlier Injection Button -->
          <button
            type="button"
            @click="injectOutlier = !injectOutlier; emitInspection()"
            class="px-2 py-1 rounded-md border text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer"
            :class="injectOutlier ? 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/40 font-bold' : 'bg-card border-line text-muted hover:text-ink'"
          >
            <AlertTriangle class="w-3 h-3 text-rose-500" />
            Inject Outlier
          </button>

          <!-- Centroid Crosshairs Toggle -->
          <button
            type="button"
            @click="showCentroidCrosshairs = !showCentroidCrosshairs"
            class="px-2 py-1 rounded-md border text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer"
            :class="showCentroidCrosshairs ? 'bg-brand-blue/15 text-brand-blue border-brand-blue/30 font-bold' : 'bg-card border-line text-muted hover:text-ink'"
          >
            <Crosshair class="w-3 h-3 text-brand-blue" />
            Centroid (X̄, Ȳ)
          </button>

          <!-- Residual Stems Toggle -->
          <button
            type="button"
            @click="showResiduals = !showResiduals"
            class="px-2 py-1 rounded-md border text-[11px] font-medium transition-all flex items-center gap-1 cursor-pointer"
            :class="showResiduals ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 font-bold' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Residuals (eᵢ)
          </button>

          <!-- Reseed Points -->
          <button
            type="button"
            @click="reseed"
            title="Generate new random point sample"
            class="px-2 py-1 rounded-md border border-line bg-card hover:bg-card-subtle text-muted hover:text-ink transition-colors flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw class="w-3 h-3" />
            Reseed
          </button>
        </div>
      </div>

      <!-- Pearson Target R Slider Card -->
      <div
        v-if="!isParabolaMode"
        class="p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1 font-mono text-xs"
      >
        <div class="flex items-center justify-between">
          <span class="font-bold text-ink flex items-center gap-1.5">
            <Sliders class="w-3.5 h-3.5 text-brand-blue" />
            Bivariate Target Correlation (Pearson r):
            <span
              class="font-bold px-1.5 py-0.5 rounded"
              :class="targetR > 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : targetR < 0 ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400' : 'bg-slate-500/15 text-muted'"
            >
              r = {{ targetR >= 0 ? '+' : '' }}{{ targetR.toFixed(2) }}
            </span>
          </span>
          <div class="flex items-center gap-2 text-[11px]">
            <span class="text-muted">Empirical r:</span>
            <span class="font-bold text-ink">{{ stats.r.toFixed(3) }}</span>
            <span class="text-muted ml-2">R²:</span>
            <span class="font-bold text-brand-blue">{{ (stats.r2 * 100).toFixed(1) }}%</span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-[10px] text-rose-500 font-bold">-1.00</span>
          <input
            v-model.number="targetR"
            type="range"
            min="-1.0"
            max="1.0"
            step="0.05"
            @input="emitInspection"
            class="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-blue"
          />
          <span class="text-[10px] text-emerald-500 font-bold">+1.00</span>
        </div>
      </div>

      <!-- Parabola Mode Warning Banner -->
      <div
        v-else
        class="p-2.5 sm:p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 dark:bg-amber-950/20 shadow-sm flex items-center justify-between font-mono text-xs"
      >
        <div class="flex items-center gap-2 text-amber-800 dark:text-amber-200">
          <AlertTriangle class="w-4 h-4 text-amber-600 dark:text-amber-400 flex-none" />
          <span>
            <strong>Non-Linear Trap:</strong> Perfect quadratic dependency y = f(x) with Pearson
            <strong>r ≈ {{ stats.r.toFixed(3) }}</strong>. Pearson r tests <em>linear</em> association only!
          </span>
        </div>
        <button
          type="button"
          @click="setPreset('strong_pos')"
          class="px-2 py-0.5 rounded bg-amber-600 text-white font-bold text-[10.5px] hover:bg-amber-700 transition-colors cursor-pointer"
        >
          Exit Trap
        </button>
      </div>
    </header>

    <!-- Main Visualization Stage (Aspect-Ratio Canvas) -->
    <main class="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-2 sm:p-3">
      <!-- Title & Live Equation Ribbon -->
      <div class="w-full flex items-center justify-between text-xs font-mono mb-1 flex-none px-1">
        <span class="font-bold text-ink flex items-center gap-1.5">
          <Activity class="w-3.5 h-3.5 text-brand-blue" />
          Scatter Dispersion, Centroid Quadrants & Ordinary Least Squares (OLS)
        </span>
        <div class="flex items-center gap-2 text-[10.5px]">
          <span class="text-muted">OLS Fit:</span>
          <span class="font-bold px-1.5 py-0.5 rounded bg-card text-ink border border-line">
            ŷ = {{ stats.slope >= 0 ? '' : '-' }}{{ Math.abs(stats.slope).toFixed(2) }}x {{ stats.intercept >= 0 ? '+' : '-' }} {{ Math.abs(stats.intercept).toFixed(1) }}
          </span>
        </div>
      </div>

      <!-- Chart Container: Wide, expanded, fully visible -->
      <div class="w-full flex-1 flex items-center justify-center py-1">
        <div class="w-full aspect-[2/1] sm:aspect-[2.2/1] max-h-[300px] sm:max-h-[320px] md:max-h-[340px] relative flex items-center justify-center">
          <svg
            viewBox="0 0 800 420"
            preserveAspectRatio="xMidYMid meet"
            class="w-full h-full block"
          >
            <!-- Background & Outer Bounds -->
            <rect
              :x="margin.left"
              :y="margin.top"
              :width="plotWidth"
              :height="plotHeight"
              fill="rgba(240, 244, 248, 0.2)"
              stroke="none"
            />

            <!-- Coordinate Grid Lines & Axis Labels -->
            <g v-for="t in gridTicks" :key="'grid-' + t">
              <!-- Vertical Grid Line -->
              <line
                :x1="scaleX(t)"
                :y1="margin.top"
                :x2="scaleX(t)"
                :y2="svgHeight - margin.bottom"
                stroke="currentColor"
                stroke-width="0.8"
                stroke-dasharray="2 3"
                class="text-line/60"
              />
              <text
                :x="scaleX(t)"
                :y="svgHeight - margin.bottom + 14"
                text-anchor="middle"
                font-family="monospace"
                font-size="9.5"
                fill="currentColor"
                class="text-muted"
              >
                {{ t }}
              </text>

              <!-- Horizontal Grid Line -->
              <line
                :x1="margin.left"
                :y1="scaleY(t)"
                :x2="svgWidth - margin.right"
                :y2="scaleY(t)"
                stroke="currentColor"
                stroke-width="0.8"
                stroke-dasharray="2 3"
                class="text-line/60"
              />
              <text
                :x="margin.left - 8"
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
              :x1="margin.left"
              :y1="svgHeight - margin.bottom"
              :x2="svgWidth - margin.right"
              :y2="svgHeight - margin.bottom"
              stroke="currentColor"
              stroke-width="1.5"
              class="text-line"
            />
            <line
              :x1="margin.left"
              :y1="margin.top"
              :x2="margin.left"
              :y2="svgHeight - margin.bottom"
              stroke="currentColor"
              stroke-width="1.5"
              class="text-line"
            />

            <!-- Axis Titles -->
            <text
              :x="svgWidth / 2"
              :y="svgHeight - margin.bottom + 32"
              text-anchor="middle"
              font-family="monospace"
              font-size="10.5"
              font-weight="bold"
              fill="currentColor"
              class="text-ink"
            >
              Independent Feature X
            </text>
            <text
              :x="14"
              :y="svgHeight / 2"
              text-anchor="middle"
              transform="rotate(-90 14 210)"
              font-family="monospace"
              font-size="10.5"
              font-weight="bold"
              fill="currentColor"
              class="text-ink"
            >
              Dependent Feature Y
            </text>

            <!-- Centroid Quadrant Regions & Crosshairs -->
            <g v-if="showCentroidCrosshairs">
              <!-- Quadrant I (Top-Right): (+)(+) = (+) -->
              <rect
                :x="centroidCoord.x"
                :y="margin.top"
                :width="svgWidth - margin.right - centroidCoord.x"
                :height="centroidCoord.y - margin.top"
                fill="rgba(16, 185, 129, 0.05)"
              />
              <text
                :x="svgWidth - margin.right - 8"
                :y="margin.top + 16"
                text-anchor="end"
                font-family="monospace"
                font-size="8.5"
                font-weight="bold"
                fill="#10b981"
              >
                Q₁ (+)(+) &gt; 0
              </text>

              <!-- Quadrant II (Top-Left): (-)(+) = (-) -->
              <rect
                :x="margin.left"
                :y="margin.top"
                :width="centroidCoord.x - margin.left"
                :height="centroidCoord.y - margin.top"
                fill="rgba(244, 63, 94, 0.04)"
              />
              <text
                :x="margin.left + 8"
                :y="margin.top + 16"
                text-anchor="start"
                font-family="monospace"
                font-size="8.5"
                font-weight="bold"
                fill="#f43f5e"
              >
                Q₂ (-)(+) &lt; 0
              </text>

              <!-- Quadrant III (Bottom-Left): (-)(-) = (+) -->
              <rect
                :x="margin.left"
                :y="centroidCoord.y"
                :width="centroidCoord.x - margin.left"
                :height="svgHeight - margin.bottom - centroidCoord.y"
                fill="rgba(16, 185, 129, 0.05)"
              />
              <text
                :x="margin.left + 8"
                :y="svgHeight - margin.bottom - 10"
                text-anchor="start"
                font-family="monospace"
                font-size="8.5"
                font-weight="bold"
                fill="#10b981"
              >
                Q₃ (-)(-) &gt; 0
              </text>

              <!-- Quadrant IV (Bottom-Right): (+)(-) = (-) -->
              <rect
                :x="centroidCoord.x"
                :y="centroidCoord.y"
                :width="svgWidth - margin.right - centroidCoord.x"
                :height="svgHeight - margin.bottom - centroidCoord.y"
                fill="rgba(244, 63, 94, 0.04)"
              />
              <text
                :x="svgWidth - margin.right - 8"
                :y="svgHeight - margin.bottom - 10"
                text-anchor="end"
                font-family="monospace"
                font-size="8.5"
                font-weight="bold"
                fill="#f43f5e"
              >
                Q₄ (+)(-) &lt; 0
              </text>

              <!-- Vertical Centroid Line (X = meanX) -->
              <line
                :x1="centroidCoord.x"
                :y1="margin.top"
                :x2="centroidCoord.x"
                :y2="svgHeight - margin.bottom"
                stroke="#6366f1"
                stroke-width="1.5"
                stroke-dasharray="4 3"
              />

              <!-- Horizontal Centroid Line (Y = meanY) -->
              <line
                :x1="margin.left"
                :y1="centroidCoord.y"
                :x2="svgWidth - margin.right"
                :y2="centroidCoord.y"
                stroke="#6366f1"
                stroke-width="1.5"
                stroke-dasharray="4 3"
              />

              <!-- Centroid Intersection Node -->
              <circle
                :cx="centroidCoord.x"
                :cy="centroidCoord.y"
                r="5"
                fill="#6366f1"
                stroke="#ffffff"
                stroke-width="2"
              />
              <text
                :x="centroidCoord.x + 8"
                :y="centroidCoord.y - 8"
                font-family="monospace"
                font-size="9.5"
                font-weight="bold"
                fill="#6366f1"
              >
                (X̄={{ stats.meanX.toFixed(1) }}, Ȳ={{ stats.meanY.toFixed(1) }})
              </text>
            </g>

            <!-- Residual Vertical Stems (e_i = y_i - y_hat) -->
            <g v-if="showResiduals">
              <line
                v-for="p in points"
                :key="'res-' + p.id"
                :x1="scaleX(p.x)"
                :y1="scaleY(p.y)"
                :x2="scaleX(p.x)"
                :y2="scaleY(stats.slope * p.x + stats.intercept)"
                stroke="#f59e0b"
                stroke-width="1.2"
                stroke-dasharray="2 2"
                opacity="0.85"
              />
            </g>

            <!-- OLS Best-Fit Regression Line -->
            <line
              :x1="olsLineCoords.x1"
              :y1="olsLineCoords.y1"
              :x2="olsLineCoords.x2"
              :y2="olsLineCoords.y2"
              stroke="#2563eb"
              stroke-width="2.5"
              stroke-linecap="round"
            />

            <!-- Scatter Points -->
            <g
              v-for="p in points"
              :key="'pt-' + p.id"
              class="cursor-pointer transition-all duration-150"
              @mouseenter="
                hoveredPoint = {
                  id: p.id,
                  x: p.x,
                  y: p.y,
                  dx: p.x - stats.meanX,
                  dy: p.y - stats.meanY,
                  prod: (p.x - stats.meanX) * (p.y - stats.meanY),
                  isOutlier: p.isOutlier
                }
              "
              @mouseleave="hoveredPoint = null"
            >
              <!-- Normal Point (colored by cross-product concordance) -->
              <template v-if="!p.isOutlier">
                <circle
                  :cx="scaleX(p.x)"
                  :cy="scaleY(p.y)"
                  :r="hoveredPoint?.id === p.id ? 6.5 : 4.5"
                  :fill="
                    (p.x - stats.meanX) * (p.y - stats.meanY) >= 0
                      ? '#10b981'
                      : '#f43f5e'
                  "
                  fill-opacity="0.85"
                  stroke="#ffffff"
                  stroke-width="1.5"
                />
              </template>

              <!-- High-Leverage Outlier (Glow Ring & Rose Core) -->
              <template v-else>
                <!-- Pulsing outer ring -->
                <circle
                  :cx="scaleX(p.x)"
                  :cy="scaleY(p.y)"
                  r="12"
                  fill="none"
                  stroke="#f43f5e"
                  stroke-width="2"
                  stroke-dasharray="3 3"
                  class="animate-spin"
                  style="animation-duration: 4s;"
                />
                <circle
                  :cx="scaleX(p.x)"
                  :cy="scaleY(p.y)"
                  r="7"
                  fill="#f43f5e"
                  stroke="#ffffff"
                  stroke-width="2"
                />
                <!-- Label -->
                <text
                  :x="scaleX(p.x) - 10"
                  :y="scaleY(p.y) - 12"
                  text-anchor="end"
                  font-family="monospace"
                  font-size="9.5"
                  font-weight="bold"
                  fill="#f43f5e"
                >
                  ⚠ High Leverage Outlier ({{ p.x }}, {{ p.y }})
                </text>
              </template>
            </g>

            <!-- Hover Data Callout -->
            <g v-if="hoveredPoint">
              <rect
                :x="Math.min(scaleX(hoveredPoint.x) + 10, svgWidth - margin.right - 140)"
                :y="Math.max(scaleY(hoveredPoint.y) - 45, margin.top + 5)"
                width="135"
                height="40"
                rx="6"
                fill="rgba(15, 23, 42, 0.92)"
                stroke="#64748b"
                stroke-width="1"
              />
              <text
                :x="Math.min(scaleX(hoveredPoint.x) + 18, svgWidth - margin.right - 132)"
                :y="Math.max(scaleY(hoveredPoint.y) - 30, margin.top + 20)"
                font-family="monospace"
                font-size="9"
                fill="#ffffff"
              >
                (x={{ hoveredPoint.x.toFixed(1) }}, y={{ hoveredPoint.y.toFixed(1) }})
              </text>
              <text
                :x="Math.min(scaleX(hoveredPoint.x) + 18, svgWidth - margin.right - 132)"
                :y="Math.max(scaleY(hoveredPoint.y) - 16, margin.top + 34)"
                font-family="monospace"
                font-size="8.5"
                :fill="hoveredPoint.prod >= 0 ? '#34d399' : '#f87171'"
              >
                Δx·Δy = {{ hoveredPoint.prod.toFixed(1) }} ({{ hoveredPoint.prod >= 0 ? '+ Concordant' : '- Discordant' }})
              </text>
            </g>
          </svg>
        </div>
      </div>

      <!-- Live Footnote Legend -->
      <div class="mt-1 px-1 flex items-center justify-between text-[11px] font-mono text-muted border-t border-line/40 pt-1.5 flex-wrap gap-2">
        <div class="flex items-center gap-3">
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
            Positive Product (Q₁ / Q₃)
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
            Negative Product (Q₂ / Q₄)
          </span>
          <span class="flex items-center gap-1.5">
            <span class="w-3.5 h-0.5 bg-brand-blue inline-block"></span>
            OLS Line: ŷ = β₁x + β₀
          </span>
        </div>
        <div class="text-[10.5px]">
          Sample Size: <strong>N = {{ points.length }}</strong> observations
        </div>
      </div>
    </main>

    <!-- Mathematical Foundations & Telemetry Panels (Split Columns) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-0.5">
      <!-- 1. Pearson Correlation & OLS Slope Formulas -->
      <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm space-y-2 font-mono text-xs">
        <div class="flex items-center gap-1.5 font-bold text-ink">
          <TrendingUp class="w-3.5 h-3.5 text-brand-blue" />
          Pearson r vs. OLS Regression Slope β₁
        </div>
        <p class="text-[11px] text-muted leading-relaxed">
          Pearson correlation <em>r</em> normalizes covariance by standard deviations, bounding it strictly in [-1, +1].
          The OLS slope $\beta_1$ preserves the physical measurement units of Y per unit of X:
        </p>

        <div class="p-2 rounded bg-card border border-line text-[11px] space-y-1">
          <div class="flex justify-between items-center">
            <span class="text-muted">Pearson r:</span>
            <span class="font-bold text-ink">r = Cov(X,Y) / (σₓ · σᵧ) = {{ stats.r.toFixed(3) }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-muted">OLS Slope β₁:</span>
            <span class="font-bold text-brand-blue">β₁ = Cov(X,Y) / Var(X) = {{ stats.slope.toFixed(3) }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-muted">Coeff. Determination:</span>
            <span class="font-bold text-purple-600 dark:text-purple-400">R² = r² = {{ (stats.r2 * 100).toFixed(1) }}% variance explained</span>
          </div>
        </div>

        <div class="text-[10.5px] text-muted flex items-center gap-1.5 pt-0.5">
          <Info class="w-3.5 h-3.5 text-brand-blue flex-none" />
          <span>Notice that if features are standardized ($σ_x = σ_y = 1$), then $β_1 \equiv r$.</span>
        </div>
      </div>

      <!-- 2. Non-Linear Traps & Outlier Leverage Vulnerability -->
      <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm space-y-2 font-mono text-xs">
        <div class="flex items-center gap-1.5 font-bold text-ink">
          <AlertTriangle class="w-3.5 h-3.5 text-amber-500" />
          Critical Caveats: Leverage & Non-Linearity
        </div>
        <p class="text-[11px] text-muted leading-relaxed">
          Pearson correlation evaluates exclusively <strong>linear</strong> associations and is acutely sensitive to extreme leverage points:
        </p>

        <div class="space-y-1.5 text-[11px]">
          <div class="flex items-start gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 flex-none"></span>
            <span>
              <strong>Zero r ≠ Independence:</strong> A deterministic relationship (like the U-shaped parabola preset) can produce $r \approx 0.0$ because positive and negative quadrant cross-products cancel out.
            </span>
          </div>
          <div class="flex items-start gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 flex-none"></span>
            <span>
              <strong>High Leverage Outliers:</strong> An extreme point far from the centroid exerts massive torque (Cook's distance), swinging the OLS line and destroying correlation. Use <em>Spearman rank correlation</em> for robustness.
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Scikit-Learn & SciPy Code Reference -->
    <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm space-y-1 font-mono text-xs">
      <span class="text-[10px] text-muted uppercase font-bold tracking-wider">
        SciPy &amp; NumPy Production Implementation:
      </span>
      <pre class="text-[11px] text-ink whitespace-pre-wrap bg-card-subtle p-2.5 rounded border border-line/40">import numpy as np
from scipy import stats

# Compute Pearson r and two-tailed p-value
r, p_value = stats.pearsonr(x, y)
print(f"Pearson r: {r:.4f} (p-value: {p_value:.4e})")

# Ordinary Least Squares (OLS) Polynomial Degree 1 Fit
slope, intercept = np.polyfit(x, y, deg=1)
r_squared = r ** 2
print(f"OLS: y_hat = {slope:.3f} * x + {intercept:.3f} | R² = {r_squared*100:.1f}%")

# Robust Alternative: Spearman Rank Correlation (Resilient to non-linear monotonicity and outliers)
rho, spearman_p = stats.spearmanr(x, y)
print(f"Spearman rho: {rho:.4f}")</pre>
    </div>
  </div>
</template>

