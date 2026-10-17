<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Sliders,
  Sparkles,
  RotateCcw,
  Layers,
  Activity,
  Info,
  CheckCircle2,
  AlertCircle,
  Eye,
  BarChart2
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Pre-seeded Bimodal Sample (N = 40) -------------------------------------
// Cluster A centered at ~25, Cluster B centered at ~65
const samplePoints = [
  18, 20, 21, 22, 23, 23, 24, 25, 25, 25, 26, 26, 27, 28, 29, 30, 31, 32, 34, 36,
  54, 56, 58, 60, 61, 62, 63, 64, 65, 65, 66, 66, 67, 68, 69, 70, 72, 74, 76, 78
]
const N = samplePoints.length // 40

// --- Interactive Parameters ------------------------------------------------
const binCount = ref<number>(12) // k = 3 to 30
const bandwidth = ref<number>(5.5) // h = 1.0 to 15.0
const showKernels = ref<boolean>(false)
const showHistogram = ref<boolean>(true)
const showKde = ref<boolean>(true)
const hoveredPoint = ref<number | null>(null)

// --- SVG ViewBox Geometry --------------------------------------------------
const svgWidth = 800
const svgHeight = 480
const margin = { top: 35, right: 40, bottom: 90, left: 65 }
const plotWidth = svgWidth - margin.left - margin.right
const plotHeight = svgHeight - margin.top - margin.bottom

// X-domain is [0, 100]
const xMin = 0
const xMax = 100
const xRange = xMax - xMin

const xScale = (val: number) => {
  return margin.left + ((val - xMin) / xRange) * plotWidth
}

// Bin Width
const binWidthVal = computed(() => {
  return Number((xRange / binCount.value).toFixed(2))
})

// Histogram Bins Computation
interface HistBin {
  index: number
  x0: number
  x1: number
  count: number
  density: number
}

const histogramData = computed<HistBin[]>(() => {
  const k = binCount.value
  const delta = xRange / k
  const bins: HistBin[] = []

  for (let i = 0; i < k; i++) {
    const x0 = i * delta
    const x1 = (i + 1) * delta
    // Include right edge for last bin
    const inBin = samplePoints.filter(p => (i === k - 1 ? (p >= x0 && p <= x1) : (p >= x0 && p < x1)))
    const count = inBin.length
    // Normalized probability density: count / (N * delta)
    const density = count / (N * delta)

    bins.push({
      index: i,
      x0,
      x1,
      count,
      density
    })
  }

  return bins
})

// Gaussian Kernel function K(u) = (1 / sqrt(2π)) * exp(-0.5 * u^2)
const SQRT_2PI = Math.sqrt(2 * Math.PI)
const gaussianKernel = (u: number) => {
  return Math.exp(-0.5 * u * u) / SQRT_2PI
}

// KDE Continuous Curve (Evaluated at 160 evenly spaced points across [0, 100])
const NUM_KDE_POINTS = 160
const kdePoints = computed(() => {
  const h = bandwidth.value
  const step = xRange / (NUM_KDE_POINTS - 1)
  const points: { x: number; density: number }[] = []

  for (let i = 0; i < NUM_KDE_POINTS; i++) {
    const x = xMin + i * step
    let sumK = 0
    for (let j = 0; j < N; j++) {
      const u = (x - samplePoints[j]) / h
      sumK += gaussianKernel(u)
    }
    const density = sumK / (N * h)
    points.push({ x, density })
  }

  return points
})

// Calculate dynamic maximum density for vertical scale
const maxDensity = computed(() => {
  const maxHistDensity = Math.max(...histogramData.value.map(b => b.density), 0.02)
  const maxKdeDensity = Math.max(...kdePoints.value.map(p => p.density), 0.02)
  const peak = Math.max(maxHistDensity, maxKdeDensity)
  // Add 15% headroom
  return peak * 1.18
})

const yScale = (density: number) => {
  const clamped = Math.max(0, Math.min(maxDensity.value, density))
  return margin.top + plotHeight - (clamped / maxDensity.value) * plotHeight
}

