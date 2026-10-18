<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Activity,
  Sparkles,
  RotateCcw,
  Info,
  CheckCircle2,
  AlertTriangle,
  Play,
  Layers,
  BarChart2,
  Plus
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Population Types -------------------------------------------------------
type PopulationType = 'uniform' | 'skewed' | 'bimodal'
const selectedPopulation = ref<PopulationType>('bimodal')

// Sample Size N per experiment (N = 2, 5, 15, 30, 50, default 30)
const sampleSize = ref<number>(30)

// Show theoretical normal overlay curve
const showTheoreticalCurve = ref<boolean>(true)

// History of collected sample means
const sampleMeans = ref<number[]>([])

// --- Population Properties --------------------------------------------------
const populationMeta = computed(() => {
  switch (selectedPopulation.value) {
    case 'uniform':
      return {
        name: 'Uniform U(10, 90)',
        mean: 50.0,
        std: 23.09, // 80 / sqrt(12)
        description: 'Flat rectangular probability density: completely non-normal with zero central peak.'
      }
    case 'skewed':
      return {
        name: 'Exponential / Skewed',
        mean: 25.0,
        std: 15.0,
        description: 'Heavily right-skewed distribution: concentrated near 10 with long asymptotic tail.'
      }
    case 'bimodal':
      return {
        name: 'Bimodal (Two Peaks: 28 & 72)',
        mean: 50.0,
        std: 22.8,
        description: 'Two separate clusters at 28 and 72: saddle-shaped valley at the center.'
      }
  }
})

// Box-Muller Gaussian random generator
const randomNormal = (mean = 0, std = 1): number => {
  const u1 = Math.max(1e-7, Math.random())
  const u2 = Math.random()
  const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)
  return mean + z * std
}

// Draw a single observation from the selected parent population
const drawOnePopulationItem = (): number => {
  switch (selectedPopulation.value) {
    case 'uniform':
      return 10 + Math.random() * 80
    case 'skewed': {
      // Exponential distribution offset at 10
      const exp = -15 * Math.log(Math.max(1e-7, 1 - Math.random()))
      return Math.min(95, 10 + exp)
    }
    case 'bimodal': {
      // 50% chance cluster A (28, std 6), 50% cluster B (72, std 6)
      const isA = Math.random() < 0.5
      const center = isA ? 28 : 72
      return Math.max(2, Math.min(98, randomNormal(center, 6)))
    }
  }
}

// Generate one experiment mean: draw N items and average them
const runOneExperiment = (): number => {
  const N = sampleSize.value
  let sum = 0
  for (let i = 0; i < N; i++) {
    sum += drawOnePopulationItem()
  }
  return sum / N
}

// Action: Batch sampling
const drawSamples = (count: number) => {
  const newMeans: number[] = []
  for (let i = 0; i < count; i++) {
    newMeans.push(runOneExperiment())
  }
  sampleMeans.value.push(...newMeans)
  emitInspection()
}

// Action: Reset samples and pre-seed with 120 initial resting samples
const resetSamples = () => {
  sampleMeans.value = []
  drawSamples(120)
}

// Switch population preset
const setPopulation = (pop: PopulationType) => {
  selectedPopulation.value = pop
  resetSamples()
}

// --- Statistical Computeds --------------------------------------------------
const experimentCount = computed(() => sampleMeans.value.length)

// Theoretical Standard Error SE = σ_pop / sqrt(N)
const theoreticalSE = computed(() => {
  return populationMeta.value.std / Math.sqrt(sampleSize.value)
})

// Empirical Mean and Standard Error of collected sample means
const empiricalStats = computed(() => {
  const arr = sampleMeans.value
  const K = arr.length
  if (K === 0) {
    return { mean: populationMeta.value.mean, std: theoreticalSE.value }
  }
  const mean = arr.reduce((a, b) => a + b, 0) / K
  const variance = arr.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (K > 1 ? K - 1 : 1)
  return {
    mean: Number(mean.toFixed(2)),
    std: Number(Math.sqrt(variance).toFixed(2))
  }
})

