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
  Split
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- State ------------------------------------------------------------------
// Probe value in standard normal units: x in [-3.5, +3.5], default 0.0
const probeX = ref<number>(0.0)

// Tail / Range mode: 'left' | 'right' | 'iqr'
type RangeMode = 'left' | 'right' | 'iqr'
const activeRange = ref<RangeMode>('left')

// --- Math Functions (Standard Normal N(0, 1)) -------------------------------
const SQRT_2PI = Math.sqrt(2 * Math.PI)

const stdNormalPdf = (x: number): number => {
  return (1 / SQRT_2PI) * Math.exp(-0.5 * x * x)
}

// Polynomial error function approximation (Abramowitz & Stegun)
const erf = (x: number): number => {
  const sign = x >= 0 ? 1 : -1
  const a1 = 0.254829592
  const a2 = -0.284496736
  const a3 = 1.421413741
  const a4 = -1.453152027
  const a5 = 1.061405429
  const p = 0.3275911

  const absX = Math.abs(x)
  const t = 1.0 / (1.0 + p * absX)
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX)
  return sign * y
}

// Standard normal CDF Φ(x)
const stdNormalCdf = (x: number): number => {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

// Key standard normal quantiles
const Q1_X = -0.6745
const MEDIAN_X = 0.0
const Q3_X = 0.6745

// --- Coordinate Geometry ----------------------------------------------------
// SVG ViewBox: 800 x 420
const svgWidth = 800
const svgHeight = 420
const margin = { top: 18, right: 30, bottom: 35, left: 55 }
const plotWidth = svgWidth - margin.left - margin.right // 715

// Domain: X in [-3.5, +3.5]
const xMin = -3.5
const xMax = 3.5
const xRange = xMax - xMin // 7.0

const xScale = (val: number): number => {
  return margin.left + ((val - xMin) / xRange) * plotWidth
}

// Top Zone: PDF Bell Curve (y: 18 to 180, baseline at 180, height 162)
const topZone = {
  top: 18,
  baseline: 180,
  height: 162,
  maxDensity: 0.42 // f(0) = 0.3989
}

const yPdfScale = (dens: number): number => {
  return topZone.baseline - (dens / topZone.maxDensity) * (topZone.height - 18)
}

// Bottom Zone: CDF S-Curve (y: 220 to 385, baseline at 385, height 165)
const bottomZone = {
  top: 220,
  baseline: 385,
  height: 165
}

const yCdfScale = (prob: number): number => {
  // prob in [0, 1]
  return bottomZone.baseline - prob * (bottomZone.height - 25)
}

// --- Curves & Paths Computeds -----------------------------------------------
const NUM_POINTS = 120

// 1. Full PDF Curve Path
const pdfCurvePath = computed(() => {
  const step = xRange / (NUM_POINTS - 1)
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < NUM_POINTS; i++) {
    const x = xMin + i * step
    pts.push({ x: xScale(x), y: yPdfScale(stdNormalPdf(x)) })
  }
  return pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '')
})

// 2. Shaded Area Under PDF
const pdfShadedAreaPath = computed(() => {
  let startX = xMin
  let endX = probeX.value

  if (activeRange.value === 'right') {
    startX = probeX.value
    endX = xMax
  } else if (activeRange.value === 'iqr') {
    startX = Q1_X
    endX = Q3_X
  }

  const steps = 60
  const step = (endX - startX) / steps
  const pts: { x: number; y: number }[] = []

  for (let i = 0; i <= steps; i++) {
    const x = startX + i * step
    pts.push({ x: xScale(x), y: yPdfScale(stdNormalPdf(x)) })
  }

  let d = `M ${xScale(startX).toFixed(1)} ${topZone.baseline}`
  for (const p of pts) {
    d += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }
  d += ` L ${xScale(endX).toFixed(1)} ${topZone.baseline} Z`
  return d
})

