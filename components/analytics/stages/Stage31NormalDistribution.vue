<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Activity,
  Sliders,
  Sparkles,
  RotateCcw,
  Info,
  CheckCircle2,
  Layers,
  Search,
  Compass
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Mathematical State -----------------------------------------------------
// Mean: μ in [-30, +30], default 0
const mean = ref<number>(0)

// Standard Deviation: σ in [8, 30], default 15
const std = ref<number>(15)

// Probe Needle position x_probe in [-50, +50], default 15
const probeX = ref<number>(15)

// Active Shading Zone: '1sigma' | '2sigma' | '3sigma' | 'all' | 'none'
type ShadingMode = '1sigma' | '2sigma' | '3sigma' | 'all' | 'none'
const activeZone = ref<ShadingMode>('all')

// --- SVG ViewBox Geometry ---------------------------------------------------
const svgWidth = 800
const svgHeight = 400
const margin = { top: 18, right: 24, bottom: 44, left: 45 }
const plotWidth = svgWidth - margin.left - margin.right
const plotHeight = svgHeight - margin.top - margin.bottom
const baselineY = svgHeight - margin.bottom // 356

// Fixed Global Display Domain: X in [-70, +70]
const xMin = -70
const xMax = 70
const xRange = xMax - xMin // 140

const xScale = (x: number): number => {
  return margin.left + ((x - xMin) / xRange) * plotWidth
}

// Peak height scaling: min σ is 8 -> max peak density ~ 0.050
// Max density displayed mapped to top (margin.top = 40)
const maxExpectedDensity = 0.052

const yScale = (density: number): number => {
  const clamped = Math.max(0, Math.min(density, maxExpectedDensity))
  return baselineY - (clamped / maxExpectedDensity) * plotHeight
}

// --- Gaussian Math Functions ------------------------------------------------
const SQRT_2PI = Math.sqrt(2 * Math.PI)

const normalPdf = (x: number, mu: number, sigma: number): number => {
  const z = (x - mu) / sigma
  return (1 / (sigma * SQRT_2PI)) * Math.exp(-0.5 * z * z)
}

// Standard Error Function (erf) approximation (Abramowitz & Stegun 7.1.26)
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

// Cumulative standard normal CDF: Φ(z) = 0.5 * (1 + erf(z / sqrt(2)))
const normalCdf = (x: number, mu: number, sigma: number): number => {
  const z = (x - mu) / sigma
  return 0.5 * (1 + erf(z / Math.SQRT2))
}

// --- Dynamic Computeds ------------------------------------------------------
// Peak density at mean f(μ) = 1 / (σ * √(2π))
const peakDensity = computed(() => {
  return 1 / (std.value * SQRT_2PI)
})

// Sample exactly 120 points for continuous curve rendering
const NUM_POINTS = 120
const curvePoints = computed(() => {
  const mu = mean.value
  const s = std.value
  const step = xRange / (NUM_POINTS - 1)
  const pts: { x: number; density: number; sx: number; sy: number }[] = []

  for (let i = 0; i < NUM_POINTS; i++) {
    const x = xMin + i * step
    const density = normalPdf(x, mu, s)
    pts.push({
      x,
      density,
      sx: xScale(x),
      sy: yScale(density)
    })
  }
  return pts
})

