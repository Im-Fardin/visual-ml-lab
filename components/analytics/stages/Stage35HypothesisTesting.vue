<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Activity,
  Sliders,
  Sparkles,
  RotateCcw,
  Info,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Scale,
  Crosshair,
  TrendingUp,
  Layers,
  ArrowRight
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- State ------------------------------------------------------------------
// Observed Test Statistic Z_obs in [-3.50, +3.50], default 1.20
const zObs = ref<number>(1.20)

// Significance Level alpha: 0.10 | 0.05 | 0.01
type AlphaLevel = 0.10 | 0.05 | 0.01
const alpha = ref<AlphaLevel>(0.05)

// Tail Direction: 'two-tailed' | 'right-tailed' | 'left-tailed'
type TailMode = 'two-tailed' | 'right-tailed' | 'left-tailed'
const tailMode = ref<TailMode>('two-tailed')

// Display toggles
const showPValueArea = ref<boolean>(true)
const showAlphaArea = ref<boolean>(true)

// --- Math Functions: Standard Normal Distribution N(0, 1) ------------------
const SQRT_2PI = Math.sqrt(2 * Math.PI)

const stdNormalPdf = (z: number): number => {
  return (1 / SQRT_2PI) * Math.exp(-0.5 * z * z)
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

// Standard normal CDF Phi(z)
const stdNormalCdf = (z: number): number => {
  return 0.5 * (1 + erf(z / Math.SQRT2))
}

// Critical Z threshold lookup table
const criticalZ = computed<number>(() => {
  if (tailMode.value === 'two-tailed') {
    if (alpha.value === 0.01) return 2.576
    if (alpha.value === 0.05) return 1.960
    return 1.645 // alpha = 0.10
  } else {
    // One-tailed (right or left)
    if (alpha.value === 0.01) return 2.326
    if (alpha.value === 0.05) return 1.645
    return 1.282 // alpha = 0.10
  }
})

// p-value calculation
const pValue = computed<number>(() => {
  const z = zObs.value
  if (tailMode.value === 'two-tailed') {
    const tailProb = 1 - stdNormalCdf(Math.abs(z))
    return Math.min(1.0, Math.max(0.0, 2 * tailProb))
  } else if (tailMode.value === 'right-tailed') {
    return Math.min(1.0, Math.max(0.0, 1 - stdNormalCdf(z)))
  } else {
    // left-tailed
    return Math.min(1.0, Math.max(0.0, stdNormalCdf(z)))
  }
})

// Decision: Reject H0 vs Fail to Reject H0
const isRejected = computed<boolean>(() => {
  return pValue.value < alpha.value
})

// --- SVG Layout & Coordinates (Strict standard: 800 x 500) -------------------
const SVG_WIDTH = 800
const SVG_HEIGHT = 500
const MARGIN = { top: 40, right: 40, bottom: 70, left: 60 }

const plotWidth = SVG_WIDTH - MARGIN.left - MARGIN.right // 700
const plotHeight = SVG_HEIGHT - MARGIN.top - MARGIN.bottom // 390
const baselineY = SVG_HEIGHT - MARGIN.bottom // 430

const zMin = -4.0
const zMax = 4.0
const zRange = zMax - zMin // 8.0

const scaleX = (z: number): number => {
  return MARGIN.left + ((z - zMin) / zRange) * plotWidth
}

const maxDensity = 0.42
const scaleY = (density: number): number => {
  const clamped = Math.max(0, Math.min(density, maxDensity))
  return baselineY - (clamped / maxDensity) * plotHeight
}

// 120 evenly spaced sample points for bell curve
const NUM_POINTS = 120
const curvePoints = computed<Array<{ z: number; x: number; y: number }>>(() => {
  const pts: Array<{ z: number; x: number; y: number }> = []
  for (let i = 0; i < NUM_POINTS; i++) {
    const z = zMin + (i / (NUM_POINTS - 1)) * zRange
    pts.push({
      z,
      x: scaleX(z),
      y: scaleY(stdNormalPdf(z))
    })
  }
  return pts
})

// Full Bell Curve Path
const fullCurvePath = computed<string>(() => {
  const pts = curvePoints.value
  if (pts.length === 0) return ''
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
})

// Helpers to generate closed polygon area paths
const generateAreaPath = (fromZ: number, toZ: number): string => {
  const zStart = Math.max(zMin, Math.min(zMax, fromZ))
  const zEnd = Math.max(zMin, Math.min(zMax, toZ))
  if (zStart >= zEnd) return ''

  const steps = 40
  const topPoints: string[] = []
  for (let i = 0; i <= steps; i++) {
    const z = zStart + (i / steps) * (zEnd - zStart)
    topPoints.push(`${scaleX(z).toFixed(2)} ${scaleY(stdNormalPdf(z)).toFixed(2)}`)
  }

  const startX = scaleX(zStart).toFixed(2)
  const endX = scaleX(zEnd).toFixed(2)
  return `M ${startX} ${baselineY} L ${topPoints.join(' L ')} L ${endX} ${baselineY} Z`
}

// Critical Rejection Tails (Alpha area)
const alphaLeftTailPath = computed<string>(() => {
  if (tailMode.value === 'right-tailed') return ''
  const crit = tailMode.value === 'two-tailed' ? -criticalZ.value : -criticalZ.value
  return generateAreaPath(zMin, crit)
})

const alphaRightTailPath = computed<string>(() => {
  if (tailMode.value === 'left-tailed') return ''
  const crit = criticalZ.value
  return generateAreaPath(crit, zMax)
})

// Central Non-Rejection Region (1 - alpha safe zone)
const nonRejectionPath = computed<string>(() => {
  if (tailMode.value === 'two-tailed') {
    return generateAreaPath(-criticalZ.value, criticalZ.value)
  } else if (tailMode.value === 'right-tailed') {
    return generateAreaPath(zMin, criticalZ.value)
  } else {
    return generateAreaPath(-criticalZ.value, zMax)
  }
})

// Live p-value Shaded Tail Area
const pValueTailPaths = computed<string[]>(() => {
  const paths: string[] = []
  const z = zObs.value

  if (tailMode.value === 'two-tailed') {
    const absZ = Math.abs(z)
    if (absZ < zMax) {
      // Right tail: absZ to +inf
      paths.push(generateAreaPath(absZ, zMax))
      // Left tail: -inf to -absZ
      paths.push(generateAreaPath(zMin, -absZ))
    }
  } else if (tailMode.value === 'right-tailed') {
    if (z < zMax) {
      paths.push(generateAreaPath(z, zMax))
    }
  } else {
    // left-tailed
    if (z > zMin) {
      paths.push(generateAreaPath(zMin, z))
    }
  }
  return paths
})

// Tick marks along baseline
const zTicks = [-3, -2, -1, 0, 1, 2, 3]

// Presets
const setPreset = (preset: 'safe' | 'borderline' | 'significant' | 'extreme') => {
  if (preset === 'safe') {
    zObs.value = 1.20
  } else if (preset === 'borderline') {
    zObs.value = tailMode.value === 'left-tailed' ? -criticalZ.value : criticalZ.value
  } else if (preset === 'significant') {
    zObs.value = tailMode.value === 'left-tailed' ? -2.45 : 2.45
  } else if (preset === 'extreme') {
    zObs.value = tailMode.value === 'left-tailed' ? -3.15 : 3.15
  }
  emitInspection()
}

// Telemetry Inspection emit
const emitInspection = () => {
  emit('inspect', {
    title: 'Hypothesis Testing & Statistical Significance (p-value)',
    details: {
      'Null Hypothesis (H₀)': 'μ = μ₀ (No treatment effect / Pure random fluctuation)',
      'Alternative (H₁)': tailMode.value === 'two-tailed' ? 'μ ≠ μ₀ (Two-tailed difference)' : tailMode.value === 'right-tailed' ? 'μ > μ₀ (Upper tail)' : 'μ < μ₀ (Lower tail)',
      'Significance Level (α)': `${alpha.value} (${(alpha.value * 100).toFixed(0)}% Type I error tolerance)`,
      'Critical Threshold (Z_crit)': tailMode.value === 'two-tailed' ? `±${criticalZ.value.toFixed(3)}` : `${criticalZ.value.toFixed(3)}`,
      'Observed Test Statistic (Z_obs)': zObs.value.toFixed(2),
      'Calculated p-value': pValue.value.toFixed(5),
      'Statistical Decision': isRejected.value ? 'REJECT H₀ (Statistically Significant)' : 'FAIL TO REJECT H₀ (Not Significant)',
      'Core Intuition': 'p-value is P(Data as extreme | H₀ is true), NOT the probability that H₀ is true'
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
    <header class="flex-none mb-1 space-y-1.5">
      <!-- Row 1: Presets & Tail Mode Switcher -->
      <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
        <!-- Preset Scenarios -->
        <div class="flex items-center gap-1.5 flex-wrap">
          <span class="text-muted">Presets:</span>
          <button
            type="button"
            @click="setPreset('safe')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="zObs === 1.20 ? 'bg-slate-700 text-white font-bold border-slate-700 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Safe (Z=1.20, p≈0.23)
          </button>
          <button
            type="button"
            @click="setPreset('borderline')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="Math.abs(zObs) === criticalZ ? 'bg-amber-600 text-white font-bold border-amber-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Borderline (Z=±{{ criticalZ.toFixed(2) }}, p=α)
          </button>
          <button
            type="button"
            @click="setPreset('significant')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="Math.abs(zObs) === 2.45 ? 'bg-rose-600 text-white font-bold border-rose-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Significant (Z=2.45, p≈0.014)
          </button>
          <button
            type="button"
            @click="setPreset('extreme')"
            class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
            :class="Math.abs(zObs) === 3.15 ? 'bg-purple-600 text-white font-bold border-purple-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            Extreme (Z=3.15, p≈0.0016)
          </button>
        </div>

        <!-- Alpha Level Switcher & Tail Direction Selector -->
        <div class="flex items-center gap-2 flex-wrap">
          <!-- Alpha Toggle -->
          <div class="flex items-center gap-1 bg-card px-1.5 py-1 rounded-md border border-line shadow-2xs">
            <span class="text-[10.5px] text-muted mr-1">Significance α:</span>
            <button
              type="button"
              @click="alpha = 0.10; emitInspection()"
              class="px-1.5 py-0.5 rounded text-[10.5px] transition-colors"
              :class="alpha === 0.10 ? 'bg-brand-blue text-white font-bold' : 'text-muted hover:text-ink'"
            >
              0.10 (10%)
            </button>
            <button
              type="button"
              @click="alpha = 0.05; emitInspection()"
              class="px-1.5 py-0.5 rounded text-[10.5px] transition-colors"
              :class="alpha === 0.05 ? 'bg-brand-blue text-white font-bold' : 'text-muted hover:text-ink'"
            >
              0.05 (5%)
            </button>
            <button
              type="button"
              @click="alpha = 0.01; emitInspection()"
              class="px-1.5 py-0.5 rounded text-[10.5px] transition-colors"
              :class="alpha === 0.01 ? 'bg-brand-blue text-white font-bold' : 'text-muted hover:text-ink'"
            >
              0.01 (1%)
            </button>
          </div>

          <!-- Tail Mode Toggle -->
          <div class="flex items-center gap-1 bg-card px-1.5 py-1 rounded-md border border-line shadow-2xs">
            <button
              type="button"
              @click="tailMode = 'two-tailed'; emitInspection()"
              class="px-1.5 py-0.5 rounded text-[10.5px] transition-colors"
              :class="tailMode === 'two-tailed' ? 'bg-purple-600 text-white font-bold' : 'text-muted hover:text-ink'"
            >
              Two-Tailed (≠)
            </button>
            <button
              type="button"
              @click="tailMode = 'right-tailed'; emitInspection()"
              class="px-1.5 py-0.5 rounded text-[10.5px] transition-colors"
              :class="tailMode === 'right-tailed' ? 'bg-purple-600 text-white font-bold' : 'text-muted hover:text-ink'"
            >
              Right-Tailed (&gt;)
            </button>
            <button
              type="button"
              @click="tailMode = 'left-tailed'; emitInspection()"
              class="px-1.5 py-0.5 rounded text-[10.5px] transition-colors"
              :class="tailMode === 'left-tailed' ? 'bg-purple-600 text-white font-bold' : 'text-muted hover:text-ink'"
            >
              Left-Tailed (&lt;)
            </button>
          </div>
        </div>
      </div>

      <!-- Row 2: Observed Z_obs Slider Card -->
      <div class="p-2.5 sm:p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-1 font-mono text-xs">
        <div class="flex items-center justify-between">
          <span class="font-bold text-ink flex items-center gap-1.5">
            <Sliders class="w-3.5 h-3.5 text-brand-blue" />
            Observed Test Statistic:
            <span class="text-brand-blue font-bold px-1.5 py-0.5 rounded bg-brand-blue/10">
              Z_obs = {{ zObs >= 0 ? '+' : '' }}{{ zObs.toFixed(2) }}
            </span>
          </span>

          <div class="flex items-center gap-3 text-[11px]">
            <span class="text-muted">Threshold:</span>
            <span class="font-bold text-ink">Z_crit = {{ tailMode === 'two-tailed' ? '±' : tailMode === 'left-tailed' ? '-' : '+' }}{{ criticalZ.toFixed(2) }}</span>
            <span class="text-muted ml-2">p-value:</span>
            <span
              class="font-bold px-1.5 py-0.5 rounded"
              :class="isRejected ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 font-bold' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold'"
            >
              p = {{ pValue.toFixed(4) }} ({{ (pValue * 100).toFixed(2) }}%)
            </span>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <span class="text-[10px] text-muted font-bold">-3.50</span>
          <input
            v-model.number="zObs"
            type="range"
            min="-3.50"
            max="3.50"
            step="0.05"
            @input="emitInspection"
            class="flex-1 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-brand-blue"
          />
          <span class="text-[10px] text-muted font-bold">+3.50</span>
        </div>
      </div>

      <!-- Dynamic HUD Decision Banner -->
      <div
        class="p-2.5 sm:p-3 rounded-xl border transition-all duration-200 flex items-center justify-between font-mono text-xs shadow-sm"
        :class="isRejected
          ? 'border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-200'
          : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'"
      >
        <div class="flex items-center gap-2.5">
          <component
            :is="isRejected ? XCircle : CheckCircle2"
            class="w-5 h-5 flex-none"
            :class="isRejected ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'"
          />
          <div>
            <div class="font-bold text-[12.5px]">
              {{ isRejected ? 'REJECT H₀ — Statistically Significant Finding!' : 'FAIL TO REJECT H₀ — Retain Null Hypothesis' }}
            </div>
            <div class="text-[11px] opacity-90 mt-0.5">
              {{ isRejected
                ? `p-value (${pValue.toFixed(4)}) < α (${alpha}). Under H₀, the probability of obtaining data this extreme by random chance alone is only ${(pValue * 100).toFixed(2)}%.`
                : `p-value (${pValue.toFixed(4)}) ≥ α (${alpha}). The observed effect is consistent with random chance sampling variability.`
              }}
            </div>
          </div>
        </div>

        <div class="text-right flex-none pl-3 border-l border-current/20 hidden sm:block">
          <div class="text-[10px] uppercase tracking-wider opacity-75">Decision Status</div>
          <div class="font-bold text-[12px]">
            {{ isRejected ? 'Significant (p < α)' : 'Insignificant (p ≥ α)' }}
          </div>
        </div>
      </div>
    </header>

    <!-- Main SVG Visualization Canvas -->
    <main class="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm p-2 sm:p-3">
      <!-- Title & Live Legend Ribbon -->
      <div class="w-full flex items-center justify-between text-xs font-mono mb-1 flex-none px-1">
        <span class="font-bold text-ink flex items-center gap-1.5">
          <Activity class="w-3.5 h-3.5 text-brand-blue" />
          Sampling Distribution Under H₀ (Null Hypothesis: μ = μ₀)
        </span>
        <div class="flex items-center gap-3 text-[10.5px]">
          <span class="flex items-center gap-1 text-rose-600 dark:text-rose-400">
            <span class="w-2.5 h-2.5 rounded-sm bg-rose-500/30 border border-rose-500 inline-block"></span>
            Critical Rejection Region (α = {{ alpha }})
          </span>
          <span class="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold">
            <span class="w-2.5 h-2.5 rounded-sm bg-amber-500/40 border border-amber-500 inline-block"></span>
            Live p-value Area (p = {{ pValue.toFixed(4) }})
          </span>
        </div>
      </div>

      <!-- Chart Container: Fully visible, responsive, zero clipping -->
      <div class="w-full flex-1 flex items-center justify-center py-2 px-2 sm:px-4">
        <div class="w-full max-w-4xl aspect-[16/10] relative flex items-center justify-center">
          <svg
            viewBox="0 0 800 500"
            preserveAspectRatio="xMidYMid meet"
            class="w-full h-full block"
          >
            <!-- Background Area -->
            <rect
              :x="MARGIN.left"
              :y="MARGIN.top"
              :width="plotWidth"
              :height="plotHeight"
              fill="rgba(240, 244, 248, 0.15)"
              stroke="none"
            />

            <!-- 1. Central Non-Rejection Region (Safe Zone) -->
            <path
              :d="nonRejectionPath"
              fill="rgba(99, 102, 241, 0.10)"
            />

            <!-- 2. Critical Alpha Rejection Tails (Rose Red) -->
            <g v-if="showAlphaArea">
              <!-- Left Alpha Tail -->
              <path
                v-if="alphaLeftTailPath"
                :d="alphaLeftTailPath"
                fill="rgba(244, 63, 94, 0.28)"
              />
              <!-- Right Alpha Tail -->
              <path
                v-if="alphaRightTailPath"
                :d="alphaRightTailPath"
                fill="rgba(244, 63, 94, 0.28)"
              />
            </g>

            <!-- 3. Observed p-value Area (Amber Hatch/Solid) -->
            <g v-if="showPValueArea">
              <path
                v-for="(pPath, idx) in pValueTailPaths"
                :key="'pval-tail-' + idx"
                :d="pPath"
                fill="rgba(245, 158, 11, 0.35)"
                stroke="#d97706"
                stroke-width="1"
                stroke-dasharray="3 2"
              />
            </g>

            <!-- 4. Bell Curve Outline (N(0, 1)) -->
            <path
              :d="fullCurvePath"
              fill="none"
              stroke="#2563eb"
              stroke-width="2.5"
              stroke-linejoin="round"
              stroke-linecap="round"
            />

            <!-- 5. Vertical Critical Value Boundaries (Z_crit) -->
            <!-- Two-tailed or Left-tailed: Negative boundary -->
            <g v-if="tailMode === 'two-tailed' || tailMode === 'left-tailed'">
              <line
                :x1="scaleX(-criticalZ)"
                :y1="scaleY(stdNormalPdf(-criticalZ))"
                :x2="scaleX(-criticalZ)"
                :y2="baselineY"
                stroke="#e11d48"
                stroke-width="2"
                stroke-dasharray="4 3"
              />
              <circle
                :cx="scaleX(-criticalZ)"
                :cy="scaleY(stdNormalPdf(-criticalZ))"
                r="3.5"
                fill="#e11d48"
              />
              <!-- Annotation text above boundary -->
              <text
                :x="scaleX(-criticalZ)"
                :y="scaleY(stdNormalPdf(-criticalZ)) - 8"
                text-anchor="middle"
                font-family="monospace"
                font-size="9.5"
                font-weight="bold"
                fill="#e11d48"
              >
                -Z_crit ({{ (-criticalZ).toFixed(2) }})
              </text>
              <text
                :x="scaleX(-criticalZ) - 12"
                :y="baselineY - 14"
                text-anchor="end"
                font-family="monospace"
                font-size="8.5"
                fill="#e11d48"
                font-weight="bold"
              >
                {{ tailMode === 'two-tailed' ? `α/2 = ${(alpha/2).toFixed(3)}` : `α = ${alpha}` }}
              </text>
            </g>

            <!-- Two-tailed or Right-tailed: Positive boundary -->
            <g v-if="tailMode === 'two-tailed' || tailMode === 'right-tailed'">
              <line
                :x1="scaleX(criticalZ)"
                :y1="scaleY(stdNormalPdf(criticalZ))"
                :x2="scaleX(criticalZ)"
                :y2="baselineY"
                stroke="#e11d48"
                stroke-width="2"
                stroke-dasharray="4 3"
              />
              <circle
                :cx="scaleX(criticalZ)"
                :cy="scaleY(stdNormalPdf(criticalZ))"
                r="3.5"
                fill="#e11d48"
              />
              <!-- Annotation text above boundary -->
              <text
                :x="scaleX(criticalZ)"
                :y="scaleY(stdNormalPdf(criticalZ)) - 8"
                text-anchor="middle"
                font-family="monospace"
                font-size="9.5"
                font-weight="bold"
                fill="#e11d48"
              >
                +Z_crit (+{{ criticalZ.toFixed(2) }})
              </text>
              <text
                :x="scaleX(criticalZ) + 12"
                :y="baselineY - 14"
                text-anchor="start"
                font-family="monospace"
                font-size="8.5"
                fill="#e11d48"
                font-weight="bold"
              >
                {{ tailMode === 'two-tailed' ? `α/2 = ${(alpha/2).toFixed(3)}` : `α = ${alpha}` }}
              </text>
            </g>

            <!-- 6. Mean Center Line (Z = 0) -->
            <line
              :x1="scaleX(0)"
              :y1="scaleY(0.3989)"
              :x2="scaleX(0)"
              :y2="baselineY"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-dasharray="2 3"
              class="text-line"
            />
            <text
              :x="scaleX(0)"
              :y="scaleY(0.3989) - 8"
              text-anchor="middle"
              font-family="monospace"
              font-size="9.5"
              font-weight="bold"
              fill="currentColor"
              class="text-muted"
            >
              H₀ Mean (Z = 0)
            </text>

            <!-- 7. Observed Test Statistic Needle (Z_obs) -->
            <g>
              <!-- Vertical probe line -->
              <line
                :x1="scaleX(zObs)"
                :y1="scaleY(stdNormalPdf(zObs))"
                :x2="scaleX(zObs)"
                :y2="baselineY"
                :stroke="isRejected ? '#e11d48' : '#059669'"
                stroke-width="2.5"
              />

              <!-- Glowing beacon ring on curve -->
              <circle
                :cx="scaleX(zObs)"
                :cy="scaleY(stdNormalPdf(zObs))"
                r="7"
                :fill="isRejected ? 'rgba(225, 29, 72, 0.25)' : 'rgba(16, 185, 129, 0.25)'"
                :stroke="isRejected ? '#e11d48' : '#059669'"
                stroke-width="1.5"
              />
              <circle
                :cx="scaleX(zObs)"
                :cy="scaleY(stdNormalPdf(zObs))"
                r="3.5"
                :fill="isRejected ? '#e11d48' : '#059669'"
              />

              <!-- Pin Beacon at baseline -->
              <circle
                :cx="scaleX(zObs)"
                :cy="baselineY"
                r="4.5"
                :fill="isRejected ? '#e11d48' : '#059669'"
                stroke="#ffffff"
                stroke-width="1.5"
              />

              <!-- Badge Callout floating above needle -->
              <g :transform="`translate(${Math.max(MARGIN.left + 50, Math.min(scaleX(zObs), SVG_WIDTH - MARGIN.right - 50))}, ${Math.max(MARGIN.top + 20, scaleY(stdNormalPdf(zObs)) - 28)})`">
                <rect
                  x="-48"
                  y="-16"
                  width="96"
                  height="22"
                  rx="5"
                  :fill="isRejected ? '#be123c' : '#047857'"
                  stroke="#ffffff"
                  stroke-width="1"
                  filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"
                />
                <text
                  x="0"
                  y="-1.5"
                  text-anchor="middle"
                  font-family="monospace"
                  font-size="9.5"
                  font-weight="bold"
                  fill="#ffffff"
                >
                  Z_obs = {{ zObs >= 0 ? '+' : '' }}{{ zObs.toFixed(2) }}
                </text>
              </g>
            </g>

            <!-- 8. Baseline & Tick Marks (Baseline at y=430) -->
            <line
              :x1="MARGIN.left"
              :y1="baselineY"
              :x2="SVG_WIDTH - MARGIN.right"
              :y2="baselineY"
              stroke="currentColor"
              stroke-width="1.8"
              class="text-line"
            />

            <!-- Z-score Ticks & Numerical Labels -->
            <g v-for="t in zTicks" :key="'ztick-' + t">
              <line
                :x1="scaleX(t)"
                :y1="baselineY"
                :x2="scaleX(t)"
                :y2="baselineY + 7"
                stroke="currentColor"
                stroke-width="1.5"
                class="text-line"
              />
              <text
                :x="scaleX(t)"
                :y="baselineY + 20"
                text-anchor="middle"
                font-family="monospace"
                font-size="10"
                font-weight="bold"
                fill="currentColor"
                class="text-ink"
              >
                {{ t > 0 ? '+' + t : t }}
              </text>
            </g>

            <!-- Axis Title -->
            <text
              :x="SVG_WIDTH / 2"
              :y="baselineY + 36"
              text-anchor="middle"
              font-family="monospace"
              font-size="11"
              font-weight="bold"
              fill="currentColor"
              class="text-ink"
            >
              Standardized Test Statistic Z = (X̄ - μ₀) / (σ / √n)
            </text>

            <!-- 9. Zone Annotation Bars below baseline (70px clearance) -->
            <!-- Safe Zone Annotation -->
            <rect
              :x="scaleX(-criticalZ)"
              :y="baselineY + 44"
              :width="scaleX(criticalZ) - scaleX(-criticalZ)"
              height="16"
              rx="3"
              fill="rgba(99, 102, 241, 0.12)"
              stroke="rgba(99, 102, 241, 0.3)"
              stroke-width="1"
            />
            <text
              :x="scaleX(0)"
              :y="baselineY + 55.5"
              text-anchor="middle"
              font-family="monospace"
              font-size="8.5"
              font-weight="bold"
              fill="#4f46e5"
            >
              Non-Rejection Zone: Fail to Reject H₀ (Area = {{ (1 - alpha).toFixed(2) }})
            </text>

            <!-- Left Rejection Region Tag -->
            <g v-if="tailMode === 'two-tailed' || tailMode === 'left-tailed'">
              <rect
                :x="scaleX(-3.8)"
                :y="baselineY + 44"
                :width="scaleX(-criticalZ) - scaleX(-3.8) - 4"
                height="16"
                rx="3"
                fill="rgba(244, 63, 94, 0.15)"
                stroke="rgba(244, 63, 94, 0.4)"
                stroke-width="1"
              />
              <text
                :x="(scaleX(-3.8) + scaleX(-criticalZ)) / 2"
                :y="baselineY + 55.5"
                text-anchor="middle"
                font-family="monospace"
                font-size="8.5"
                font-weight="bold"
                fill="#e11d48"
              >
                Reject H₀
              </text>
            </g>

            <!-- Right Rejection Region Tag -->
            <g v-if="tailMode === 'two-tailed' || tailMode === 'right-tailed'">
              <rect
                :x="scaleX(criticalZ) + 4"
                :y="baselineY + 44"
                :width="scaleX(3.8) - scaleX(criticalZ) - 4"
                height="16"
                rx="3"
                fill="rgba(244, 63, 94, 0.15)"
                stroke="rgba(244, 63, 94, 0.4)"
                stroke-width="1"
              />
              <text
                :x="(scaleX(criticalZ) + scaleX(3.8)) / 2"
                :y="baselineY + 55.5"
                text-anchor="middle"
                font-family="monospace"
                font-size="8.5"
                font-weight="bold"
                fill="#e11d48"
              >
                Reject H₀
              </text>
            </g>
          </svg>
        </div>
      </div>
    </main>

    <!-- Mathematical Foundations & Conceptual Walkthrough (2-Column Grid) -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mt-0.5">
      <!-- 1. The Real Meaning of a p-value -->
      <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm space-y-2 font-mono text-xs">
        <div class="flex items-center gap-1.5 font-bold text-ink">
          <Scale class="w-3.5 h-3.5 text-brand-blue" />
          The Geometric & Logical Intuition of p-value
        </div>
        <p class="text-[11px] text-muted leading-relaxed">
          The <strong>p-value</strong> is the exact area in the tail(s) of the null distribution beyond the observed test statistic $Z_{\text{obs}}$:
        </p>

        <div class="p-2 rounded bg-card border border-line text-[11px] space-y-1">
          <div class="flex justify-between items-center">
            <span class="text-muted">Observed Statistic:</span>
            <span class="font-bold text-ink">Z_obs = {{ zObs >= 0 ? '+' : '' }}{{ zObs.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-muted">Critical Boundary:</span>
            <span class="font-bold text-rose-600 dark:text-rose-400">Z_crit = ±{{ criticalZ.toFixed(2) }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-muted">Live p-value:</span>
            <span
              class="font-bold"
              :class="isRejected ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'"
            >
              p = {{ pValue.toFixed(4) }} ({{ isRejected ? 'p < α' : 'p ≥ α' }})
            </span>
          </div>
        </div>

        <div class="text-[10.5px] text-amber-800 dark:text-amber-200 bg-amber-500/10 p-2 rounded border border-amber-500/25 flex items-start gap-1.5">
          <AlertTriangle class="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-none mt-0.5" />
          <span>
            <strong>Crucial Distinction:</strong> A p-value is <em>not</em> $P(H_0 \text{ is true})$. It is the conditional probability $P(\text{Data as or more extreme} \mid H_0 \text{ is true})$.
          </span>
        </div>
      </div>

      <!-- 2. Type I vs. Type II Errors & Decision Matrix -->
      <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm space-y-2 font-mono text-xs">
        <div class="flex items-center gap-1.5 font-bold text-ink">
          <Layers class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
          Statistical Decision Matrix (Alpha vs. Beta)
        </div>
        <p class="text-[11px] text-muted leading-relaxed">
          Significance level $\alpha$ controls your willingness to make a False Alarm (Type I error):
        </p>

        <div class="border border-line rounded overflow-hidden text-[10.5px]">
          <div class="grid grid-cols-3 bg-card-subtle font-bold border-b border-line text-center py-1">
            <span class="text-muted">Truth \ Decision</span>
            <span class="text-emerald-700 dark:text-emerald-400">Retain H₀</span>
            <span class="text-rose-700 dark:text-rose-400">Reject H₀</span>
          </div>
          <div class="grid grid-cols-3 border-b border-line/50 text-center py-1 px-1">
            <span class="font-bold text-muted text-left pl-1">H₀ is True</span>
            <span class="text-emerald-600 dark:text-emerald-400 font-medium">Correct (1 - α)</span>
            <span class="text-rose-600 dark:text-rose-400 font-bold bg-rose-500/10 rounded">Type I Error (α)</span>
          </div>
          <div class="grid grid-cols-3 text-center py-1 px-1">
            <span class="font-bold text-muted text-left pl-1">H₀ is False</span>
            <span class="text-amber-600 dark:text-amber-400 font-bold bg-amber-500/10 rounded">Type II Error (β)</span>
            <span class="text-emerald-600 dark:text-emerald-400 font-bold">Power (1 - β)</span>
          </div>
        </div>

        <div class="text-[10.5px] text-muted flex items-center gap-1.5 pt-0.5">
          <Info class="w-3.5 h-3.5 text-brand-blue flex-none" />
          <span>Lowering $\alpha$ (e.g. from $0.05$ to $0.01$) protects against Type I errors but raises Type II error rate $\beta$.</span>
        </div>
      </div>
    </div>

    <!-- Scikit-Learn & SciPy Code Reference -->
    <div class="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-sm space-y-1 font-mono text-xs">
      <span class="text-[10px] text-muted uppercase font-bold tracking-wider">
        SciPy Production Hypothesis Testing Formulation:
      </span>
      <pre class="text-[11px] text-ink whitespace-pre-wrap bg-card-subtle p-2.5 rounded border border-line/40">import numpy as np
from scipy import stats

# 1. Independent Two-Sample t-test (A/B Testing)
control = np.array([21.4, 23.1, 19.8, 22.5, 20.9, 21.8, 22.2])
treatment = np.array([24.5, 26.1, 23.8, 25.0, 24.2, 25.7, 24.9])

# Conduct two-tailed Welch's t-test (unequal variances assumed)
t_stat, p_value = stats.ttest_ind(treatment, control, equal_var=False)

alpha = 0.05
print(f"t-statistic: {t_stat:.4f} | p-value: {p_value:.5f}")

if p_value &lt; alpha:
    print(f"REJECT H0: Statistically significant treatment effect (p &lt; {alpha})")
else:
    print(f"FAIL TO REJECT H0: No statistically significant difference (p &gt;= {alpha})")</pre>
    </div>
  </div>
</template>