// Educational Assessment based on N
const cltAssessment = computed(() => {
  const n = sampleSize.value
  if (n < 5) {
    return {
      status: 'Pre-Asymptotic (High Skew Leakage)',
      badgeClass: 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30',
      description: `At N=${n}, sample means still retain noticeable features of the parent shape (skew/modes). Not yet Gaussian.`
    }
  } else if (n < 30) {
    return {
      status: 'Intermediate Convergence',
      badgeClass: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
      description: `At N=${n}, extreme parent shapes begin smoothing out into unimodal symmetry, but tails may still show slight kurtosis.`
    }
  } else {
    return {
      status: 'CLT Satisfied (Robust Gaussian Convergence)',
      badgeClass: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      description: `At N=${n} (≥30 standard rule of thumb), sample means have converged into a clean, symmetric normal distribution regardless of parent shape.`
    }
  }
})

// --- SVG Coordinate Geometry ------------------------------------------------
const svgWidth = 800
const svgHeight = 500
const margin = { top: 30, right: 40, bottom: 65, left: 60 }
const plotWidth = svgWidth - margin.left - margin.right

// Domain is [0, 100]
const xMin = 0
const xMax = 100
const xRange = xMax - xMin

const xScale = (val: number): number => {
  return margin.left + ((val - xMin) / xRange) * plotWidth
}

// Top Zone: Parent Population Preview (y: 35 to 135, height 100)
const topZone = { top: 35, height: 95 }

// Top Population Curve preview (sampled at 80 points)
const topPopulationCurvePath = computed(() => {
  const pts: { x: number; y: number }[] = []
  const steps = 80
  const pop = selectedPopulation.value

  for (let i = 0; i <= steps; i++) {
    const x = xMin + (i / steps) * xRange
    let dens = 0
    if (pop === 'uniform') {
      dens = (x >= 10 && x <= 90) ? 0.7 : 0.05
    } else if (pop === 'skewed') {
      const u = (x - 10) / 15
      dens = x >= 10 ? Math.exp(-u) : 0.05
    } else {
      // Bimodal: two Gaussian peaks at 28 and 72
      const g1 = Math.exp(-0.5 * Math.pow((x - 28) / 7, 2))
      const g2 = Math.exp(-0.5 * Math.pow((x - 72) / 7, 2))
      dens = 0.5 * g1 + 0.5 * g2 + 0.04
    }

    // Scale to top zone height
    const sy = (topZone.top + topZone.height) - dens * (topZone.height - 18)
    pts.push({ x: xScale(x), y: sy })
  }

  let d = `M ${pts[0].x.toFixed(1)} ${(topZone.top + topZone.height)}`
  for (const p of pts) {
    d += ` L ${p.x.toFixed(1)} ${p.y.toFixed(1)}`
  }
  d += ` L ${pts[pts.length - 1].x.toFixed(1)} ${(topZone.top + topZone.height)} Z`
  return d
})

// Bottom Zone: Sampling Distribution Histogram (y: 175 to 435, height 260)
const bottomZone = { top: 175, height: 260, baseline: 435 }

// Histogram computation: 30 bins across [0, 100]
const NUM_BINS = 30
const binWidth = xRange / NUM_BINS

interface HistBar {
  index: number
  x0: number
  x1: number
  count: number
  density: number
  x: number
  width: number
  y: number
  height: number
}

const histogramBars = computed<HistBar[]>(() => {
  const arr = sampleMeans.value
  const K = arr.length
  const bins: number[] = new Array(NUM_BINS).fill(0)

  for (const val of arr) {
    const idx = Math.min(NUM_BINS - 1, Math.max(0, Math.floor((val - xMin) / binWidth)))
    bins[idx]++
  }

  const maxCount = Math.max(1, ...bins)
  const bars: HistBar[] = []

  for (let i = 0; i < NUM_BINS; i++) {
    const x0 = xMin + i * binWidth
    const count = bins[i]
    const barHeight = K === 0 ? 0 : (count / maxCount) * (bottomZone.height - 25)
    bars.push({
      index: i,
      x0,
      x1: x0 + binWidth,
      count,
      density: K === 0 ? 0 : count / (K * binWidth),
      x: xScale(x0),
      width: (binWidth / xRange) * plotWidth - 1,
      y: bottomZone.baseline - barHeight,
      height: barHeight
    })
  }

  return bars
})

