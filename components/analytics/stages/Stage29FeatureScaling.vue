<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Sliders,
  Sparkles,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Activity,
  Layers,
  Info,
  Maximize2
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Data Models -----------------------------------------------------------
interface HouseRecord {
  id: number
  label: string
  rawSqft: number
  isOutlier: boolean
}

// 6 standard residential homes ([1200, 1400, 1600, 1800, 2000, 2200])
const baseHouses = [
  { id: 0, label: 'Cottage A', rawSqft: 1200, isOutlier: false },
  { id: 1, label: 'Suburban B', rawSqft: 1400, isOutlier: false },
  { id: 2, label: 'Townhouse C', rawSqft: 1600, isOutlier: false },
  { id: 3, label: 'Craftsman D', rawSqft: 1800, isOutlier: false },
  { id: 4, label: 'Colonial E', rawSqft: 2000, isOutlier: false },
  { id: 5, label: 'Ranch F', rawSqft: 2200, isOutlier: false }
]

// Outlier value controlled by slider (default 12,000 sq ft mega-mansion, range 2400 to 16000)
const outlierSqft = ref<number>(12000)

// Scaler type
type ScalerType = 'raw' | 'standard' | 'minmax' | 'robust'
const activeScaler = ref<ScalerType>('standard')

// Selected house for detailed inspection
const selectedHouseId = ref<number | null>(null)

// --- Computeds -------------------------------------------------------------
const dataset = computed<HouseRecord[]>(() => {
  return [
    ...baseHouses,
    { id: 6, label: 'Mega Mansion G (Outlier)', rawSqft: outlierSqft.value, isOutlier: true }
  ]
})

// Statistical Parameters
const stats = computed(() => {
  const vals = dataset.value.map(h => h.rawSqft)
  const N = vals.length

  // Mean & Std
  const mean = vals.reduce((a, b) => a + b, 0) / N
  const variance = vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / N
  const std = Math.sqrt(variance)

  // Min & Max
  const min = Math.min(...vals)
  const max = Math.max(...vals)

  // Quantiles (sorted)
  const sorted = [...vals].sort((a, b) => a - b)
  // For N=7: Q1 is idx 1 (1400), Median Q2 is idx 3 (1800), Q3 is idx 5 (2200)
  const q1 = sorted[1]
  const q2 = sorted[3] // Median
  const q3 = sorted[5]
  const iqr = q3 - q1

  return {
    mean: Number(mean.toFixed(1)),
    std: Number(std.toFixed(1)),
    min,
    max,
    q1,
    q2,
    q3,
    iqr
  }
})

// Scaled Values
interface TransformedHouse extends HouseRecord {
  transformedVal: number
  displayVal: string
  deltaFromCenter: string
}

const transformedHouses = computed<TransformedHouse[]>(() => {
  const { mean, std, min, max, q2, iqr } = stats.value

  return dataset.value.map(h => {
    let tVal = h.rawSqft
    let displayStr = `${h.rawSqft.toLocaleString()} sqft`
    let deltaStr = ''

    if (activeScaler.value === 'standard') {
      tVal = (h.rawSqft - mean) / (std || 1)
      displayStr = `${tVal >= 0 ? '+' : ''}${tVal.toFixed(2)} σ`
      deltaStr = `${(h.rawSqft - mean >= 0 ? '+' : '')}${(h.rawSqft - mean).toFixed(0)} from μ`
    } else if (activeScaler.value === 'minmax') {
      tVal = (h.rawSqft - min) / ((max - min) || 1)
      displayStr = tVal.toFixed(3)
      deltaStr = `${(tVal * 100).toFixed(1)}% of range`
    } else if (activeScaler.value === 'robust') {
      tVal = (h.rawSqft - q2) / (iqr || 1)
      displayStr = `${tVal >= 0 ? '+' : ''}${tVal.toFixed(2)} IQR`
      deltaStr = `${(h.rawSqft - q2 >= 0 ? '+' : '')}${(h.rawSqft - q2).toFixed(0)} from Q₂`
    }

    return {
      ...h,
      transformedVal: tVal,
      displayVal: displayStr,
      deltaFromCenter: deltaStr
    }
  })
})