// 3. Full CDF Sigmoid S-Curve Path
const cdfCurvePath = computed(() => {
  const step = xRange / (NUM_POINTS - 1)
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < NUM_POINTS; i++) {
    const x = xMin + i * step
    pts.push({ x: xScale(x), y: yCdfScale(stdNormalCdf(x)) })
  }
  return pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`, '')
})

// --- Live Values & Telemetry ------------------------------------------------
const liveValues = computed(() => {
  const x = Number(probeX.value.toFixed(2))
  const density = stdNormalPdf(x)
  const cdfLeft = stdNormalCdf(x)
  const cdfRight = 1 - cdfLeft
  const iqrProb = stdNormalCdf(Q3_X) - stdNormalCdf(Q1_X) // ~0.50

  let activeProb = cdfLeft
  let label = `P(X ≤ ${x})`
  if (activeRange.value === 'right') {
    activeProb = cdfRight
    label = `P(X > ${x})`
  } else if (activeRange.value === 'iqr') {
    activeProb = iqrProb
    label = `P(-0.67σ ≤ X ≤ 0.67σ)`
  }

  return {
    x,
    density: Number(density.toFixed(4)),
    cdf: Number(cdfLeft.toFixed(4)),
    activeProb: Number(activeProb.toFixed(4)),
    percentile: Number((activeProb * 100).toFixed(1)),
    label
  }
})

// Quantile Snap Action
const snapQuantile = (type: 'q1' | 'median' | 'q3' | 'iqr') => {
  if (type === 'q1') {
    activeRange.value = 'left'
    probeX.value = -0.67
  } else if (type === 'median') {
    activeRange.value = 'left'
    probeX.value = 0.0
  } else if (type === 'q3') {
    activeRange.value = 'left'
    probeX.value = 0.67
  } else {
    activeRange.value = 'iqr'
    probeX.value = 0.0
  }
  emitInspection()
}

// Telemetry Inspection emit
const emitInspection = () => {
  emit('inspect', {
    title: 'Probability Density (PDF) vs Cumulative Distribution (CDF)',
    details: {
      'Active Threshold (x)': `${liveValues.value.x}σ`,
      'PDF Height f(x) [Density]': `${liveValues.value.density}`,
      'CDF Value F(x) [Probability]': `${liveValues.value.cdf}`,
      'Shaded Probability Area': `${liveValues.value.percentile}%`,
      'Active Range Mode': activeRange.value.toUpperCase(),
      'Quantile Status': liveValues.value.x === 0 ? 'Median Q2 (50th percentile)' : `${liveValues.value.percentile}th percentile`,
      'Core Invariant': 'Area under PDF ≡ Height of CDF: F(x) = ∫_{-∞}^x f(t)dt'
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
      <!-- Quantile Snap Buttons & Tail Modes -->
      <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
        <!-- Quantile Snaps -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-muted">Quantile Snaps:</span>
          <button
            type="button"
            @click="snapQuantile('q1')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="probeX === -0.67 && activeRange === 'left' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Q₁ (25%)
          </button>
          <button
            type="button"
            @click="snapQuantile('median')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="probeX === 0 && activeRange === 'left' ? 'bg-purple-600 text-white font-bold border-purple-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Median Q₂ (50%)
          </button>
          <button
            type="button"
            @click="snapQuantile('q3')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="probeX === 0.67 && activeRange === 'left' ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Q₃ (75%)
          </button>
          <button
            type="button"
            @click="snapQuantile('iqr')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="activeRange === 'iqr' ? 'bg-amber-600 text-white font-bold border-amber-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            IQR Band [Q₁, Q₃]
          </button>
        </div>

        <!-- Range / Tail Toggle -->
        <div class="flex items-center gap-1 bg-card px-2 py-1 rounded-md border border-line shadow-2xs">
          <button
            type="button"
            @click="activeRange = 'left'; emitInspection()"
            class="px-1.5 py-0.5 rounded text-[10.5px] transition-colors"
            :class="activeRange === 'left' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold' : 'text-muted hover:text-ink'"
          >
            P(X ≤ x) Left
          </button>
          <button
            type="button"
            @click="activeRange = 'right'; emitInspection()"
            class="px-1.5 py-0.5 rounded text-[10.5px] transition-colors"
            :class="activeRange === 'right' ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold' : 'text-muted hover:text-ink'"
          >
            P(X > x) Right
          </button>
        </div>
      </div>

      <!-- Threshold Probe Slider Card -->
      <div class="p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1 font-mono text-xs">
        <div class="flex items-center justify-between">
          <span class="font-bold text-ink flex items-center gap-1.5">
            <Sliders class="w-3.5 h-3.5 text-brand-blue" />
            Synchronized Threshold Probe:
            <span class="text-brand-blue font-bold">x = {{ liveValues.x }}σ</span>
          </span>
          <div class="flex items-center gap-2 text-[11px]">
            <span class="text-muted">PDF Density:</span>
            <span class="font-bold text-ink">f(x) = {{ liveValues.density }}</span>
            <span class="text-line">|</span>
            <span class="text-muted">CDF Probability:</span>
            <span class="font-bold text-emerald-600">F(x) = {{ liveValues.cdf }}</span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[9.5px] text-muted">-3.5σ</span>
          <input
            v-model.number="probeX"
            type="range"
            min="-3.5"
            max="3.5"
            step="0.05"
            @input="emitInspection"
            class="flex-1 accent-brand-blue cursor-pointer h-1.5 bg-line rounded-lg"
          />
          <span class="text-[9.5px] text-muted">+3.5σ</span>
        </div>
      </div>
    </header>

    <!-- Main Dual-Plane Synchronized Visualization Stage -->
    <main class="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-2 sm:p-3">
      <!-- Title & Live Area Match Ribbon -->
      <div class="w-full flex items-center justify-between text-xs font-mono mb-1 flex-none px-1">
        <span class="font-bold text-ink flex items-center gap-1.5">
          <Activity class="w-3.5 h-3.5 text-brand-blue" />
          Synchronized Dual Planes: PDF Area Under Curve = CDF Curve Height
        </span>
        <div class="flex items-center gap-2 text-[10.5px]">
          <span class="text-muted">Integral Area:</span>
          <span class="font-bold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
            ∫ f(t)dt = {{ liveValues.activeProb }} ({{ liveValues.percentile }}%)
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
            <!-- ======================================================== -->
            <!-- 1. TOP PLANE: PDF (Probability Density Function)           -->
            <!-- ======================================================== -->
            <!-- Top Plane Title & Badge -->
            <text
              :x="margin.left"
              :y="topZone.top + 2"
              font-family="monospace"
              font-size="10"
              font-weight="bold"
              fill="currentColor"
              class="text-muted"
            >
              1. Probability Density Function f(x) — Point P(X=x) ≡ 0, Area = Probability
            </text>

            <!-- Top Baseline -->
            <line
              :x1="margin.left"
              :y1="topZone.baseline"
              :x2="svgWidth - margin.right"
              :y2="topZone.baseline"
              stroke="currentColor"
              stroke-width="1.5"
              class="text-line"
            />

            <!-- Top Y-Axis Line -->
            <line
              :x1="margin.left"
              :y1="topZone.top + 8"
              :x2="margin.left"
              :y2="topZone.baseline"
              stroke="currentColor"
              stroke-width="1.2"
              class="text-line"
            />
            <text
              :x="margin.left - 6"
              :y="yPdfScale(0.40) + 3.5"
              text-anchor="end"
              font-family="monospace"
              font-size="9"
              fill="currentColor"
              class="text-muted"
            >
              0.40
            </text>
            <text
              :x="margin.left - 6"
              :y="yPdfScale(0.20) + 3.5"
              text-anchor="end"
              font-family="monospace"
              font-size="9"
              fill="currentColor"
              class="text-muted"
            >
              0.20
            </text>

            <!-- PDF Shaded Area Fill -->
            <path
              :d="pdfShadedAreaPath"
              fill="rgba(16, 185, 129, 0.28)"
            />

            <!-- PDF Continuous Bell Curve Stroke -->
            <path
              :d="pdfCurvePath"
              fill="none"
              stroke="#10b981"
              stroke-width="2.5"
              stroke-linejoin="round"
              stroke-linecap="round"
            />

            <!-- PDF Vertical Probe Line -->
            <g v-if="activeRange !== 'iqr'">
              <line
                :x1="xScale(probeX)"
                :y1="yPdfScale(liveValues.density)"
                :x2="xScale(probeX)"
                :y2="topZone.baseline"
                stroke="#2563eb"
                stroke-width="2"
                stroke-dasharray="3 2"
              />
              <circle
                :cx="xScale(probeX)"
                :cy="yPdfScale(liveValues.density)"
                r="4.5"
                fill="#2563eb"
                stroke="#ffffff"
                stroke-width="1.5"
              />
            </g>

            <!-- IQR Band Markers on PDF -->
            <g v-if="activeRange === 'iqr'">
              <line
                :x1="xScale(Q1_X)"
                :y1="yPdfScale(stdNormalPdf(Q1_X))"
                :x2="xScale(Q1_X)"
                :y2="topZone.baseline"
                stroke="#f59e0b"
                stroke-width="1.5"
                stroke-dasharray="2 2"
              />
              <line
                :x1="xScale(Q3_X)"
                :y1="yPdfScale(stdNormalPdf(Q3_X))"
                :x2="xScale(Q3_X)"
                :y2="topZone.baseline"
                stroke="#f59e0b"
                stroke-width="1.5"
                stroke-dasharray="2 2"
              />
            </g>

            <!-- PDF Live Area Label inside curve -->
            <text
              :x="activeRange === 'right' ? Math.min(svgWidth - margin.right - 60, xScale(probeX) + 40) : Math.max(margin.left + 50, xScale(probeX) - 40)"
              :y="topZone.baseline - 25"
              text-anchor="middle"
              font-family="monospace"
              font-size="10.5"
              font-weight="bold"
              fill="#059669"
            >
              {{ liveValues.label }} = {{ liveValues.percentile }}%
            </text>

            <!-- ======================================================== -->
            <!-- SYNCHRONIZED VERTICAL PROBE GUIDE THROUGH CORRIDOR       -->
            <!-- ======================================================== -->
            <g v-if="activeRange !== 'iqr'">
              <line
                :x1="xScale(probeX)"
                :y1="topZone.baseline"
                :x2="xScale(probeX)"
                :y2="yCdfScale(liveValues.cdf)"
                stroke="#2563eb"
                stroke-width="1.5"
                stroke-dasharray="2 3"
                class="opacity-75"
              />
            </g>

            <!-- ======================================================== -->
            <!-- 2. BOTTOM PLANE: CDF (Cumulative Distribution Function)    -->
            <!-- ======================================================== -->
            <!-- Bottom Plane Title & Badge -->
            <text
              :x="margin.left"
              :y="bottomZone.top - 8"
              font-family="monospace"
              font-size="10"
              font-weight="bold"
              fill="currentColor"
              class="text-muted"
            >
              2. Cumulative Distribution Function F(x) = P(X ≤ x) — Monotonic S-Curve [0.0 to 1.0]
            </text>

            <!-- Bottom Baseline (Prob = 0.0) -->
            <line
              :x1="margin.left"
              :y1="bottomZone.baseline"
              :x2="svgWidth - margin.right"
              :y2="bottomZone.baseline"
              stroke="currentColor"
              stroke-width="1.5"
              class="text-line"
            />

            <!-- Bottom Y-Axis Line -->
            <line
              :x1="margin.left"
              :y1="yCdfScale(1.0)"
              :x2="margin.left"
              :y2="bottomZone.baseline"
              stroke="currentColor"
              stroke-width="1.2"
              class="text-line"
            />

            <!-- CDF Y-Axis Grid Lines: 0.25 (Q1), 0.50 (Median), 0.75 (Q3), 1.00 -->
            <!-- 1.00 Asymptote -->
            <line
              :x1="margin.left"
              :y1="yCdfScale(1.0)"
              :x2="svgWidth - margin.right"
              :y2="yCdfScale(1.0)"
              stroke="currentColor"
              stroke-width="1"
              stroke-dasharray="2 3"
              class="text-line/40"
            />
            <text
              :x="margin.left - 6"
              :y="yCdfScale(1.0) + 3.5"
              text-anchor="end"
              font-family="monospace"
              font-size="9"
              fill="currentColor"
              class="text-muted"
            >
              1.00
            </text>

            <!-- 0.75 (Q3) -->
            <line
              :x1="margin.left"
              :y1="yCdfScale(0.75)"
              :x2="svgWidth - margin.right"
              :y2="yCdfScale(0.75)"
              stroke="currentColor"
              stroke-width="1"
              stroke-dasharray="2 3"
              class="text-line/40"
            />
            <text
              :x="margin.left - 6"
              :y="yCdfScale(0.75) + 3.5"
              text-anchor="end"
              font-family="monospace"
              font-size="9"
              fill="currentColor"
              class="text-blue-500 font-semibold"
            >
              Q₃ 0.75
            </text>

            <!-- 0.50 (Median) -->
            <line
              :x1="margin.left"
              :y1="yCdfScale(0.50)"
              :x2="svgWidth - margin.right"
              :y2="yCdfScale(0.50)"
              stroke="currentColor"
              stroke-width="1"
              stroke-dasharray="2 3"
              class="text-purple-500/40"
            />
            <text
              :x="margin.left - 6"
              :y="yCdfScale(0.50) + 3.5"
              text-anchor="end"
              font-family="monospace"
              font-size="9"
              fill="currentColor"
              class="text-purple-600 font-bold"
            >
              Q₂ 0.50
            </text>

            <!-- 0.25 (Q1) -->
            <line
              :x1="margin.left"
              :y1="yCdfScale(0.25)"
              :x2="svgWidth - margin.right"
              :y2="yCdfScale(0.25)"
              stroke="currentColor"
              stroke-width="1"
              stroke-dasharray="2 3"
              class="text-line/40"
            />
            <text
              :x="margin.left - 6"
              :y="yCdfScale(0.25) + 3.5"
              text-anchor="end"
              font-family="monospace"
              font-size="9"
              fill="currentColor"
              class="text-blue-500 font-semibold"
            >
              Q₁ 0.25
            </text>

            <!-- 0.00 Base -->
            <text
              :x="margin.left - 6"
              :y="bottomZone.baseline + 3.5"
              text-anchor="end"
              font-family="monospace"
              font-size="9"
              fill="currentColor"
              class="text-muted"
            >
              0.00
            </text>

            <!-- CDF Sigmoid S-Curve Stroke -->
            <path
              :d="cdfCurvePath"
              fill="none"
              stroke="#3b82f6"
              stroke-width="2.6"
              stroke-linejoin="round"
              stroke-linecap="round"
            />

            <!-- CDF Horizontal Probability Projection Guide -->
            <g v-if="activeRange !== 'iqr'">
              <line
                :x1="margin.left"
                :y1="yCdfScale(liveValues.cdf)"
                :x2="xScale(probeX)"
                :y2="yCdfScale(liveValues.cdf)"
                stroke="#2563eb"
                stroke-width="1.8"
                stroke-dasharray="3 2"
              />
              <!-- Probe Point on CDF Curve -->
              <circle
                :cx="xScale(probeX)"
                :cy="yCdfScale(liveValues.cdf)"
                r="5"
                fill="#2563eb"
                stroke="#ffffff"
                stroke-width="2"
                class="shadow-sm"
              />
              <!-- Live Probability Tag at Y-Axis -->
              <rect
                :x="margin.left + 4"
                :y="yCdfScale(liveValues.cdf) - 10"
                width="66"
                height="16"
                rx="3"
                fill="#2563eb"
              />
              <text
                :x="margin.left + 37"
                :y="yCdfScale(liveValues.cdf) + 2"
                text-anchor="middle"
                font-family="monospace"
                font-size="9"
                font-weight="bold"
                fill="#ffffff"
              >
                F(x)={{ liveValues.cdf }}
              </text>
            </g>

            <!-- Shared X-Axis Increments (-3σ to +3σ in steps of 1σ) -->
            <g v-for="tick in [-3, -2, -1, 0, 1, 2, 3]" :key="tick">
              <line
                :x1="xScale(tick)"
                :y1="bottomZone.baseline"
                :x2="xScale(tick)"
                :y2="bottomZone.baseline + 5"
                stroke="currentColor"
                stroke-width="1.5"
                class="text-line"
              />
              <text
                :x="xScale(tick)"
                :y="bottomZone.baseline + 16"
                text-anchor="middle"
                font-family="monospace"
                font-size="9.5"
                fill="currentColor"
                class="text-muted font-bold"
              >
                {{ tick === 0 ? 'μ=0' : `${tick}σ` }}
              </text>
            </g>

            <!-- Bottom Shared Axis Dimension Label -->
            <text
              :x="svgWidth / 2"
              :y="svgHeight - 6"
              text-anchor="middle"
              font-family="monospace"
              font-size="10"
              fill="currentColor"
              class="text-muted font-bold"
            >
              Standardized Dimension (x in units of σ)
            </text>
          </svg>
        </div>
      </div>
    </main>

    <!-- Telemetry Footer -->
    <footer class="flex-none mt-2">
      <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2.5 sm:p-3 shadow-sm font-mono text-xs space-y-1.5">
        <!-- Diagnosis Summary Header -->
        <div class="flex items-center justify-between border-b border-line/60 pb-1.5 flex-wrap gap-2">
          <span class="font-bold text-ink flex items-center gap-1.5">
            <Info class="w-3.5 h-3.5 text-brand-blue" />
            PDF vs CDF Fundamental Theorem:
          </span>
          <div class="flex items-center gap-1.5 text-[10.5px]">
            <span class="px-2 py-0.5 rounded font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              PDF Density f({{ liveValues.x }}) = {{ liveValues.density }}
            </span>
            <span class="px-2 py-0.5 rounded font-bold bg-brand-blue/15 text-brand-blue border border-brand-blue/20">
              CDF Area F({{ liveValues.x }}) = {{ liveValues.cdf }}
            </span>
          </div>
        </div>

        <p class="text-muted text-[11px] leading-relaxed">
          PDF height f(x) is a density rate, NOT a probability (for continuous variables, point probability P(X = x) ≡ 0). Probability only exists across an interval: the cumulative area under the PDF curve from -∞ to x exactly equals the height of the monotonic CDF curve F(x).
        </p>

        <!-- Python Formulation Snippet -->
        <div class="pt-1.5 border-t border-line/40">
          <div class="flex items-center justify-between text-[10px] text-muted font-bold tracking-wider uppercase mb-1">
            <span>SciPy PDF, CDF &amp; PPF Quantiles Formulation:</span>
            <span class="text-brand-blue font-mono font-semibold lowercase">scipy.stats.norm</span>
          </div>
          <pre class="text-[11px] font-mono text-ink overflow-x-auto whitespace-pre bg-card-subtle p-2 rounded border border-line/40 leading-relaxed">from scipy import stats
pdf_val = stats.norm.pdf({{ liveValues.x }})      # Density f(x) = {{ liveValues.density }}
cdf_val = stats.norm.cdf({{ liveValues.x }})      # Cumulative P(X ≤ x) = {{ liveValues.cdf }}
q1_val  = stats.norm.ppf(0.25)        # Inverse CDF (Percent-Point Function) Q1 ≈ -0.674σ</pre>
        </div>
      </div>
    </footer>
  </div>
</template>

