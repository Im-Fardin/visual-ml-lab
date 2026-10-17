<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Sliders,
  Sparkles,
  RotateCcw,
  Activity,
  Info,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Split,
  Maximize2
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Distribution Preset Types ----------------------------------------------
type DistributionPreset = 'symmetric' | 'right_skew' | 'left_skew'
const activePreset = ref<DistributionPreset>('right_skew')

// Outlier position (slider from 80 to 250, default 85)
const outlierX = ref<number>(85)
const outlierWeight = ref<number>(0.08) // 8% weight for visible gravitational pull
const showAreaHalves = ref<boolean>(false)

// SVG ViewBox Geometry
const svgWidth = 800
const svgHeight = 480
const margin = { top: 45, right: 45, bottom: 85, left: 55 }
const plotWidth = svgWidth - margin.left - margin.right
const plotHeight = svgHeight - margin.top - margin.bottom

// Domain is X in [0, 200]
const xMin = 0
const xMax = 200
const xRange = xMax - xMin

const xScale = (val: number) => {
  return margin.left + ((val - xMin) / xRange) * plotWidth
}

// Density function generator based on preset
// 1. Symmetric (Normal): Bell centered at 100, std = 22
// 2. Right-Skewed (Log-Normal / Gamma style): Peak at 40, tail stretches to right
// 3. Left-Skewed: Peak at 160, tail stretches to left
const baseDensity = (x: number): number => {
  if (activePreset.value === 'symmetric') {
    const mu = 100
    const sigma = 22
    const u = (x - mu) / sigma
    return Math.exp(-0.5 * u * u) / (sigma * Math.sqrt(2 * Math.PI))
  } else if (activePreset.value === 'right_skew') {
    if (x <= 10) return 0.0001
    // Log-normal shape parameterized over x
    // Peak around x = 40, median around 58, mean around 75
    const logM = Math.log(x)
    const mu = Math.log(58)
    const sigma = 0.58
    const u = (logM - mu) / sigma
    const pdf = (1 / (x * sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * u * u)
    return pdf
  } else {
    // Left-skew: mirror of right-skew over x=200
    const mirroredX = 200 - x
    if (mirroredX <= 10) return 0.0001
    const logM = Math.log(mirroredX)
    const mu = Math.log(58)
    const sigma = 0.58
    const u = (logM - mu) / sigma
    const pdf = (1 / (mirroredX * sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * u * u)
    return pdf
  }
}

// Evaluate curve across 200 points
const NUM_STEPS = 200
const curvePoints = computed(() => {
  const step = xRange / (NUM_STEPS - 1)
  const pts: { x: number; density: number }[] = []

  for (let i = 0; i < NUM_STEPS; i++) {
    const x = xMin + i * step
    pts.push({ x, density: baseDensity(x) })
  }

  return pts
})

// Peak Density for Y scaling
const peakDensity = computed(() => {
  const max = Math.max(...curvePoints.value.map(p => p.density), 0.015)
  return max * 1.25
})

const yScale = (density: number) => {
  const clamped = Math.max(0, Math.min(peakDensity.value, density))
  return margin.top + plotHeight - (clamped / peakDensity.value) * plotHeight
}

// Base Statistics of the Clean Distribution (without outlier)
const cleanStats = computed(() => {
  if (activePreset.value === 'symmetric') {
    return { mode: 100.0, median: 100.0, mean: 100.0 }
  } else if (activePreset.value === 'right_skew') {
    return { mode: 40.0, median: 58.0, mean: 75.0 }
  } else {
    return { mode: 160.0, median: 142.0, mean: 125.0 }
  }
})

// Live Central Tendencies with Outlier Gravitational Influence
const liveStats = computed(() => {
  const base = cleanStats.value
  const ox = outlierX.value
  const w = outlierWeight.value

  // Mode: argmax remains rigidly locked at the distribution peak!
  const mode = base.mode

  // Mean: Linear combination (center of mass) -> pulled strongly!
  const mean = (1 - w) * base.mean + w * ox

  // Median: Non-parametric rank position -> shifts very slightly!
  // An outlier contributes only to the tail count, shifting median by roughly 0.15 of mean shift
  const medianShift = (ox > base.median ? 1 : -1) * Math.min(Math.abs(ox - base.median) * 0.035, 4.5)
  const median = base.median + (w / 0.08) * medianShift

  return {
    mode: Number(mode.toFixed(1)),
    median: Number(median.toFixed(1)),
    mean: Number(mean.toFixed(1)),
    divergence: Number(Math.abs(mean - median).toFixed(1))
  }
})

// Skewness Diagnosis
const skewnessAssessment = computed(() => {
  const diff = liveStats.value.mean - liveStats.value.median
  if (Math.abs(diff) < 2.5) {
    return {
      type: 'Symmetric (Unskewed)',
      badgeClass: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30',
      rule: 'Mean ≈ Median ≈ Mode',
      summary: 'Data clusters evenly around a single central pivot. Mean reliably represents the population center.'
    }
  } else if (diff > 0) {
    return {
      type: diff > 15 ? 'Severe Right (Positive) Skew' : 'Moderate Right Skew',
      badgeClass: 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/30',
      rule: 'Mode < Median < Mean',
      summary: 'Extreme high-value outlier(s) gravitationally pull the Mean rightward, while the Median remains resistant.'
    }
  } else {
    return {
      type: diff < -15 ? 'Severe Left (Negative) Skew' : 'Moderate Left Skew',
      badgeClass: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30',
      rule: 'Mean < Median < Mode',
      summary: 'Low-value tail drags the Mean leftward below the Median and Mode.'
    }
  }
})

// Full Curve Path
const fullCurvePath = computed(() => {
  const pts = curvePoints.value
  let d = `M ${xScale(pts[0].x).toFixed(1)} ${yScale(pts[0].density).toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    d += ` L ${xScale(pts[i].x).toFixed(1)} ${yScale(pts[i].density).toFixed(1)}`
  }
  return d
})

// Left 50% Area Path (from x=0 to x=Median)
const leftAreaPath = computed(() => {
  const med = liveStats.value.median
  const pts = curvePoints.value.filter(p => p.x <= med)
  if (pts.length === 0) return ''

  const baseY = margin.top + plotHeight
  let d = `M ${xScale(pts[0].x).toFixed(1)} ${baseY}`
  for (let i = 0; i < pts.length; i++) {
    d += ` L ${xScale(pts[i].x).toFixed(1)} ${yScale(pts[i].density).toFixed(1)}`
  }
  // Connect to median point
  d += ` L ${xScale(med).toFixed(1)} ${yScale(baseDensity(med)).toFixed(1)}`
  d += ` L ${xScale(med).toFixed(1)} ${baseY} Z`
  return d
})

// Right 50% Area Path (from x=Median to x=200)
const rightAreaPath = computed(() => {
  const med = liveStats.value.median
  const pts = curvePoints.value.filter(p => p.x >= med)
  if (pts.length === 0) return ''

  const baseY = margin.top + plotHeight
  let d = `M ${xScale(med).toFixed(1)} ${baseY}`
  d += ` L ${xScale(med).toFixed(1)} ${yScale(baseDensity(med)).toFixed(1)}`
  for (let i = 0; i < pts.length; i++) {
    d += ` L ${xScale(pts[i].x).toFixed(1)} ${yScale(pts[i].density).toFixed(1)}`
  }
  d += ` L ${xScale(pts[pts.length - 1].x).toFixed(1)} ${baseY} Z`
  return d
})

// Preset switch handler
const setPreset = (preset: DistributionPreset) => {
  activePreset.value = preset
  if (preset === 'symmetric') outlierX.value = 100
  else if (preset === 'right_skew') outlierX.value = 180
  else outlierX.value = 30
  emitInspection()
}

// Telemetry Inspection emit
const emitInspection = () => {
  emit('inspect', {
    title: `Central Tendency: ${activePreset.value.replace('_', ' ').toUpperCase()}`,
    details: {
      'Active Distribution': activePreset.value === 'symmetric' ? 'Normal / Gaussian' : (activePreset.value === 'right_skew' ? 'Right-Skewed (Income Distribution)' : 'Left-Skewed (Exam Scores)'),
      'Mode (Peak)': `${liveStats.value.mode}k`,
      'Median (50th %tile)': `${liveStats.value.median}k`,
      'Mean (Center of Mass)': `${liveStats.value.mean}k`,
      'Divergence |μ - Med|': `${liveStats.value.divergence}k`,
      'Outlier Location': `${outlierX.value}k`,
      'Skewness Diagnosis': skewnessAssessment.value.type,
      'Mathematical Relation': skewnessAssessment.value.rule
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
      <!-- Preset Distribution Switcher -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">Distribution:</span>
        <button
          type="button"
          @click="setPreset('right_skew')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activePreset === 'right_skew' ? 'bg-amber-600 text-white font-bold border-amber-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          Right-Skewed (Income Distribution)
        </button>
        <button
          type="button"
          @click="setPreset('symmetric')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activePreset === 'symmetric' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          Symmetric (Normal Bell)
        </button>
        <button
          type="button"
          @click="setPreset('left_skew')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activePreset === 'left_skew' ? 'bg-purple-600 text-white font-bold border-purple-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          Left-Skewed (Exam Scores)
        </button>
      </div>

      <!-- Area Halves Toggle -->
      <div class="flex items-center gap-2 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <label class="flex items-center gap-1.5 cursor-pointer text-[11px]">
          <input v-model="showAreaHalves" type="checkbox" class="accent-amber-500" />
          <span :class="showAreaHalves ? 'text-ink font-bold' : 'text-muted'">Show 50% / 50% Area Halves</span>
        </label>
      </div>
    </div>

    <!-- Live Outlier Gravitational Drag Slider -->
    <div class="rounded-lg border border-line bg-card p-3 shadow-xs space-y-2 font-mono text-xs">
      <div class="flex items-center justify-between">
        <span class="font-bold text-ink flex items-center gap-1.5">
          <AlertTriangle class="w-4 h-4 text-rose-500" />
          Outlier Gravitational Pull:
          <span class="text-rose-600 dark:text-rose-400 font-bold text-sm">x_outlier = ${{ outlierX }}k</span>
        </span>
        <div class="flex items-center gap-2 text-[11px]">
          <span class="text-muted">Divergence Gap:</span>
          <span class="px-2 py-0.5 rounded font-bold bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30">
            |Mean - Median| = {{ liveStats.divergence }}k
          </span>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <span class="text-[10px] text-muted">0k</span>
        <input
          v-model.number="outlierX"
          type="range"
          min="10"
          max="240"
          step="2"
          @input="emitInspection"
          class="flex-1 accent-rose-500 cursor-pointer h-1.5 bg-line rounded-lg"
        />
        <span class="text-[10px] text-muted">240k</span>
      </div>
    </div>

    <!-- Main SVG Distribution Plane -->
    <div class="rounded-lg border border-line bg-card p-3 shadow-xs space-y-3">
      <!-- Badges HUD for the 3 Central Tendencies -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-mono text-xs">
        <!-- Mode Badge (Purple) -->
        <div class="flex items-center justify-between p-2 rounded-md bg-purple-500/10 border border-purple-500/30">
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span class="font-bold text-purple-800 dark:text-purple-300">Mode (Peak):</span>
          </div>
          <span class="text-sm font-extrabold text-purple-700 dark:text-purple-300">${{ liveStats.mode }}k</span>
        </div>

        <!-- Median Badge (Amber) -->
        <div class="flex items-center justify-between p-2 rounded-md bg-amber-500/10 border border-amber-500/30">
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-500" />
            <span class="font-bold text-amber-800 dark:text-amber-300">Median (Q₂ 50%):</span>
          </div>
          <span class="text-sm font-extrabold text-amber-700 dark:text-amber-300">${{ liveStats.median }}k</span>
        </div>

        <!-- Mean Badge (Rose) -->
        <div class="flex items-center justify-between p-2 rounded-md bg-rose-500/10 border border-rose-500/30">
          <div class="flex items-center gap-1.5">
            <span class="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span class="font-bold text-rose-800 dark:text-rose-300">Mean (Center of Mass):</span>
          </div>
          <span class="text-sm font-extrabold text-rose-700 dark:text-rose-300">${{ liveStats.mean }}k</span>
        </div>
      </div>

      <!-- Fluid Responsive SVG Viewport -->
      <div class="w-full min-h-[320px] flex items-center justify-center relative bg-card-subtle rounded-md border border-line/60 p-2 pb-4">
        <svg
          :viewBox="`0 0 ${svgWidth} ${svgHeight}`"
          preserveAspectRatio="xMidYMid meet"
          class="w-full h-auto select-none"
        >
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

          <!-- X-Axis Increments (Income in thousands: 0 to 200k) -->
          <g v-for="tick in [0, 40, 80, 120, 160, 200]" :key="tick">
            <line
              :x1="xScale(tick)"
              :y1="margin.top + plotHeight"
              :x2="xScale(tick)"
              :y2="margin.top + plotHeight + 7"
              stroke="currentColor"
              stroke-width="1.5"
              class="text-line"
            />
            <text
              :x="xScale(tick)"
              :y="margin.top + plotHeight + 26"
              text-anchor="middle"
              font-family="monospace"
              font-size="10.5"
              fill="currentColor"
              class="text-muted font-bold"
            >
              ${{ tick }}k
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
            Household Income ($ in thousands)
          </text>

          <!-- 1. Area Fill under curve -->
          <!-- Normal un-split area fill -->
          <path
            v-if="!showAreaHalves"
            :d="`${fullCurvePath} L ${xScale(200)} ${margin.top + plotHeight} L ${xScale(0)} ${margin.top + plotHeight} Z`"
            fill="rgba(148, 163, 184, 0.18)"
          />

          <!-- 2. Dual-Colored 50% / 50% Area Halves split at Median -->
          <g v-if="showAreaHalves">
            <!-- Left 50% area (Soft Blue) -->
            <path
              :d="leftAreaPath"
              fill="rgba(59, 130, 246, 0.25)"
              stroke="rgba(59, 130, 246, 0.5)"
              stroke-width="1"
            />
            <!-- Right 50% area (Soft Emerald) -->
            <path
              :d="rightAreaPath"
              fill="rgba(16, 185, 129, 0.25)"
              stroke="rgba(16, 185, 129, 0.5)"
              stroke-width="1"
            />
            <!-- Left 50% Label -->
            <text
              :x="xScale(liveStats.median) - 60"
              :y="margin.top + plotHeight - 35"
              text-anchor="middle"
              font-family="monospace"
              font-size="11"
              font-weight="bold"
              fill="#2563eb"
            >
              50% of Population
            </text>
            <!-- Right 50% Label -->
            <text
              :x="Math.min(svgWidth - margin.right - 60, xScale(liveStats.median) + 70)"
              :y="margin.top + plotHeight - 35"
              text-anchor="middle"
              font-family="monospace"
              font-size="11"
              font-weight="bold"
              fill="#059669"
            >
              50% of Population
            </text>
          </g>

          <!-- 3. Full Continuous Density Curve Stroke -->
          <path
            :d="fullCurvePath"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            class="text-slate-700 dark:text-slate-200"
          />

          <!-- 4. Mode Vertical Indicator (Purple) -->
          <g>
            <line
              :x1="xScale(liveStats.mode)"
              :y1="margin.top"
              :x2="xScale(liveStats.mode)"
              :y2="margin.top + plotHeight"
              stroke="#8b5cf6"
              stroke-width="2"
              stroke-dasharray="4 2"
            />
            <!-- Mode Top Pill -->
            <rect
              :x="xScale(liveStats.mode) - 34"
              :y="margin.top - 20"
              width="68"
              height="18"
              rx="3"
              fill="#8b5cf6"
            />
            <text
              :x="xScale(liveStats.mode)"
              :y="margin.top - 7"
              text-anchor="middle"
              font-family="monospace"
              font-size="9.5"
              font-weight="bold"
              fill="#ffffff"
            >
              Mode ${{ liveStats.mode }}k
            </text>
          </g>

          <!-- 5. Median Vertical Indicator (Amber) -->
          <g>
            <line
              :x1="xScale(liveStats.median)"
              :y1="margin.top + 15"
              :x2="xScale(liveStats.median)"
              :y2="margin.top + plotHeight"
              stroke="#f59e0b"
              stroke-width="2.5"
            />
            <!-- Median Top Pill -->
            <rect
              :x="xScale(liveStats.median) - 36"
              :y="margin.top - 3"
              width="72"
              height="18"
              rx="3"
              fill="#f59e0b"
            />
            <text
              :x="xScale(liveStats.median)"
              :y="margin.top + 10"
              text-anchor="middle"
              font-family="monospace"
              font-size="9.5"
              font-weight="bold"
              fill="#ffffff"
            >
              Median ${{ liveStats.median }}k
            </text>
          </g>

          <!-- 6. Mean Vertical Indicator (Rose) -->
          <g>
            <line
              :x1="xScale(liveStats.mean)"
              :y1="margin.top + 30"
              :x2="xScale(liveStats.mean)"
              :y2="margin.top + plotHeight"
              stroke="#f43f5e"
              stroke-width="2.5"
            />
            <!-- Mean Top Pill -->
            <rect
              :x="xScale(liveStats.mean) - 34"
              :y="margin.top + 14"
              width="68"
              height="18"
              rx="3"
              fill="#f43f5e"
            />
            <text
              :x="xScale(liveStats.mean)"
              :y="margin.top + 27"
              text-anchor="middle"
              font-family="monospace"
              font-size="9.5"
              font-weight="bold"
              fill="#ffffff"
            >
              Mean ${{ liveStats.mean }}k
            </text>
          </g>

          <!-- 7. Divergence Gap Bracket between Median and Mean -->
          <g v-if="liveStats.divergence >= 3">
            <line
              :x1="xScale(liveStats.median)"
              :y1="margin.top + 70"
              :x2="xScale(liveStats.mean)"
              :y2="margin.top + 70"
              stroke="#f43f5e"
              stroke-width="1.8"
              stroke-dasharray="2 2"
            />
            <text
              :x="(xScale(liveStats.median) + xScale(liveStats.mean)) / 2"
              :y="margin.top + 65"
              text-anchor="middle"
              font-family="monospace"
              font-size="9"
              font-weight="bold"
              fill="#e11d48"
            >
              Δ = ${{ liveStats.divergence }}k gap
            </text>
          </g>

          <!-- 8. Outlier Node Pin on the Axis -->
          <g>
            <line
              :x1="xScale(outlierX)"
              :y1="margin.top + plotHeight - 28"
              :x2="xScale(outlierX)"
              :y2="margin.top + plotHeight"
              stroke="#f43f5e"
              stroke-width="2"
            />
            <circle
              :cx="xScale(outlierX)"
              :cy="margin.top + plotHeight - 28"
              r="7.5"
              fill="#f43f5e"
              stroke="#ffffff"
              stroke-width="2"
              class="cursor-pointer shadow-md"
            />
            <text
              :x="xScale(outlierX)"
              :y="margin.top + plotHeight - 40"
              text-anchor="middle"
              font-family="monospace"
              font-size="9.5"
              font-weight="bold"
              fill="#e11d48"
            >
              Outlier ${{ outlierX }}k
            </text>
          </g>
        </svg>
      </div>

      <!-- Educational Skewness Invariant Note -->
      <div class="rounded-md border border-line bg-card p-3 font-mono text-xs space-y-2">
        <div class="flex items-center justify-between border-b border-line/60 pb-1.5">
          <span class="font-bold text-ink flex items-center gap-1.5">
            <Info class="w-3.5 h-3.5 text-brand-blue" />
            Central Tendency Theorem:
          </span>
          <span class="px-2 py-0.5 rounded text-[10px] font-bold border" :class="skewnessAssessment.badgeClass">
            {{ skewnessAssessment.type }} ({{ skewnessAssessment.rule }})
          </span>
        </div>
        <p class="text-muted text-[11px] leading-relaxed">
          {{ skewnessAssessment.summary }}
        </p>

        <!-- Python Code Snippet -->
        <div class="pt-1 border-t border-line/40">
          <span class="text-[10px] text-muted uppercase font-bold tracking-wider">SciPy &amp; Pandas Calculation:</span>
          <pre class="mt-1 text-[11px] text-ink overflow-x-auto whitespace-pre-wrap bg-card-subtle p-2 rounded border border-line/40">import pandas as pd
from scipy import stats

income = pd.Series([...])

# 1. Mode: Frequency peak
mode_val = income.mode()[0]       # ${{ liveStats.mode }}k (Immovable peak)

# 2. Median: 50th percentile rank
median_val = income.median()      # ${{ liveStats.median }}k (Outlier-resistant)

# 3. Mean: Center of mass
mean_val = income.mean()          # ${{ liveStats.mean }}k (Pulled by ${{ outlierX }}k outlier!)</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Safe layout: zero hardcoded pixel overflow */
</style>