// Normal points span in MinMaxScaler: [min_normal, max_normal]
const minMaxNormalSpan = computed(() => {
  const normalScaled = transformedHouses.value.filter(h => !h.isOutlier).map(h => h.transformedVal)
  const minNorm = Math.min(...normalScaled)
  const maxNorm = Math.max(...normalScaled)
  return {
    min: minNorm.toFixed(3),
    max: maxNorm.toFixed(3),
    spreadPct: ((maxNorm - minNorm) * 100).toFixed(1)
  }
})

// Summary Metrics for Transformed Data
const transformedMetrics = computed(() => {
  const vals = transformedHouses.value.map(h => h.transformedVal)
  const N = vals.length
  const mean = vals.reduce((a, b) => a + b, 0) / N
  const variance = vals.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / N
  const std = Math.sqrt(variance)
  const min = Math.min(...vals)
  const max = Math.max(...vals)

  return {
    mean: Number(mean.toFixed(2)),
    std: Number(std.toFixed(2)),
    min: Number(min.toFixed(2)),
    max: Number(max.toFixed(2))
  }
})

// SVG Axis Mapping
const svgViewBox = { width: 560, height: 160, paddingX: 45, axisY: 85 }

const axisScale = computed(() => {
  let minDomain = 0
  let maxDomain = 100

  if (activeScaler.value === 'raw') {
    minDomain = 0
    maxDomain = Math.max(18000, outlierSqft.value * 1.05)
  } else if (activeScaler.value === 'standard') {
    // Center at 0, display -2.5 to max(3.5, outlierZ + 0.5)
    const outlierZ = (outlierSqft.value - stats.value.mean) / (stats.value.std || 1)
    minDomain = -2.5
    maxDomain = Math.max(3.5, outlierZ + 0.5)
  } else if (activeScaler.value === 'minmax') {
    minDomain = -0.05
    maxDomain = 1.05
  } else if (activeScaler.value === 'robust') {
    const outlierR = (outlierSqft.value - stats.value.q2) / (stats.value.iqr || 1)
    minDomain = -1.5
    maxDomain = Math.max(3.5, Math.min(25, outlierR + 1))
  }

  const rangeWidth = svgViewBox.width - svgViewBox.paddingX * 2

  const toX = (val: number) => {
    const clamped = Math.max(minDomain, Math.min(maxDomain, val))
    return svgViewBox.paddingX + ((clamped - minDomain) / (maxDomain - minDomain)) * rangeWidth
  }

  return {
    minDomain,
    maxDomain,
    toX
  }
})

// Axis Ticks
const axisTicks = computed(() => {
  const { minDomain, maxDomain, toX } = axisScale.value
  const ticks: { val: number; label: string; x: number }[] = []

  if (activeScaler.value === 'raw') {
    const steps = [0, 4000, 8000, 12000, 16000]
    steps.forEach(s => {
      if (s <= maxDomain) {
        ticks.push({ val: s, label: `${s / 1000}k`, x: toX(s) })
      }
    })
  } else if (activeScaler.value === 'standard') {
    const steps = [-2, -1, 0, 1, 2, 3]
    steps.forEach(s => {
      ticks.push({ val: s, label: s === 0 ? 'μ=0' : `${s}σ`, x: toX(s) })
    })
  } else if (activeScaler.value === 'minmax') {
    const steps = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0]
    steps.forEach(s => {
      ticks.push({ val: s, label: s.toFixed(1), x: toX(s) })
    })
  } else if (activeScaler.value === 'robust') {
    const steps = [-1, 0, 1, 2, 3]
    steps.forEach(s => {
      ticks.push({ val: s, label: s === 0 ? 'Q₂=0' : `${s}`, x: toX(s) })
    })
  }

  return ticks
})