// Theoretical Normal Gaussian Bell Overlay
const SQRT_2PI = Math.sqrt(2 * Math.PI)
const theoreticalCurvePath = computed(() => {
  if (!showTheoreticalCurve.value) return ''
  const mu = populationMeta.value.mean
  const se = theoreticalSE.value
  const steps = 120
  const step = xRange / (steps - 1)
  const pts: { sx: number; sy: number }[] = []

  // Max peak height of normal curve
  const peakNorm = 1 / (se * SQRT_2PI)

  for (let i = 0; i < steps; i++) {
    const x = xMin + i * step
    const z = (x - mu) / se
    const pdf = (1 / (se * SQRT_2PI)) * Math.exp(-0.5 * z * z)
    // Scale curve height to bottomZone
    const normalizedHeight = (pdf / peakNorm) * (bottomZone.height - 30)
    pts.push({
      sx: xScale(x),
      sy: bottomZone.baseline - normalizedHeight
    })
  }

  return pts.reduce((acc, p, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`, '')
})

// Telemetry Inspection emit
const emitInspection = () => {
  emit('inspect', {
    title: `Central Limit Theorem: ${populationMeta.value.name}`,
    details: {
      'Parent Population': populationMeta.value.name,
      'Parent Mean (μ_pop)': populationMeta.value.mean.toFixed(1),
      'Parent Std Dev (σ_pop)': populationMeta.value.std.toFixed(1),
      'Sample Size (N)': `${sampleSize.value} observations / mean`,
      'Total Experiments (K)': `${experimentCount.value} sample means`,
      'Theoretical SE (σ / √N)': `${theoreticalSE.value.toFixed(2)}`,
      'Empirical SE of Means': `${empiricalStats.value.std.toFixed(2)}`,
      'Mean of Sample Means (X̄)': `${empiricalStats.value.mean.toFixed(2)}`,
      'CLT Status': cltAssessment.value.status
    }
  })
}

onMounted(() => {
  resetSamples()
})
</script>

<template>
  <div class="w-full flex flex-col gap-2 p-2 sm:p-3 pb-12 max-h-[calc(100vh-185px)] overflow-y-auto pr-1">
    <!-- Top Controls Header -->
    <header class="flex-none mb-1.5 space-y-1.5">
      <!-- Population Presets & Sample Action Buttons -->
      <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
        <!-- Population Shape Switcher -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-muted">Parent Population:</span>
          <button
            type="button"
            @click="setPopulation('uniform')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="selectedPopulation === 'uniform' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Uniform U(10, 90)
          </button>
          <button
            type="button"
            @click="setPopulation('skewed')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="selectedPopulation === 'skewed' ? 'bg-amber-600 text-white font-bold border-amber-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Skewed Exponential
          </button>
          <button
            type="button"
            @click="setPopulation('bimodal')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="selectedPopulation === 'bimodal' ? 'bg-purple-600 text-white font-bold border-purple-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Bimodal (Modes: 28 &amp; 72)
          </button>
        </div>

        <!-- Sampling Trigger Buttons -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            @click="drawSamples(1)"
            class="flex items-center gap-1 px-2.5 py-1 rounded-md bg-card hover:bg-card-subtle text-ink border border-line text-[11px] font-semibold transition-all shadow-2xs cursor-pointer"
          >
            <Plus class="w-3.5 h-3.5 text-brand-blue" />
            +1 Sample
          </button>
          <button
            type="button"
            @click="drawSamples(50)"
            class="flex items-center gap-1 px-2.5 py-1 rounded-md bg-brand-blue text-white text-[11px] font-bold transition-all shadow-2xs cursor-pointer hover:bg-brand-blue-hover"
          >
            <Sparkles class="w-3.5 h-3.5" />
            +50 Samples
          </button>
          <button
            type="button"
            @click="drawSamples(500)"
            class="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 text-white text-[11px] font-bold transition-all shadow-2xs cursor-pointer hover:bg-emerald-700"
          >
            <Play class="w-3.5 h-3.5" />
            +500 Samples
          </button>
          <button
            type="button"
            @click="resetSamples"
            class="p-1 rounded-md border border-line bg-card text-muted hover:text-ink hover:bg-card-subtle transition-all cursor-pointer"
            title="Reset to 120 samples"
          >
            <RotateCcw class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <!-- Sample Size N Slider Card & Overlay Checkbox -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm font-mono text-xs">
        <!-- Sample Size N Slider -->
        <div class="space-y-1">
          <div class="flex items-center justify-between">
            <span class="font-bold text-ink flex items-center gap-1.5">
              <BarChart2 class="w-3.5 h-3.5 text-brand-blue" />
              Sample Size per Experiment: <span class="text-brand-blue font-bold">N = {{ sampleSize }}</span>
            </span>
            <span class="text-[10px] text-muted">Theoretical SE: {{ theoreticalSE.toFixed(2) }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[9.5px] text-muted">2</span>
            <input
              v-model.number="sampleSize"
              type="range"
              min="2"
              max="50"
              step="1"
              @input="emitInspection"
              class="flex-1 accent-brand-blue cursor-pointer h-1.5 bg-line rounded-lg"
            />
            <span class="text-[9.5px] text-muted">50</span>
          </div>
        </div>

        <!-- Normal Overlay & Experiments Counter -->
        <div class="flex items-center justify-between gap-2">
          <label class="flex items-center gap-1.5 cursor-pointer text-[11px]">
            <input v-model="showTheoreticalCurve" type="checkbox" class="accent-emerald-500" />
            <span :class="showTheoreticalCurve ? 'text-ink font-semibold' : 'text-muted'">
              Overlay Theoretical Gaussian N(μ, SE²)
            </span>
          </label>
          <div class="flex items-center gap-1.5 text-[10.5px]">
            <span class="text-muted">Experiments:</span>
            <span class="font-bold px-1.5 py-0.5 rounded bg-card text-ink border border-line">
              K = {{ experimentCount }}
            </span>
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
          Convergence of Sample Means: Parent Shape → Gaussian Limit
        </span>
        <div class="flex items-center gap-2 text-[10.5px]">
          <span class="text-muted">SE Match:</span>
          <span class="font-bold px-1.5 py-0.5 rounded bg-card text-ink border border-line">
            Empirical s = {{ empiricalStats.std }} vs Theoretical = {{ theoreticalSE.toFixed(2) }}
          </span>
        </div>
      </div>

      <!-- Chart Container: Fully visible, responsive, zero clipping -->
      <div class="w-full flex items-center justify-center py-1 px-1 sm:px-2">
        <div class="w-full max-w-3xl aspect-[16/10] max-h-[220px] sm:max-h-[240px] md:max-h-[260px] relative flex items-center justify-center">
          <svg
            viewBox="0 0 800 500"
            preserveAspectRatio="xMidYMid meet"
            class="w-full h-full block"
          >
            <!-- 1. TOP ZONE: Parent Population Distribution -->
            <!-- Zone Label -->
            <text
              :x="margin.left"
              :y="topZone.top - 10"
              font-family="monospace"
              font-size="10"
              font-weight="bold"
              fill="currentColor"
              class="text-muted"
            >
              1. Parent Population Distribution [{{ populationMeta.name }}] (μ={{ populationMeta.mean }}, σ={{ populationMeta.std }})
            </text>

            <!-- Parent Population Curve Fill -->
            <path
              :d="topPopulationCurvePath"
              fill="rgba(148, 163, 184, 0.22)"
              stroke="#64748b"
              stroke-width="1.6"
            />

            <!-- Population Mean Line (Top Zone) -->
            <line
              :x1="xScale(populationMeta.mean)"
              :y1="topZone.top"
              :x2="xScale(populationMeta.mean)"
              :y2="topZone.top + topZone.height"
              stroke="#64748b"
              stroke-width="1.5"
              stroke-dasharray="3 2"
            />

            <!-- Top Zone Baseline -->
            <line
              :x1="margin.left"
              :y1="topZone.top + topZone.height"
              :x2="svgWidth - margin.right"
              :y2="topZone.top + topZone.height"
              stroke="currentColor"
              stroke-width="1"
              class="text-line"
            />

            <!-- DIVIDER / FLOW ARROW -->
            <line
              :x1="svgWidth / 2"
              :y1="topZone.top + topZone.height + 4"
              :x2="svgWidth / 2"
              :y2="bottomZone.top - 12"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-dasharray="2 2"
              class="text-brand-blue"
            />
            <text
              :x="svgWidth / 2"
              :y="bottomZone.top - 8"
              text-anchor="middle"
              font-family="monospace"
              font-size="9.5"
              font-weight="bold"
              fill="#2563eb"
            >
              ▼ Draw N={{ sampleSize }} samples &amp; calculate mean X̄
            </text>

            <!-- 2. BOTTOM ZONE: Sampling Distribution Histogram of X̄ -->
            <!-- Zone Label -->
            <text
              :x="margin.left"
              :y="bottomZone.top - 8"
              font-family="monospace"
              font-size="10"
              font-weight="bold"
              fill="currentColor"
              class="text-muted"
            >
              2. Sampling Distribution of Sample Means X̄ (K={{ experimentCount }} experiments)
            </text>

            <!-- Bottom Baseline (X-Axis) -->
            <line
              :x1="margin.left"
              :y1="bottomZone.baseline"
              :x2="svgWidth - margin.right"
              :y2="bottomZone.baseline"
              stroke="currentColor"
              stroke-width="1.5"
              class="text-line"
            />

            <!-- X-Axis Increments (0 to 100 in steps of 20) -->
            <g v-for="tick in [0, 20, 40, 60, 80, 100]" :key="tick">
              <line
                :x1="xScale(tick)"
                :y1="bottomZone.baseline"
                :x2="xScale(tick)"
                :y2="bottomZone.baseline + 6"
                stroke="currentColor"
                stroke-width="1.5"
                class="text-line"
              />
              <text
                :x="xScale(tick)"
                :y="bottomZone.baseline + 20"
                text-anchor="middle"
                font-family="monospace"
                font-size="10"
                fill="currentColor"
                class="text-muted font-bold"
              >
                {{ tick }}
              </text>
            </g>

            <text
              :x="svgWidth / 2"
              :y="svgHeight - 12"
              text-anchor="middle"
              font-family="monospace"
              font-size="11"
              fill="currentColor"
              class="text-muted font-bold"
            >
              Sample Mean Value (X̄)
            </text>

            <!-- Histogram Bars of Sample Means -->
            <g v-for="bar in histogramBars" :key="bar.index">
              <rect
                v-if="bar.height > 0"
                :x="bar.x"
                :y="bar.y"
                :width="Math.max(1, bar.width)"
                :height="bar.height"
                fill="rgba(59, 130, 246, 0.45)"
                stroke="#3b82f6"
                stroke-width="1"
                class="transition-all duration-150"
              />
            </g>

            <!-- Theoretical Gaussian Overlay -->
            <path
              v-if="showTheoreticalCurve && theoreticalCurvePath"
              :d="theoreticalCurvePath"
              fill="none"
              stroke="#10b981"
              stroke-width="2.6"
              stroke-linejoin="round"
              stroke-linecap="round"
            />

            <!-- Center Mean of Means (Empirical X̄) -->
            <line
              :x1="xScale(empiricalStats.mean)"
              :y1="bottomZone.top + 10"
              :x2="xScale(empiricalStats.mean)"
              :y2="bottomZone.baseline"
              stroke="#2563eb"
              stroke-width="2"
              stroke-dasharray="3 2"
            />
            <circle
              :cx="xScale(empiricalStats.mean)"
              :cy="bottomZone.top + 12"
              r="4"
              fill="#2563eb"
            />
            <text
              :x="xScale(empiricalStats.mean)"
              :y="bottomZone.top + 5"
              text-anchor="middle"
              font-family="monospace"
              font-size="9.5"
              font-weight="bold"
              fill="#1d4ed8"
            >
              X̄ = {{ empiricalStats.mean }}
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
            Central Limit Theorem Status:
          </span>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold border" :class="cltAssessment.badgeClass">
            {{ cltAssessment.status }}
          </span>
        </div>

        <p class="text-muted text-[11px] leading-relaxed">
          {{ cltAssessment.description }} Theoretical Standard Error SE = σ_pop / √N = {{ theoreticalSE.toFixed(2) }}. Notice that regardless of the initial parent shape, the distribution of sample means converges into a Gaussian bell.
        </p>

        <!-- Python Formulation Snippet -->
        <div class="pt-1.5 border-t border-line/40">
          <div class="flex items-center justify-between text-[10px] text-muted font-bold tracking-wider uppercase mb-1">
            <span>NumPy &amp; SciPy CLT Formulation:</span>
            <span class="text-brand-blue font-mono font-semibold lowercase">numpy.mean &amp; scipy.stats</span>
          </div>
          <pre class="text-[11px] font-mono text-ink overflow-x-auto whitespace-pre bg-card-subtle p-2 rounded border border-line/40 leading-relaxed"># Draw K={{ experimentCount }} experiments of size N={{ sampleSize }}
sample_means = [np.mean(np.random.choice(pop, size={{ sampleSize }})) for _ in range({{ experimentCount }})]
theoretical_se = pop_std / np.sqrt({{ sampleSize }})  # SE = {{ theoreticalSE.toFixed(2) }}
empirical_se   = np.std(sample_means)          # s = {{ empiricalStats.std }}</pre>
        </div>
      </div>
    </footer>
  </div>
</template>