// Full curve SVG Path d
const fullCurvePath = computed(() => {
  const pts = curvePoints.value
  if (pts.length === 0) return ''
  return pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`, '')
})

// Helper to build shaded band SVG path between [xStart, xEnd]
const buildBandPath = (xStart: number, xEnd: number): string => {
  const mu = mean.value
  const s = std.value
  const clampedStart = Math.max(xMin, xStart)
  const clampedEnd = Math.min(xMax, xEnd)
  if (clampedStart >= clampedEnd) return ''

  const steps = 40
  const step = (clampedEnd - clampedStart) / steps
  const pts: { sx: number; sy: number }[] = []

  for (let i = 0; i <= steps; i++) {
    const x = clampedStart + i * step
    pts.push({
      sx: xScale(x),
      sy: yScale(normalPdf(x, mu, s))
    })
  }

  let d = `M ${xScale(clampedStart).toFixed(1)} ${baselineY}`
  for (const p of pts) {
    d += ` L ${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`
  }
  d += ` L ${xScale(clampedEnd).toFixed(1)} ${baselineY} Z`
  return d
}

// 1σ Band: [μ - σ, μ + σ] (~68.27%)
const band1Path = computed(() => {
  return buildBandPath(mean.value - std.value, mean.value + std.value)
})

// 2σ Band: [μ - 2σ, μ + 2σ] (~95.45%)
const band2Path = computed(() => {
  return buildBandPath(mean.value - 2 * std.value, mean.value + 2 * std.value)
})

// 3σ Band: [μ - 3σ, μ + 3σ] (~99.73%)
const band3Path = computed(() => {
  return buildBandPath(mean.value - 3 * std.value, mean.value + 3 * std.value)
})

// Z-Score for interactive probe
const zScore = computed(() => {
  return (probeX.value - mean.value) / std.value
})

const probeDensity = computed(() => {
  return normalPdf(probeX.value, mean.value, std.value)
})

const probePercentile = computed(() => {
  return normalCdf(probeX.value, mean.value, std.value)
})

// Ticks for X and Y axes
const xTicks = [-60, -40, -20, 0, 20, 40, 60]
const yTicks = [0.01, 0.02, 0.03, 0.04, 0.05]

// Presets
const setPreset = (type: 'standard' | 'narrow' | 'broad') => {
  if (type === 'standard') {
    mean.value = 0
    std.value = 15
    probeX.value = 15
  } else if (type === 'narrow') {
    mean.value = -10
    std.value = 9
    probeX.value = -1
  } else {
    mean.value = 15
    std.value = 26
    probeX.value = 35
  }
  emitInspection()
}

// Telemetry Inspection emit
const emitInspection = () => {
  emit('inspect', {
    title: `Gaussian Distribution: N(μ=${mean.value}, σ=${std.value})`,
    details: {
      'Mean (Center of Location μ)': `${mean.value}`,
      'Standard Deviation (σ)': `${std.value} units`,
      'Variance (σ²)': `${(std.value * std.value).toFixed(1)}`,
      'Peak Density f(μ)': `${peakDensity.value.toFixed(4)}`,
      'Total Integral Area': '1.000 (Conserved)',
      'Probe Value (x)': `${probeX.value}`,
      'Probe Z-Score': `${zScore.value.toFixed(2)}σ`,
      'Cumulative Percentile P(X ≤ x)': `${(probePercentile.value * 100).toFixed(1)}%`,
      'Active Shading': activeZone.value
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
      <!-- Preset Buttons & Shading Toggles Bar -->
      <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
        <!-- Preset Switcher -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-muted">Preset:</span>
          <button
            type="button"
            @click="setPreset('standard')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="mean === 0 && std === 15 ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Standard N(0, 15)
          </button>
          <button
            type="button"
            @click="setPreset('narrow')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="mean === -10 && std === 9 ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Narrow N(-10, 9)
          </button>
          <button
            type="button"
            @click="setPreset('broad')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="mean === 15 && std === 26 ? 'bg-amber-600 text-white font-bold border-amber-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Broad N(15, 26)
          </button>
        </div>

        <!-- Empirical Zone Selector -->
        <div class="flex items-center gap-1.5 bg-card px-2 py-1 rounded-md border border-line shadow-2xs">
          <span class="text-muted text-[11px]">Empirical Band:</span>
          <button
            type="button"
            @click="activeZone = '1sigma'; emitInspection()"
            class="px-1.5 py-0.5 rounded text-[10.5px] transition-colors"
            :class="activeZone === '1sigma' ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold' : 'text-muted hover:text-ink'"
          >
            ±1σ (68%)
          </button>
          <button
            type="button"
            @click="activeZone = '2sigma'; emitInspection()"
            class="px-1.5 py-0.5 rounded text-[10.5px] transition-colors"
            :class="activeZone === '2sigma' ? 'bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold' : 'text-muted hover:text-ink'"
          >
            ±2σ (95%)
          </button>
          <button
            type="button"
            @click="activeZone = '3sigma'; emitInspection()"
            class="px-1.5 py-0.5 rounded text-[10.5px] transition-colors"
            :class="activeZone === '3sigma' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold' : 'text-muted hover:text-ink'"
          >
            ±3σ (99.7%)
          </button>
          <button
            type="button"
            @click="activeZone = 'all'; emitInspection()"
            class="px-1.5 py-0.5 rounded text-[10.5px] transition-colors"
            :class="activeZone === 'all' ? 'bg-brand-purple/20 text-brand-purple font-bold' : 'text-muted hover:text-ink'"
          >
            All Bands
          </button>
        </div>
      </div>

      <!-- Parameter Sliders Card -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm font-mono text-xs">
        <!-- Mean Slider -->
        <div class="space-y-1">
          <div class="flex items-center justify-between">
            <span class="font-bold text-ink flex items-center gap-1">
              <Compass class="w-3.5 h-3.5 text-brand-blue" />
              Mean: <span class="text-brand-blue font-bold">μ = {{ mean }}</span>
            </span>
            <span class="text-muted text-[10px]">Center</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[9.5px] text-muted">-30</span>
            <input
              v-model.number="mean"
              type="range"
              min="-30"
              max="30"
              step="1"
              @input="emitInspection"
              class="flex-1 accent-brand-blue cursor-pointer h-1.5 bg-line rounded-lg"
            />
            <span class="text-[9.5px] text-muted">+30</span>
          </div>
        </div>

        <!-- Std Dev Slider -->
        <div class="space-y-1">
          <div class="flex items-center justify-between">
            <span class="font-bold text-ink flex items-center gap-1">
              <Activity class="w-3.5 h-3.5 text-emerald-600" />
              Std Dev: <span class="text-emerald-600 font-bold">σ = {{ std }}</span>
            </span>
            <span class="text-muted text-[10px]">f(μ) = {{ peakDensity.toFixed(3) }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[9.5px] text-muted">8</span>
            <input
              v-model.number="std"
              type="range"
              min="8"
              max="30"
              step="1"
              @input="emitInspection"
              class="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-line rounded-lg"
            />
            <span class="text-[9.5px] text-muted">30</span>
          </div>
        </div>

        <!-- Probe Needle Slider -->
        <div class="space-y-1">
          <div class="flex items-center justify-between">
            <span class="font-bold text-ink flex items-center gap-1">
              <Search class="w-3.5 h-3.5 text-amber-500" />
              Z-Probe: <span class="text-amber-600 dark:text-amber-400 font-bold">x = {{ probeX }}</span>
            </span>
            <span class="px-1.5 py-0.2 rounded font-bold text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300">
              Z = {{ zScore.toFixed(2) }}
            </span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[9.5px] text-muted">-50</span>
            <input
              v-model.number="probeX"
              type="range"
              min="-50"
              max="50"
              step="1"
              @input="emitInspection"
              class="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-line rounded-lg"
            />
            <span class="text-[9.5px] text-muted">+50</span>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Visualization Stage -->
    <main class="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-2 sm:p-3">
      <!-- Title & Live Statistics Ribbon -->
      <div class="w-full flex items-center justify-between text-xs font-mono mb-1.5 flex-none px-1">
        <span class="font-bold text-ink flex items-center gap-1.5">
          <Activity class="w-3.5 h-3.5 text-brand-blue" />
          The Gaussian Bell Curve &amp; 68–95–99.7 Empirical Rule
        </span>
        <div class="flex items-center gap-2 text-[11px]">
          <span class="text-muted">Total Probability Area:</span>
          <span class="font-bold px-1.5 py-0.5 rounded bg-card text-ink border border-line">
            ∫ f(x) dx ≡ 1.000
          </span>
        </div>
      </div>

      <!-- Chart Container: Fully visible, responsive, zero clipping -->
      <div class="w-full flex-1 flex items-center justify-center py-1">
        <div class="w-full aspect-[2/1] sm:aspect-[2.2/1] max-h-[300px] sm:max-h-[320px] md:max-h-[340px] relative flex items-center justify-center">
          <svg
            viewBox="0 0 800 400"
            preserveAspectRatio="xMidYMid meet"
            class="w-full h-full block"
          >
            <!-- Background Grid Lines -->
            <g v-for="yt in yTicks" :key="yt">
              <line
                :x1="margin.left"
                :y1="yScale(yt)"
                :x2="svgWidth - margin.right"
                :y2="yScale(yt)"
                stroke="currentColor"
                stroke-width="1"
                stroke-dasharray="2 3"
                class="text-line/60"
              />
              <text
                :x="margin.left - 6"
                :y="yScale(yt) + 3.5"
                text-anchor="end"
                font-family="monospace"
                font-size="9.5"
                fill="currentColor"
                class="text-muted"
              >
                {{ yt.toFixed(2) }}
              </text>
            </g>

            <!-- Vertical Baseline -->
            <line
              :x1="margin.left"
              :y1="margin.top"
              :x2="margin.left"
              :y2="baselineY"
              stroke="currentColor"
              stroke-width="1.5"
              class="text-line"
            />

            <!-- Horizontal Baseline (X-Axis) -->
            <line
              :x1="margin.left"
              :y1="baselineY"
              :x2="svgWidth - margin.right"
              :y2="baselineY"
              stroke="currentColor"
              stroke-width="1.5"
              class="text-line"
            />

            <!-- X-Axis Ticks & Labels -->
            <g v-for="xt in xTicks" :key="xt">
              <line
                :x1="xScale(xt)"
                :y1="baselineY"
                :x2="xScale(xt)"
                :y2="baselineY + 6"
                stroke="currentColor"
                stroke-width="1.5"
                class="text-line"
              />
              <text
                :x="xScale(xt)"
                :y="baselineY + 20"
                text-anchor="middle"
                font-family="monospace"
                font-size="10"
                fill="currentColor"
                class="text-muted font-bold"
              >
                {{ xt }}
              </text>
            </g>

            <text
              :x="svgWidth / 2"
              :y="svgHeight - 8"
              text-anchor="middle"
              font-family="monospace"
              font-size="11"
              fill="currentColor"
              class="text-muted font-bold"
            >
              Continuous Variable Dimension (x)
            </text>

            <!-- 1. Empirical Rule Shaded Bands -->
            <!-- ±3σ Band (Amber 99.73%) -->
            <path
              v-if="activeZone === '3sigma' || activeZone === 'all'"
              :d="band3Path"
              fill="rgba(245, 158, 11, 0.16)"
            />

            <!-- ±2σ Band (Blue 95.45%) -->
            <path
              v-if="activeZone === '2sigma' || activeZone === 'all'"
              :d="band2Path"
              fill="rgba(59, 130, 246, 0.20)"
            />

            <!-- ±1σ Band (Emerald 68.27%) -->
            <path
              v-if="activeZone === '1sigma' || activeZone === 'all'"
              :d="band1Path"
              fill="rgba(16, 185, 129, 0.26)"
            />

            <!-- 2. Gaussian Bell Curve Stroke -->
            <path
              :d="fullCurvePath"
              fill="none"
              stroke="#2563eb"
              stroke-width="2.6"
              stroke-linejoin="round"
              stroke-linecap="round"
            />

            <!-- 3. Empirical Standard Deviation Markers -->
            <!-- ±1σ lines -->
            <g v-if="activeZone === '1sigma' || activeZone === 'all'">
              <line
                :x1="xScale(mean - std)"
                :y1="baselineY"
                :x2="xScale(mean - std)"
                :y2="yScale(normalPdf(mean - std, mean, std))"
                stroke="#10b981"
                stroke-width="1.5"
                stroke-dasharray="3 2"
              />
              <line
                :x1="xScale(mean + std)"
                :y1="baselineY"
                :x2="xScale(mean + std)"
                :y2="yScale(normalPdf(mean + std, mean, std))"
                stroke="#10b981"
                stroke-width="1.5"
                stroke-dasharray="3 2"
              />
              <text
                :x="xScale(mean)"
                :y="yScale(peakDensity) + 38"
                text-anchor="middle"
                font-family="monospace"
                font-size="10.5"
                font-weight="bold"
                fill="#059669"
              >
                68.3% (±1σ)
              </text>
            </g>

            <!-- ±2σ lines -->
            <g v-if="activeZone === '2sigma' || activeZone === 'all'">
              <line
                :x1="xScale(mean - 2 * std)"
                :y1="baselineY"
                :x2="xScale(mean - 2 * std)"
                :y2="yScale(normalPdf(mean - 2 * std, mean, std))"
                stroke="#3b82f6"
                stroke-width="1.3"
                stroke-dasharray="3 2"
              />
              <line
                :x1="xScale(mean + 2 * std)"
                :y1="baselineY"
                :x2="xScale(mean + 2 * std)"
                :y2="yScale(normalPdf(mean + 2 * std, mean, std))"
                stroke="#3b82f6"
                stroke-width="1.3"
                stroke-dasharray="3 2"
              />
            </g>

            <!-- 4. Center Mean Line (μ) -->
            <line
              :x1="xScale(mean)"
              :y1="baselineY"
              :x2="xScale(mean)"
              :y2="yScale(peakDensity)"
              stroke="#2563eb"
              stroke-width="2"
              stroke-dasharray="4 2"
            />
            <circle
              :cx="xScale(mean)"
              :cy="yScale(peakDensity)"
              r="4.5"
              fill="#2563eb"
              stroke="#ffffff"
              stroke-width="1.5"
            />
            <text
              :x="xScale(mean)"
              :y="Math.max(margin.top + 10, yScale(peakDensity) - 8)"
              text-anchor="middle"
              font-family="monospace"
              font-size="10.5"
              font-weight="bold"
              fill="#1d4ed8"
            >
              μ = {{ mean }}
            </text>

            <!-- 5. Interactive Z-Probe Needle -->
            <g>
              <line
                :x1="xScale(probeX)"
                :y1="baselineY"
                :x2="xScale(probeX)"
                :y2="yScale(probeDensity)"
                stroke="#f59e0b"
                stroke-width="2"
                stroke-dasharray="2 2"
              />
              <circle
                :cx="xScale(probeX)"
                :cy="yScale(probeDensity)"
                r="5"
                fill="#f59e0b"
                stroke="#ffffff"
                stroke-width="1.5"
                class="shadow-sm"
              />
              <!-- Probe Label Badge -->
              <rect
                :x="Math.min(svgWidth - margin.right - 85, Math.max(margin.left, xScale(probeX) - 42))"
                :y="Math.max(margin.top, yScale(probeDensity) - 28)"
                width="84"
                height="18"
                rx="4"
                fill="#f59e0b"
              />
              <text
                :x="Math.min(svgWidth - margin.right - 85, Math.max(margin.left, xScale(probeX) - 42)) + 42"
                :y="Math.max(margin.top, yScale(probeDensity) - 28) + 12"
                text-anchor="middle"
                font-family="monospace"
                font-size="9.5"
                font-weight="bold"
                fill="#ffffff"
              >
                Z = {{ zScore.toFixed(2) }}
              </text>
            </g>
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
            Normal Distribution Invariants:
          </span>
          <div class="flex items-center gap-1.5 text-[10.5px]">
            <span class="px-2 py-0.5 rounded font-bold bg-brand-blue/15 text-brand-blue border border-brand-blue/20">
              Peak f(μ) = {{ peakDensity.toFixed(4) }}
            </span>
            <span class="px-2 py-0.5 rounded font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20">
              P(X ≤ {{ probeX }}) = {{ (probePercentile * 100).toFixed(1) }}%
            </span>
          </div>
        </div>

        <p class="text-muted text-[11px] leading-relaxed">
          Standard Deviation σ controls dispersion while integral area is preserved at 1.0. As σ widens the bell curve, peak height drops inversely proportionally: f(μ) = 1/(σ√(2π)). Approximately 68.27% of observations fall within ±1σ, 95.45% within ±2σ, and 99.73% within ±3σ.
        </p>

        <!-- Python Formulation Snippet -->
        <div class="pt-1.5 border-t border-line/40">
          <div class="flex items-center justify-between text-[10px] text-muted font-bold tracking-wider uppercase mb-1">
            <span>SciPy Normal Distribution Formulation:</span>
            <span class="text-brand-blue font-mono font-semibold lowercase">scipy.stats.norm</span>
          </div>
          <pre class="text-[11px] font-mono text-ink overflow-x-auto whitespace-pre bg-card-subtle p-2 rounded border border-line/40 leading-relaxed">from scipy import stats
dist = stats.norm(loc={{ mean }}, scale={{ std }})
z_score = ({{ probeX }} - {{ mean }}) / {{ std }}  # Z = {{ zScore.toFixed(2) }}
percentile = dist.cdf({{ probeX }})  # P(X ≤ {{ probeX }}) = {{ (probePercentile * 100).toFixed(1) }}%</pre>
        </div>
      </div>
    </footer>
  </div>
</template>