// Active Code & Formula
const activeFormulaSnippet = computed(() => {
  if (activeScaler.value === 'standard') {
    return `# StandardScaler: Centers mean at 0, unit variance
from sklearn.preprocessing import StandardScaler
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
# Formula: z = (x - μ) / σ  [μ=${stats.value.mean}, σ=${stats.value.std}]`
  } else if (activeScaler.value === 'minmax') {
    return `# MinMaxScaler: Compresses range into strictly [0, 1]
from sklearn.preprocessing import MinMaxScaler
scaler = MinMaxScaler(feature_range=(0, 1))
X_scaled = scaler.fit_transform(X)
# Formula: x_norm = (x - min) / (max - min)  [min=${stats.value.min}, max=${stats.value.max}]`
  } else if (activeScaler.value === 'robust') {
    return `# RobustScaler: Centers on Median, scales by IQR (Outlier-resilient)
from sklearn.preprocessing import RobustScaler
scaler = RobustScaler()
X_scaled = scaler.fit_transform(X)
# Formula: x_robust = (x - Q2) / (Q3 - Q1)  [Median=${stats.value.q2}, IQR=${stats.value.iqr}]`
  } else {
    return `# Raw Features (Unscaled):
X = df[['sqft']]
# Warning: Models using Euclidean distance (KNN, SVM, K-Means) or Gradient Descent
# will be heavily dominated by high-magnitude features.`
  }
})

// --- Methods ---------------------------------------------------------------
const emitInspection = () => {
  const selected = transformedHouses.value.find(h => h.id === selectedHouseId.value)
  emit('inspect', {
    title: `Feature Scaling: ${activeScaler.value.toUpperCase()}`,
    details: {
      'Active Scaler': activeScaler.value,
      'Outlier Value': `${outlierSqft.value.toLocaleString()} sq ft`,
      'Sample Size': `${dataset.value.length} houses`,
      'Mean (μ)': `${stats.value.mean} sq ft`,
      'Std Dev (σ)': `${stats.value.std} sq ft`,
      'Min / Max': `${stats.value.min} / ${stats.value.max}`,
      'Transformed Mean': `${transformedMetrics.value.mean}`,
      'Transformed Std': `${transformedMetrics.value.std}`,
      'MinMax Normal Span': activeScaler.value === 'minmax' ? `[${minMaxNormalSpan.value.min}, ${minMaxNormalSpan.value.max}] (${minMaxNormalSpan.value.spreadPct}% of [0, 1])` : 'N/A',
      'Selected House': selected ? `${selected.label}: Raw=${selected.rawSqft.toLocaleString()} -> Scaled=${selected.displayVal}` : 'None (Click row to inspect)'
    }
  })
}

const selectHouse = (id: number) => {
  selectedHouseId.value = id
  emitInspection()
}

const setScaler = (s: ScalerType) => {
  activeScaler.value = s
  emitInspection()
}

const resetOutlier = () => {
  outlierSqft.value = 12000
  emitInspection()
}

