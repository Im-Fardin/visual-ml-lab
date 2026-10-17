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

// 6 standard residential homes
const baseHouses = [
  { id: 0, label: 'Cottage A', rawSqft: 1200, isOutlier: false },
  { id: 1, label: 'Suburban B', rawSqft: 1450, isOutlier: false },
  { id: 2, label: 'Townhouse C', rawSqft: 1600, isOutlier: false },
  { id: 3, label: 'Craftsman D', rawSqft: 1750, isOutlier: false },
  { id: 4, label: 'Colonial E', rawSqft: 1900, isOutlier: false },
  { id: 5, label: 'Ranch F', rawSqft: 2100, isOutlier: false }
]

// Outlier value controlled by slider (default 15,000 sq ft mega-mansion)
const outlierSqft = ref<number>(15000)

// Scaler type
type ScalerType = 'raw' | 'standard' | 'minmax' | 'robust'
const activeScaler = ref<ScalerType>('standard')

// Selected house for detailed inspection
const selectedHouseId = ref<number | null>(null)

// --- Computeds -------------------------------------------------------------
const dataset = computed<HouseRecord[]>(() => {
  return [
    ...baseHouses,
    { id: 6, label: 'Mega Mansion G', rawSqft: outlierSqft.value, isOutlier: true }
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
  // For N=7: Q1 is idx 1 (1450), Median Q2 is idx 3 (1750), Q3 is idx 5 (2100)
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

// SVG Axis Mapping
const svgViewBox = { width: 560, height: 160, paddingX: 45, axisY: 85 }

const axisScale = computed(() => {
  let minDomain = 0
  let maxDomain = 100

  if (activeScaler.value === 'raw') {
    minDomain = 0
    maxDomain = Math.max(20000, outlierSqft.value * 1.05)
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
    const steps = [0, 5000, 10000, 15000, 20000]
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
      'Dataset Mean (μ)': `${stats.value.mean.toLocaleString()} sq ft`,
      'Std Dev (σ)': `${stats.value.std.toLocaleString()} sq ft`,
      'Median (Q2)': `${stats.value.q2.toLocaleString()} sq ft`,
      'IQR (Q3 - Q1)': `${stats.value.iqr.toLocaleString()} sq ft`,
      'MinMaxScaler Compression': activeScaler.value === 'minmax' ? `Normal data squashed into [${minMaxNormalSpan.value.min}, ${minMaxNormalSpan.value.max}] (${minMaxNormalSpan.value.spreadPct}% of scale)` : 'N/A',
      'Inspected Record': selected ? `${selected.label}: ${selected.displayVal}` : 'None'
    }
  })
}

const setScaler = (sc: ScalerType) => {
  activeScaler.value = sc
  emitInspection()
}

const selectHouse = (id: number) => {
  selectedHouseId.value = id
  emitInspection()
}

const resetOutlier = () => {
  outlierSqft.value = 15000
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
      <!-- Scaler Switcher Buttons -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">Scaler:</span>
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
        <button
          type="button"
          @click="setScaler('raw')"
          class="px-2 py-0.5 rounded border text-[11px]"
          :class="activeScaler === 'raw' ? 'bg-muted text-ink font-bold border-muted-dark' : 'bg-card border-line text-muted hover:text-ink'"
        >
          Raw (Unscaled)
        </button>
      </div>

      <!-- Outlier Quick Info Badge -->
      <div class="flex items-center gap-2 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <span class="w-2 h-2 rounded-full" :class="activeScaler === 'robust' ? 'bg-emerald-500' : activeScaler === 'minmax' ? 'bg-amber-500' : 'bg-brand-blue'" />
        <span class="font-bold text-ink">Outlier:</span>
        <span class="text-amber-600 dark:text-amber-400 font-bold font-mono">{{ outlierSqft.toLocaleString() }} sq ft</span>
      </div>
    </div>

    <!-- Main Dual-View Studio Arena -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- LEFT 6 COLS: Authentic Jupyter DataFrame Table -->
        <div class="lg:col-span-6 flex flex-col gap-3">
          <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1.5">
            <span class="flex items-center gap-1.5">
              <Layers class="w-4 h-4 text-brand-blue" />
              <span>Feature Matrix: X[['sqft']]</span>
            </span>
            <span class="text-[11px] font-normal text-muted">
              N={{ dataset.length }} records • float64
            </span>
          </div>

          <!-- Outlier Slider Control Strip -->
          <div class="rounded-md border border-line bg-card p-2.5 flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-xs font-mono">
              <span class="text-muted flex items-center gap-1">
                <Sliders class="w-3.5 h-3.5 text-amber-500" />
                <span>Manipulate Outlier House (Row #6):</span>
              </span>
              <span class="font-bold text-amber-600 dark:text-amber-400">{{ outlierSqft.toLocaleString() }} sq ft</span>
            </div>
            <input
              type="range"
              min="2500"
              max="20000"
              step="250"
              v-model.number="outlierSqft"
              @input="emitInspection"
              class="w-full accent-amber-500 cursor-pointer h-1.5 bg-line rounded-lg"
            />
            <div class="flex items-center justify-between text-[10px] font-mono text-muted">
              <span>Mild Outlier: 2,500 sq ft</span>
              <span>Extreme Outlier: 20,000 sq ft</span>
            </div>
          </div>

          <!-- Tabular Table -->
          <div class="overflow-x-auto w-full">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-8 text-center text-muted">#</th>
                  <th class="text-left font-bold text-ink">Property</th>
                  <th class="text-right font-bold text-ink">raw_sqft</th>
                  <th class="text-right font-bold" :class="activeScaler === 'robust' ? 'text-emerald-600 dark:text-emerald-400' : activeScaler === 'minmax' ? 'text-amber-600 dark:text-amber-400' : 'text-brand-blue'">
                    scaled_val
                  </th>
                  <th class="text-center font-bold text-muted text-[10px]">Delta</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="house in transformedHouses"
                  :key="house.id"
                  @click="selectHouse(house.id)"
                  class="cursor-pointer transition-colors"
                  :class="[
                    selectedHouseId === house.id ? 'bg-brand-blue/15 font-bold' : house.isOutlier ? 'bg-amber-500/10 font-medium' : 'hover:bg-card-subtle'
                  ]"
                >
                  <td class="text-center font-mono text-[11px]" :class="house.isOutlier ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-muted'">
                    {{ house.id }}
                  </td>
                  <td class="font-mono text-ink py-1">
                    <span v-if="house.isOutlier" class="text-amber-700 dark:text-amber-300 font-bold">⚠️ {{ house.label }}</span>
                    <span v-else>{{ house.label }}</span>
                  </td>
                  <td class="font-mono text-right font-semibold text-muted">
                    {{ house.rawSqft.toLocaleString() }}
                  </td>
                  <td class="font-mono text-right font-bold" :class="house.isOutlier ? 'text-amber-600 dark:text-amber-400' : 'text-ink'">
                    {{ house.displayVal }}
                  </td>
                  <td class="text-center font-mono text-[10px] text-muted">
                    {{ house.deltaFromCenter }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Mathematical Parameters Footnote -->
          <div class="p-2.5 rounded border border-line bg-card-subtle text-[11px] font-mono text-muted flex items-center justify-between flex-wrap gap-2">
            <span>μ = <strong class="text-ink">{{ stats.mean.toLocaleString() }}</strong></span>
            <span>σ = <strong class="text-ink">{{ stats.std.toLocaleString() }}</strong></span>
            <span>Median = <strong class="text-ink">{{ stats.q2.toLocaleString() }}</strong></span>
            <span>IQR = <strong class="text-ink">{{ stats.iqr.toLocaleString() }}</strong></span>
          </div>
        </div>

        <!-- RIGHT 6 COLS: 1D Distribution Coordinate Axis Canvas -->
        <div class="lg:col-span-6 flex flex-col gap-3">
          <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1.5">
            <span class="flex items-center gap-1.5">
              <Activity class="w-4 h-4 text-emerald-500" />
              <span>1D Feature Space Coordinate Projection</span>
            </span>
            <span class="text-[11px] font-normal text-muted">
              SVG Vector Canvas
            </span>
          </div>

          <!-- Dynamic Warning / Invariant Callout -->
          <div
            v-if="activeScaler === 'minmax'"
            class="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs font-mono text-amber-900 dark:text-amber-200 flex items-start gap-2"
          >
            <AlertTriangle class="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div class="text-[11px] leading-relaxed">
              <strong>The MinMaxScaler Outlier Trap:</strong> The outlier at {{ outlierSqft.toLocaleString() }} sq ft lands at <code>1.0</code>, squashing all 6 normal houses into a tiny sliver: <strong>[{{ minMaxNormalSpan.min }}, {{ minMaxNormalSpan.max }}]</strong> (just {{ minMaxNormalSpan.spreadPct }}% of total width). All relative variance is destroyed!
            </div>
          </div>

          <div
            v-else-if="activeScaler === 'robust'"
            class="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2.5 text-xs font-mono text-emerald-900 dark:text-emerald-200 flex items-start gap-2"
          >
            <CheckCircle2 class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div class="text-[11px] leading-relaxed">
              <strong>RobustScaler Resilience:</strong> Scaling is determined exclusively by the Median ($Q_2=1750$) and IQR ($Q_3 - Q_1 = 650$). The normal houses maintain their healthy spread. The outlier is isolated at <code>{{ ((outlierSqft - stats.q2)/stats.iqr).toFixed(1) }} IQR</code> without compressing the other records.
            </div>
          </div>

          <div
            v-else-if="activeScaler === 'standard'"
            class="rounded-md border border-brand-blue/40 bg-brand-blue/10 p-2.5 text-xs font-mono text-ink flex items-start gap-2"
          >
            <Info class="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
            <div class="text-[11px] leading-relaxed">
              <strong>StandardScaler Mean Shift:</strong> The extreme outlier pulls the calculated mean $\mu$ upward from $1666$ to <strong>{{ stats.mean.toLocaleString() }}</strong> and inflates $\sigma$ to <strong>{{ stats.std.toLocaleString() }}</strong>, dragging all standard houses into negative $z$-scores.
            </div>
          </div>

          <!-- SVG Distribution Coordinate Axis -->
          <div class="rounded-md border border-line bg-card p-3 flex flex-col justify-center">
            <svg
              :viewBox="`0 0 ${svgViewBox.width} ${svgViewBox.height}`"
              class="w-full h-auto overflow-visible select-none"
            >
              <!-- Center Reference Line (μ or Q2) -->
              <template v-if="activeScaler === 'standard' || activeScaler === 'robust'">
                <line
                  :x1="axisScale.toX(0)"
                  :y1="25"
                  :x2="axisScale.toX(0)"
                  :y2="120"
                  stroke="currentColor"
                  stroke-dasharray="3 3"
                  class="text-muted/40"
                  stroke-width="1.5"
                />
                <text
                  :x="axisScale.toX(0)"
                  y="20"
                  text-anchor="middle"
                  class="text-[10px] font-mono font-bold fill-current text-muted"
                >
                  {{ activeScaler === 'standard' ? 'μ (Mean)' : 'Q₂ (Median)' }}
                </text>
              </template>

              <!-- Main Horizontal Coordinate Rail -->
              <line
                :x1="svgViewBox.paddingX - 10"
                :y1="svgViewBox.axisY"
                :x2="svgViewBox.width - svgViewBox.paddingX + 10"
                :y2="svgViewBox.axisY"
                stroke="currentColor"
                class="text-line"
                stroke-width="2"
              />

              <!-- Ticks -->
              <g v-for="tick in axisTicks" :key="tick.val">
                <line
                  :x1="tick.x"
                  :y1="svgViewBox.axisY - 5"
                  :x2="tick.x"
                  :y2="svgViewBox.axisY + 5"
                  stroke="currentColor"
                  class="text-muted"
                  stroke-width="1.5"
                />
                <text
                  :x="tick.x"
                  :y="svgViewBox.axisY + 20"
                  text-anchor="middle"
                  class="text-[10px] font-mono fill-current text-muted"
                >
                  {{ tick.label }}
                </text>
              </g>

              <!-- Normal Data Points Cluster Bracket (MinMax specific) -->
              <rect
                v-if="activeScaler === 'minmax'"
                :x="axisScale.toX(Number(minMaxNormalSpan.min)) - 4"
                :y="svgViewBox.axisY - 26"
                :width="Math.max(8, axisScale.toX(Number(minMaxNormalSpan.max)) - axisScale.toX(Number(minMaxNormalSpan.min)) + 8)"
                height="40"
                rx="4"
                fill="rgba(245, 158, 11, 0.15)"
                stroke="rgba(245, 158, 11, 0.5)"
                stroke-dasharray="2 2"
              />

              <!-- House Points on Coordinate Axis -->
              <g
                v-for="(house, idx) in transformedHouses"
                :key="house.id"
                @click="selectHouse(house.id)"
                class="cursor-pointer transition-all duration-300"
              >
                <!-- Connecting Stem -->
                <line
                  :x1="axisScale.toX(house.transformedVal)"
                  :y1="svgViewBox.axisY"
                  :x2="axisScale.toX(house.transformedVal)"
                  :y2="house.isOutlier ? svgViewBox.axisY - 32 : (idx % 2 === 0 ? svgViewBox.axisY - 24 : svgViewBox.axisY + 28)"
                  stroke="currentColor"
                  :class="house.isOutlier ? 'text-amber-500' : 'text-brand-blue'"
                  stroke-width="1.5"
                />

                <!-- Point Marker Circle -->
                <circle
                  :cx="axisScale.toX(house.transformedVal)"
                  :cy="svgViewBox.axisY"
                  :r="house.isOutlier ? 7 : 5"
                  :fill="house.isOutlier ? '#f59e0b' : '#3b82f6'"
                  stroke="#ffffff"
                  stroke-width="2"
                  class="shadow-xs hover:scale-125 transition-transform"
                />

                <!-- Data Badge -->
                <g :transform="`translate(${axisScale.toX(house.transformedVal)}, ${house.isOutlier ? svgViewBox.axisY - 38 : (idx % 2 === 0 ? svgViewBox.axisY - 30 : svgViewBox.axisY + 38)})`">
                  <rect
                    x="-18"
                    y="-10"
                    width="36"
                    height="14"
                    rx="3"
                    :fill="house.isOutlier ? '#f59e0b' : '#1e293b'"
                    class="shadow-2xs"
                  />
                  <text
                    x="0"
                    y="0"
                    text-anchor="middle"
                    dominant-baseline="central"
                    fill="#ffffff"
                    class="text-[9px] font-mono font-bold"
                  >
                    #{{ house.id }}
                  </text>
                </g>
              </g>
            </svg>

            <!-- Legend strip below SVG -->
            <div class="mt-2 pt-2 border-t border-line/60 flex items-center justify-between text-[10px] font-mono text-muted">
              <span class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-brand-blue" />
                <span>Normal Properties (#0..#5)</span>
              </span>
              <span class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span>Outlier Mansion (#6)</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Interactive Invariant & Summary Strip -->
      <div class="mt-6 pt-3 border-t border-line flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="setScaler(activeScaler === 'robust' ? 'minmax' : activeScaler === 'minmax' ? 'standard' : 'robust')"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-blue text-white text-xs font-mono font-medium hover:bg-brand-blue/90 shadow-2xs cursor-pointer"
          >
            <Sparkles class="w-3.5 h-3.5" />
            <span>Cycle Scaler</span>
          </button>

          <button
            type="button"
            @click="resetOutlier"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card text-xs font-mono text-muted hover:text-ink hover:bg-card-subtle shadow-2xs cursor-pointer"
            title="Reset outlier to 15,000 sq ft"
          >
            <RotateCcw class="w-3.5 h-3.5" />
            <span>Reset Outlier</span>
          </button>
        </div>

        <div class="text-xs font-mono text-muted">
          <span>Scaling Invariant: </span>
          <strong class="text-ink">Use RobustScaler when extreme outliers cannot be trimmed</strong>
        </div>
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active Feature Preprocessing Pipeline:</span>
        <span class="text-brand-blue font-semibold">sklearn.preprocessing.{{ activeScaler === 'standard' ? 'StandardScaler' : activeScaler === 'minmax' ? 'MinMaxScaler' : activeScaler === 'robust' ? 'RobustScaler' : 'None' }}</span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ activeFormulaSnippet }}</code></pre>
    </div>
  </div>
</template>