// SVG Path for KDE curve
const kdePathD = computed(() => {
  const pts = kdePoints.value
  if (pts.length === 0) return ''

  let d = `M ${xScale(pts[0].x).toFixed(1)} ${yScale(pts[0].density).toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${xScale(pts[i].x).toFixed(1)} ${yScale(pts[i].density).toFixed(1)}`
  }
  return d
})

// SVG Path for KDE Area fill under curve
const kdeAreaD = computed(() => {
  const pts = kdePoints.value
  if (pts.length === 0) return ''

  const baseY = margin.top + plotHeight
  let d = `M ${xScale(pts[0].x).toFixed(1)} ${baseY}`
  for (let i = 0; i < pts.length; i++) {
    d += ` L ${xScale(pts[i].x).toFixed(1)} ${yScale(pts[i].density).toFixed(1)}`
  }
  d += ` L ${xScale(pts[pts.length - 1].x).toFixed(1)} ${baseY} Z`
  return d
})

// Individual Kernel Component Curves for each point (evaluated over local window [xi - 3h, xi + 3h])
const individualKernels = computed(() => {
  if (!showKernels.value) return []
  const h = bandwidth.value

  return samplePoints.map((xi, idx) => {
    const localMin = Math.max(xMin, xi - 3.2 * h)
    const localMax = Math.min(xMax, xi + 3.2 * h)
    const steps = 30
    const localStep = (localMax - localMin) / steps
    const pts: { x: number; y: number }[] = []

    for (let s = 0; s <= steps; s++) {
      const x = localMin + s * localStep
      const u = (x - xi) / h
      const density = gaussianKernel(u) / (N * h)
      pts.push({ x: xScale(x), y: yScale(density) })
    }

    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
    for (let s = 1; s < pts.length; s++) {
      d += ` L ${pts[s].x.toFixed(1)} ${pts[s].y.toFixed(1)}`
    }

    return {
      id: idx,
      center: xi,
      path: d
    }
  })
})

// Numerical Integration of KDE Area Check: int f_hat(x) dx
const totalIntegratedArea = computed(() => {
  const pts = kdePoints.value
  const dx = xRange / (NUM_KDE_POINTS - 1)
  // Trapezoidal integration
  let area = 0
  for (let i = 0; i < pts.length - 1; i++) {
    area += 0.5 * (pts[i].density + pts[i + 1].density) * dx
  }
  return Number(area.toFixed(3))
})

// Ticks for X and Y axes
const xTicks = [0, 20, 40, 60, 80, 100]

const yTicks = computed(() => {
  const max = maxDensity.value
  const steps = 4
  const ticks: { val: number; y: number; label: string }[] = []
  for (let i = 0; i <= steps; i++) {
    const val = (max / steps) * i
    ticks.push({
      val,
      y: yScale(val),
      label: val.toFixed(3)
    })
  }
  return ticks
})

// Educational assessment of active bandwidth
const bandwidthEvaluation = computed(() => {
  const h = bandwidth.value
  if (h < 2.5) {
    return {
      status: 'High Variance (Undersmoothed)',
      badgeClass: 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30',
      description: 'Curve suffers from high variance: creates spurious artificial spikes reflecting random sampling noise rather than true population density.'
    }
  } else if (h > 9.0) {
    return {
      status: 'High Bias (Oversmoothed)',
      badgeClass: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
      description: 'Curve suffers from high bias: merges the two distinct underlying modes (25 and 65) into an artificial unimodal blob, losing critical structure.'
    }
  } else {
    return {
      status: 'Optimal Smoothing (Balanced Bias-Variance)',
      badgeClass: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
      description: 'Balanced bandwidth cleanly exposes both genuine cluster centers (x ≈ 25 and x ≈ 65) without capturing spurious single-sample noise.'
    }
  }
})

// Preset Bandwidth setters
const setPreset = (preset: 'under' | 'optimal' | 'over') => {
  if (preset === 'under') {
    bandwidth.value = 1.6
    binCount.value = 26
  } else if (preset === 'optimal') {
    bandwidth.value = 5.5
    binCount.value = 12
  } else {
    bandwidth.value = 14.0
    binCount.value = 4
  }
  emitInspection()
}