onMounted(() => {
  emitInspection()
})
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <!-- Top Action Toolbar -->
    <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
      <!-- Scaler Switcher -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">Algorithm:</span>
        <button
          type="button"
          @click="setScaler('raw')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeScaler === 'raw' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          Raw Data
        </button>
        <button
          type="button"
          @click="setScaler('standard')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeScaler === 'standard' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          StandardScaler (z-score)
        </button>
        <button
          type="button"
          @click="setScaler('minmax')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeScaler === 'minmax' ? 'bg-amber-600 text-white font-bold border-amber-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          MinMaxScaler [0, 1]
        </button>
        <button
          type="button"
          @click="setScaler('robust')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeScaler === 'robust' ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          RobustScaler (IQR)
        </button>
      </div>

      <!-- Outlier Quick Reset -->
      <button
        type="button"
        @click="resetOutlier"
        class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-line bg-card hover:bg-card-subtle text-muted hover:text-ink transition-colors text-[11px]"
        title="Reset outlier to default 12,000 sq ft"
      >
        <RotateCcw class="w-3 h-3" />
        <span>Reset Outlier</span>
      </button>
    </div>

    <!-- Live Outlier Distortion Slider -->
    <div class="rounded-lg border border-line bg-card p-3 shadow-xs space-y-2">
      <div class="flex items-center justify-between text-xs font-mono">
        <div class="flex items-center gap-2">
          <AlertTriangle class="w-4 h-4 text-amber-500 animate-pulse" />
          <span class="font-bold text-ink">Outlier Generator:</span>
          <span class="text-muted text-[11px]">Mega Mansion G</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-muted text-[11px]">Value:</span>
          <span class="px-2 py-0.5 rounded bg-brand-amber-soft text-brand-amber font-bold border border-brand-amber/20">
            {{ outlierSqft.toLocaleString() }} sq ft
          </span>
          <span class="text-muted text-[10px] hidden sm:inline">(Base max: 2,200 sq ft)</span>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-[10px] font-mono text-muted">2,400</span>
        <input
          v-model.number="outlierSqft"
          type="range"
          min="2400"
          max="16000"
          step="200"
          @input="emitInspection"
          class="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-line rounded-lg"
        />
        <span class="text-[10px] font-mono text-muted">16,000</span>
      </div>
    </div>

    <!-- Dual-View Split: Left Jupyter Table + Right SVG Coordinate Distribution Space -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
      <!-- Left Panel: Authentic Jupyter DataFrame (5 cols on lg) -->
      <div class="lg:col-span-5 flex flex-col gap-2">
        <div class="rounded-lg border border-line bg-card shadow-xs overflow-hidden">
          <div class="px-3 py-2 border-b border-line bg-card-subtle flex items-center justify-between text-xs font-mono">
            <span class="font-bold text-ink flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-brand-blue" />
              df[['sqft', 'sqft_scaled']]
            </span>
            <span class="text-[11px] text-muted">7 rows × 2 cols</span>
          </div>

          <div class="overflow-x-auto">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr class="border-b border-line text-muted font-mono text-[11px] text-left">
                  <th class="py-1.5 px-3 font-semibold w-10 text-center">#</th>
                  <th class="py-1.5 px-3 font-semibold">House</th>
                  <th class="py-1.5 px-3 font-semibold text-right">Raw sqft</th>
                  <th class="py-1.5 px-3 font-semibold text-right text-brand-blue">
                    {{ activeScaler === 'raw' ? 'unscaled' : activeScaler }}
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-line/60 font-mono">
                <tr
                  v-for="house in transformedHouses"
                  :key="house.id"
                  @click="selectHouse(house.id)"
                  class="cursor-pointer transition-colors"
                  :class="[
                    selectedHouseId === house.id ? 'bg-brand-blue/10 dark:bg-brand-blue/20 font-bold' : 'hover:bg-card-subtle',
                    house.isOutlier ? 'bg-amber-500/5 dark:bg-amber-500/10' : ''
                  ]"
                >
                  <td class="py-1 px-3 text-center text-muted text-[11px]">{{ house.id }}</td>
                  <td class="py-1 px-3 text-ink flex items-center gap-1.5">
                    <span>{{ house.label.split(' ')[0] }}</span>
                    <span v-if="house.isOutlier" class="px-1 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                      Outlier
                    </span>
                  </td>
                  <td class="py-1 px-3 text-right text-muted">{{ house.rawSqft.toLocaleString() }}</td>
                  <td
                    class="py-1 px-3 text-right font-bold"
                    :class="[
                      house.isOutlier ? 'text-amber-600 dark:text-amber-400' : 'text-brand-blue',
                      activeScaler === 'minmax' && !house.isOutlier ? 'text-rose-600 dark:text-rose-400' : ''
                    ]"
                  >
                    {{ house.displayVal }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="px-3 py-1.5 border-t border-line bg-card-subtle text-[10px] font-mono text-muted flex items-center justify-between">
            <span>dtype: float64</span>
            <span v-if="activeScaler === 'minmax'" class="text-rose-600 dark:text-rose-400 font-semibold">
              Notice: Normal rows squashed!
            </span>
          </div>
        </div>

        <!-- Telemetry Stats Badge Box -->
        <div class="rounded-lg border border-line bg-card p-3 shadow-xs font-mono text-xs space-y-2">
          <div class="flex items-center justify-between text-ink font-bold text-[11px] border-b border-line/60 pb-1.5">
            <span class="flex items-center gap-1.5">
              <Activity class="w-3.5 h-3.5 text-brand-blue" />
              Live Population Statistics
            </span>
            <span class="text-muted text-[10px]">N = 7 samples</span>
          </div>

          <div class="grid grid-cols-2 gap-2 text-[11px]">
            <div class="flex items-center justify-between bg-card-subtle p-1.5 rounded border border-line/40">
              <span class="text-muted">Mean (μ):</span>
              <span class="font-bold text-ink">{{ stats.mean.toLocaleString() }}</span>
            </div>
            <div class="flex items-center justify-between bg-card-subtle p-1.5 rounded border border-line/40">
              <span class="text-muted">Std (σ):</span>
              <span class="font-bold text-ink">{{ stats.std.toLocaleString() }}</span>
            </div>
            <div class="flex items-center justify-between bg-card-subtle p-1.5 rounded border border-line/40">
              <span class="text-muted">Min (x_min):</span>
              <span class="font-bold text-ink">{{ stats.min.toLocaleString() }}</span>
            </div>
            <div class="flex items-center justify-between bg-card-subtle p-1.5 rounded border border-line/40">
              <span class="text-muted">Max (x_max):</span>
              <span class="font-bold text-amber-600 dark:text-amber-400">{{ stats.max.toLocaleString() }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Panel: Interactive 1D Vector Coordinate Distribution Space (7 cols on lg) -->
      <div class="lg:col-span-7 flex flex-col gap-2">
        <div class="rounded-lg border border-line bg-card p-3 shadow-xs space-y-3">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="font-bold text-ink flex items-center gap-1.5">
              <TrendingUp class="w-3.5 h-3.5 text-brand-blue" />
              Vector Space Distribution (1D Projection Axis)
            </span>
            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-card-subtle text-muted border border-line">
              {{ activeScaler }}
            </span>
          </div>

          <!-- SVG Distribution Axis -->
          <div class="relative w-full overflow-hidden bg-card-subtle rounded-md border border-line/60 p-2">
            <svg
              :viewBox="`0 0 ${svgViewBox.width} ${svgViewBox.height}`"
              class="w-full h-auto select-none"
            >
              <!-- Background Grid / Axis Line -->
              <line
                :x1="svgViewBox.paddingX - 10"
                :y1="svgViewBox.axisY"
                :x2="svgViewBox.width - svgViewBox.paddingX + 10"
                :y2="svgViewBox.axisY"
                stroke="currentColor"
                stroke-width="2"
                class="text-line"
              />

              <!-- Center zero / mean line for standard & robust -->
              <line
                v-if="activeScaler === 'standard' || activeScaler === 'robust'"
                :x1="axisScale.toX(0)"
                :y1="svgViewBox.axisY - 45"
                :x2="axisScale.toX(0)"
                :y2="svgViewBox.axisY + 45"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-dasharray="3 3"
                class="text-brand-blue/60"
              />

              <!-- Ticks & Labels -->
              <g v-for="tick in axisTicks" :key="tick.label">
                <line
                  :x1="tick.x"
                  :y1="svgViewBox.axisY - 6"
                  :x2="tick.x"
                  :y2="svgViewBox.axisY + 6"
                  stroke="currentColor"
                  stroke-width="1.5"
                  class="text-muted"
                />
                <text
                  :x="tick.x"
                  :y="svgViewBox.axisY + 22"
                  text-anchor="middle"
                  font-family="monospace"
                  font-size="10"
                  fill="currentColor"
                  class="text-muted font-bold"
                >
                  {{ tick.label }}
                </text>
              </g>

              <!-- In MinMaxScaler: Highlight Squashed Cluster Interval -->
              <g v-if="activeScaler === 'minmax'">
                <!-- Shaded bracket over normal houses -->
                <rect
                  :x="axisScale.toX(Number(minMaxNormalSpan.min)) - 4"
                  :y="svgViewBox.axisY - 32"
                  :width="Math.max(12, axisScale.toX(Number(minMaxNormalSpan.max)) - axisScale.toX(Number(minMaxNormalSpan.min)) + 8)"
                  height="64"
                  fill="rgba(244, 63, 94, 0.12)"
                  stroke="rgba(244, 63, 94, 0.4)"
                  stroke-dasharray="2 2"
                  rx="4"
                />
                <text
                  :x="axisScale.toX(Number(minMaxNormalSpan.max)) + 12"
                  :y="svgViewBox.axisY - 38"
                  font-family="monospace"
                  font-size="9"
                  fill="rgb(225, 29, 72)"
                  font-weight="bold"
                >
                  All 6 Normal Houses squashed into [{{ minMaxNormalSpan.min }}, {{ minMaxNormalSpan.max }}]!
                </text>
              </g>

              <!-- Render House Points on Axis -->
              <g
                v-for="house in transformedHouses"
                :key="house.id"
                @click="selectHouse(house.id)"
                class="cursor-pointer transition-all duration-300"
              >
                <!-- Vertical marker stem -->
                <line
                  :x1="axisScale.toX(house.transformedVal)"
                  :y1="svgViewBox.axisY - (house.isOutlier ? 34 : 20)"
                  :x2="axisScale.toX(house.transformedVal)"
                  :y2="svgViewBox.axisY"
                  stroke="currentColor"
                  stroke-width="house.id === selectedHouseId ? 2.5 : 1.5"
                  :class="[
                    house.isOutlier ? 'text-amber-500' : 'text-brand-blue',
                    house.id === selectedHouseId ? 'stroke-current' : 'opacity-70'
                  ]"
                />

                <!-- Marker Badge / Dot -->
                <circle
                  :cx="axisScale.toX(house.transformedVal)"
                  :cy="svgViewBox.axisY - (house.isOutlier ? 34 : 20)"
                  :r="house.id === selectedHouseId ? 7 : (house.isOutlier ? 6 : 4.5)"
                  :fill="house.isOutlier ? '#f59e0b' : '#3b82f6'"
                  stroke="#ffffff"
                  stroke-width="1.5"
                />

                <!-- Point Label -->
                <text
                  :x="axisScale.toX(house.transformedVal)"
                  :y="svgViewBox.axisY - (house.isOutlier ? 44 : 28)"
                  text-anchor="middle"
                  font-family="monospace"
                  font-size="9"
                  font-weight="bold"
                  fill="currentColor"
                  :class="house.isOutlier ? 'text-amber-600 dark:text-amber-400' : 'text-ink'"
                >
                  {{ house.label.split(' ')[0] }}
                </text>
              </g>
            </svg>
          </div>

          <!-- Scaler Educational Commentary Alert -->
          <div
            v-if="activeScaler === 'minmax'"
            class="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs font-mono space-y-1"
          >
            <div class="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
              <AlertTriangle class="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>The Outlier Distortion Catastrophe (MinMaxScaler)</span>
            </div>
            <p class="text-amber-900/90 dark:text-amber-200/90 text-[11px] leading-relaxed">
              Because the mega mansion is {{ outlierSqft.toLocaleString() }} sq ft, it dominates the maximum boundary (1.0).
              All 6 standard homes are compressed into a tiny {{ minMaxNormalSpan.spreadPct }}% sliver of the scale.
              Distance-based models (KNN, K-Means) lose the ability to differentiate normal variance!
            </p>
          </div>

          <div
            v-else-if="activeScaler === 'standard'"
            class="rounded-md border border-blue-500/30 bg-blue-500/10 p-2.5 text-xs font-mono space-y-1"
          >
            <div class="flex items-center gap-1.5 font-bold text-blue-800 dark:text-blue-300">
              <CheckCircle2 class="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>StandardScaler: Normalized Variance preserved around μ=0</span>
            </div>
            <p class="text-blue-900/90 dark:text-blue-200/90 text-[11px] leading-relaxed">
              Points are centered around zero in units of standard deviations ($z = \frac{x - \mu}{\sigma}$).
              Notice: The outlier pulls the mean up (μ = {{ stats.mean }}), which shifts normal houses slightly negative, but relative distances remain intact.
            </p>
          </div>

          <div
            v-else-if="activeScaler === 'robust'"
            class="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs font-mono space-y-1"
          >
            <div class="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
              <CheckCircle2 class="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>RobustScaler: Median &amp; IQR Immune to Outlier Bloat</span>
            </div>
            <p class="text-emerald-900/90 dark:text-emerald-200/90 text-[11px] leading-relaxed">
              Centered on the Median ($Q_2 = {{ stats.q2 }}$) and divided by the Interquartile Range ($IQR = {{ stats.iqr }}$).
              The outlier slides out to +{{ ((outlierSqft - stats.q2) / stats.iqr).toFixed(1) }} IQR without shrinking the spread of normal houses at all!
            </p>
          </div>

          <!-- Formula & Python Code Display -->
          <div class="rounded-md border border-line bg-card p-2.5 text-xs font-mono space-y-1">
            <span class="text-muted text-[10px] uppercase font-bold tracking-wider">Scikit-Learn Implementation:</span>
            <pre class="text-[11px] text-ink overflow-x-auto whitespace-pre-wrap">{{ activeFormulaSnippet }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dataframe {
  border-collapse: collapse;
}
.dataframe th,
.dataframe td {
  border-bottom: 1px solid var(--color-line, #e5e7eb);
}
</style>