// Telemetry Inspection emit
const emitInspection = () => {
  emit('inspect', {
    title: 'Probability Density: Histogram vs Gaussian KDE',
    details: {
      'Sample Size (N)': `${N} observations`,
      'Data Clusters': 'Bimodal: Cluster A (~25) + Cluster B (~65)',
      'Histogram Bins (k)': `${binCount.value} bins`,
      'Bin Width (Δx)': `${binWidthVal.value} units`,
      'KDE Bandwidth (h)': `${bandwidth.value.toFixed(1)} (Kernel Std Dev)`,
      'KDE Kernel Type': 'Gaussian (Normal RBF)',
      'Integrated Total Area': `${totalIntegratedArea.value} (Target = 1.000)`,
      'Smoothing State': bandwidthEvaluation.value.status
    }
  })
}

onMounted(() => {
  emitInspection()
})
</script>

<template>
  <div class="w-full flex flex-col gap-3 pb-8">
    <!-- Top Action Toolbar -->
    <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
      <!-- Preset Buttons -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">Bandwidth Preset:</span>
        <button
          type="button"
          @click="setPreset('under')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="bandwidth < 2.5 ? 'bg-rose-600 text-white font-bold border-rose-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          Spiky Undersmoothed (h=1.6)
        </button>
        <button
          type="button"
          @click="setPreset('optimal')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="bandwidth >= 4.0 && bandwidth <= 7.0 ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          Optimal Bimodal (h=5.5)
        </button>
        <button
          type="button"
          @click="setPreset('over')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="bandwidth > 9.0 ? 'bg-amber-600 text-white font-bold border-amber-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          Flat Oversmoothed (h=14.0)
        </button>
      </div>

      <!-- Visibility Toggles -->
      <div class="flex items-center gap-1.5 bg-card px-2.5 py-1 rounded-md border border-line shadow-2xs">
        <label class="flex items-center gap-1.5 cursor-pointer text-[11px]">
          <input v-model="showHistogram" type="checkbox" class="accent-brand-blue" />
          <span :class="showHistogram ? 'text-ink font-semibold' : 'text-muted'">Histogram</span>
        </label>
        <span class="text-line">|</span>
        <label class="flex items-center gap-1.5 cursor-pointer text-[11px]">
          <input v-model="showKde" type="checkbox" class="accent-emerald-500" />
          <span :class="showKde ? 'text-ink font-semibold' : 'text-muted'">KDE Curve</span>
        </label>
        <span class="text-line">|</span>
        <label class="flex items-center gap-1.5 cursor-pointer text-[11px]" title="Show component Gaussian bells beneath each sample">
          <input v-model="showKernels" type="checkbox" class="accent-emerald-500" />
          <span :class="showKernels ? 'text-ink font-semibold' : 'text-muted'">Individual Bells</span>
        </label>
      </div>
    </div>

    <!-- Dual Sliders: Bin Count (k) & KDE Bandwidth (h) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <!-- Histogram Bin Count Slider -->
      <div class="rounded-lg border border-line bg-card p-3 shadow-xs space-y-1.5 font-mono text-xs">
        <div class="flex items-center justify-between">
          <span class="font-bold text-ink flex items-center gap-1.5">
            <BarChart2 class="w-3.5 h-3.5 text-brand-blue" />
            Histogram Bins: <span class="text-brand-blue font-bold">k = {{ binCount }}</span>
          </span>
          <span class="text-muted text-[11px]">Width: Δx = {{ binWidthVal }}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-[10px] text-muted">3</span>
          <input
            v-model.number="binCount"
            type="range"
            min="3"
            max="30"
            step="1"
            @input="emitInspection"
            class="flex-1 accent-brand-blue cursor-pointer h-1.5 bg-line rounded-lg"
          />
          <span class="text-[10px] text-muted">30</span>
        </div>
      </div>

      <!-- KDE Bandwidth Slider -->
      <div class="rounded-lg border border-line bg-card p-3 shadow-xs space-y-1.5 font-mono text-xs">
        <div class="flex items-center justify-between">
          <span class="font-bold text-ink flex items-center gap-1.5">
            <Activity class="w-3.5 h-3.5 text-emerald-600" />
            Gaussian Bandwidth: <span class="text-emerald-600 font-bold">h = {{ bandwidth.toFixed(1) }}</span>
          </span>
          <span class="text-[11px] px-2 py-0.5 rounded border" :class="bandwidthEvaluation.badgeClass">
            {{ bandwidthEvaluation.status.split(' ')[0] }}
          </span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-[10px] text-muted">1.0</span>
          <input
            v-model.number="bandwidth"
            type="range"
            min="1.0"
            max="15.0"
            step="0.2"
            @input="emitInspection"
            class="flex-1 accent-emerald-500 cursor-pointer h-1.5 bg-line rounded-lg"
          />
          <span class="text-[10px] text-muted">15.0</span>
        </div>
      </div>
    </div>

    <!-- Main SVG Probability Density Plane -->
    <div class="rounded-lg border border-line bg-card p-3 shadow-xs space-y-2">
      <div class="flex items-center justify-between text-xs font-mono">
        <span class="font-bold text-ink flex items-center gap-1.5">
          <Activity class="w-3.5 h-3.5 text-brand-blue" />
          Continuous Density Estimation vs. Discrete Bin Partitions
        </span>
        <div class="flex items-center gap-2 text-[11px]">
          <span class="text-muted">Integrated Area:</span>
          <span class="font-bold px-1.5 py-0.5 rounded bg-card-subtle text-ink border border-line">
            ∫ f̂(x) dx ≈ {{ totalIntegratedArea }}
          </span>
        </div>
      </div>

      <!-- Fluid Responsive SVG Viewport -->
      <div class="w-full min-h-[320px] flex items-center justify-center relative bg-card-subtle rounded-md border border-line/60 p-2 pb-4">
        <svg
          :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
          preserveAspectRatio="xMidYMid meet"
          class="w-full h-auto select-none"
        >
          <!-- Background Grid Lines -->
          <g v-for="yt in yTicks" :key="yt.val">
            <line
              :x1="margin.left"
              :y1="yt.y"
              :x2="svgWidth - margin.right"
              :y2="yt.y"
              stroke="currentColor"
              stroke-width="1"
              stroke-dasharray="2 3"
              class="text-line/60"
            />
            <text
              :x="margin.left - 10"
              :y="yt.y + 3.5"
              text-anchor="end"
              font-family="monospace"
              font-size="9.5"
              fill="currentColor"
              class="text-muted"
            >
              {{ yt.label }}
            </text>
          </g>

          <!-- Vertical Axis Line -->
          <line
            :x1="margin.left"
            :y1="margin.top"
            :x2="margin.left"
            :y2="margin.top + plotHeight"
            stroke="currentColor"
            stroke-width="1.5"
            class="text-line"
          />

          <!-- Horizontal Baseline (X-Axis) -->
          <line
            :x1="margin.left"
            :y1="margin.top + plotHeight"
            :x2="svgWidth - margin.right"
            :y2="margin.top + plotHeight"
            stroke="currentColor"
            stroke-width="1.5"
            class="text-line"
          />

          <!-- X-Axis Ticks & Labels -->
          <g v-for="xt in xTicks" :key="xt">
            <line
              :x1="xScale(xt)"
              :y1="margin.top + plotHeight"
              :x2="xScale(xt)"
              :y2="margin.top + plotHeight + 7"
              stroke="currentColor"
              stroke-width="1.5"
              class="text-line"
            />
            <text
              :x="xScale(xt)"
              :y="margin.top + plotHeight + 26"
              text-anchor="middle"
              font-family="monospace"
              font-size="10.5"
              fill="currentColor"
              class="text-muted font-bold"
            >
              {{ xt }}
            </text>
          </g>
          <text
            :x="svgWidth / 2"
            :y="svgHeight - 16"
            text-anchor="middle"
            font-family="monospace"
            font-size="11"
            fill="currentColor"
            class="text-muted font-bold"
          >
            Measurement Value x (Arbitrary Units)
          </text>

          <!-- 1. Histogram Bars Layer -->
          <g v-if="showHistogram">
            <g v-for="bin in histogramData" :key="bin.index">
              <rect
                :x="xScale(bin.x0) + 1"
                :y="yScale(bin.density)"
                :width="Math.max(1, xScale(bin.x1) - xScale(bin.x0) - 2)"
                :height="margin.top + plotHeight - yScale(bin.density)"
                fill="rgba(59, 130, 246, 0.22)"
                stroke="rgba(59, 130, 246, 0.85)"
                stroke-width="1.2"
                rx="2"
                class="transition-all duration-200 hover:fill-blue-500/40"
              />
              <!-- Count annotation on bar top if tall enough -->
              <text
                v-if="bin.count > 0 && (margin.top + plotHeight - yScale(bin.density)) > 14"
                :x="(xScale(bin.x0) + xScale(bin.x1)) / 2"
                :y="yScale(bin.density) - 4"
                text-anchor="middle"
                font-family="monospace"
                font-size="9"
                font-weight="bold"
                fill="currentColor"
                class="text-brand-blue"
              >
                {{ bin.count }}
              </text>
            </g>
          </g>

          <!-- 2. Individual Component Gaussian Curves (Faint dashed bells) -->
          <g v-if="showKernels">
            <path
              v-for="k in individualKernels"
              :key="k.id"
              :d="k.path"
              fill="none"
              stroke="rgba(16, 185, 129, 0.35)"
              stroke-width="1.2"
              stroke-dasharray="3 2"
            />
          </g>

          <!-- 3. Continuous KDE Area Fill -->
          <path
            v-if="showKde"
            :d="kdeAreaD"
            fill="rgba(16, 185, 129, 0.12)"
          />

          <!-- 4. Continuous KDE Spline Stroke -->
          <path
            v-if="showKde"
            :d="kdePathD"
            fill="none"
            stroke="#10b981"
            stroke-width="2.5"
            stroke-linejoin="round"
            stroke-linecap="round"
          />

          <!-- 5. Rug Plot (Individual points along baseline) -->
          <g>
            <g
              v-for="(p, idx) in samplePoints"
              :key="idx"
              @mouseenter="hoveredPoint = p"
              @mouseleave="hoveredPoint = null"
              class="cursor-pointer"
            >
              <line
                :x1="xScale(p)"
                :y1="margin.top + plotHeight"
                :x2="xScale(p)"
                :y2="margin.top + plotHeight + 12"
                stroke="currentColor"
                stroke-width="1.8"
                :class="hoveredPoint === p ? 'text-amber-500 stroke-[2.5]' : 'text-slate-600 dark:text-slate-300'"
              />
            </g>
          </g>

          <!-- Rug Label Annotation -->
          <text
            :x="svgWidth - margin.right"
            :y="margin.top + plotHeight + 42"
            text-anchor="end"
            font-family="monospace"
            font-size="9"
            fill="currentColor"
            class="text-muted/80 font-medium"
          >
            ▲ Rug Plot (N=40 sample ticks)
          </text>
        </svg>
      </div>

      <!-- Telemetry Assessment Card -->
      <div class="rounded-md border border-line bg-card p-3 font-mono text-xs space-y-2">
        <div class="flex items-center justify-between border-b border-line/60 pb-1.5">
          <span class="font-bold text-ink flex items-center gap-1.5">
            <Info class="w-3.5 h-3.5 text-brand-blue" />
            Bandwidth Diagnosis:
          </span>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold border" :class="bandwidthEvaluation.badgeClass">
            {{ bandwidthEvaluation.status }}
          </span>
        </div>
        <p class="text-muted text-[11px] leading-relaxed">
          {{ bandwidthEvaluation.description }}
        </p>

        <!-- Python Code snippet -->
        <div class="pt-1 border-t border-line/40">
          <span class="text-[10px] text-muted uppercase font-bold tracking-wider">Scikit-Learn &amp; SciPy Formulation:</span>
          <pre class="mt-1 text-[11px] text-ink overflow-x-auto whitespace-pre-wrap bg-card-subtle p-2 rounded border border-line/40"># Gaussian Kernel Density Estimation (SciPy / Scikit-Learn)
from sklearn.neighbors import KernelDensity
import numpy as np

X = np.array({{ JSON.stringify(samplePoints.slice(0, 8)) }} + [...])[:, np.newaxis]
kde = KernelDensity(kernel='gaussian', bandwidth={{ bandwidth.toFixed(1) }}).fit(X)
log_density = kde.score_samples(eval_points)
density = np.exp(log_density)  # Strictly continuous, differentiable PDF</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Safe layout: zero hardcoded pixel overflow */
</style>

