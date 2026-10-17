<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  ArrowDown,
  ArrowRight,
  Play,
  RotateCcw,
  StepForward,
  Zap,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Table
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Base Dataset (4 rows x 3 columns) -------------------------------------
const colNames = ['A', 'B', 'C']
const rowLabels = [0, 1, 2, 3]

const matrixData = [
  [20, 50, 80],
  [40, 70, 10],
  [60, 30, 90],
  [80, 50, 40]
]

// Precomputed reductions:
// axis=0: mean of each column -> [50.0, 50.0, 55.0]
const colMeans = [50.0, 50.0, 55.0]

// axis=1: sum of each row -> [150, 120, 180, 170]
const rowSums = [150, 120, 180, 170]

// --- State -----------------------------------------------------------------
type AxisType = 0 | 1
const activeAxis = ref<AxisType>(0)

// For axis=1 stepping: row index currently processed (0 to 4; 4 = done)
const activeRowStep = ref<number>(0)
const isPlaying = ref(false)
let playTimer: ReturnType<typeof setInterval> | null = null

// Selected Cell for interactive inspection
const selectedCell = ref<{ r: number; c: number } | null>(null)

// Mode metadata
const modeConfig = computed(() => {
  if (activeAxis.value === 0) {
    return {
      title: 'df.apply(np.mean, axis=0) — Down Columns',
      syntax: 'df.apply(np.mean, axis=0)',
      direction: 'Vertical Sweep ↓ (Collapses rows along Axis 0)',
      engine: 'C-Vectorized SIMD (Simultaneous Column Evaluation)',
      returnType: 'pd.Series (length 3, index=[A, B, C])',
      perfTag: 'C-Speed / Vectorized (Zero Python loop overhead)',
      perfColor: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
      description: 'axis=0 applies the function to each column Series at once. Underlying contiguous NumPy arrays are passed directly to C-level vectorized routines.'
    }
  } else {
    return {
      title: 'df.apply(custom_func, axis=1) — Across Rows',
      syntax: 'df.apply(lambda r: r.sum(), axis=1)',
      direction: 'Horizontal Iteration → (Evaluates row-by-row along Axis 1)',
      engine: 'Interpreted Python Loop (Sequential Row Series Boxing)',
      returnType: 'pd.Series (length 4, index=[0, 1, 2, 3])',
      perfTag: 'Slow Python Row Loop — Consider vectorized arithmetic df[\'A\'] + df[\'B\']!',
      perfColor: 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30',
      description: 'axis=1 boxes each row into a brand new pd.Series object in Python memory and calls the Python lambda once per row. Avoid in performance-critical code!'
    }
  }
})

// Inspection telemetry
const emitInspection = () => {
  const cfg = modeConfig.value
  const details: Record<string, any> = {
    'Invocation': cfg.syntax,
    'Axis Direction': `axis=${activeAxis.value} (${activeAxis.value === 0 ? 'Down Columns / Collapse Rows' : 'Across Rows / Python Loop'})`,
    'Execution Engine': cfg.engine,
    'Result Structure': cfg.returnType,
    'Performance Profile': cfg.perfTag,
    'Architectural Insight': cfg.description
  }

  if (activeAxis.value === 1) {
    details['Row Worker Progress'] = `Row ${activeRowStep.value} of 4 processed`
    if (activeRowStep.value < 4) {
      const r = activeRowStep.value
      details['Active Row Vector'] = `row_${r}: {A: ${matrixData[r][0]}, B: ${matrixData[r][1]}, C: ${matrixData[r][2]}} -> sum = ${rowSums[r]}`
    }
  } else {
    details['Column Means'] = `A: ${colMeans[0]}, B: ${colMeans[1]}, C: ${colMeans[2]}`
  }

  emit('inspect', {
    title: `Apply Axis: axis=${activeAxis.value}`,
    details
  })
}

// Actions
const setAxis = (axis: AxisType) => {
  activeAxis.value = axis
  activeRowStep.value = 0
  isPlaying.value = false
  if (playTimer) clearInterval(playTimer)
  emitInspection()
}

const stepRowWorker = () => {
  if (activeRowStep.value < 4) {
    activeRowStep.value++
  } else {
    activeRowStep.value = 0
  }
  emitInspection()
}

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) {
    if (activeRowStep.value >= 4) activeRowStep.value = 0
    playTimer = setInterval(() => {
      if (activeRowStep.value < 4) {
        activeRowStep.value++
        emitInspection()
      } else {
        isPlaying.value = false
        if (playTimer) clearInterval(playTimer)
      }
    }, 1000)
  } else if (playTimer) {
    clearInterval(playTimer)
  }
}

const resetSimulation = () => {
  isPlaying.value = false
  if (playTimer) clearInterval(playTimer)
  activeRowStep.value = 0
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
      <!-- Axis Mode Switchers -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          @click="setAxis(0)"
          class="px-3 py-1.5 rounded-md border transition-all text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer"
          :class="activeAxis === 0 ? 'bg-brand-blue text-white border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink hover:bg-card-subtle'"
        >
          <ArrowDown class="w-3.5 h-3.5" />
          <span>axis=0 (Down Columns • Vectorized)</span>
        </button>

        <button
          type="button"
          @click="setAxis(1)"
          class="px-3 py-1.5 rounded-md border transition-all text-xs font-bold shadow-2xs flex items-center gap-1.5 cursor-pointer"
          :class="activeAxis === 1 ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs' : 'bg-card border-line text-muted hover:text-ink hover:bg-card-subtle'"
        >
          <ArrowRight class="w-3.5 h-3.5" />
          <span>axis=1 (Across Rows • Python Loop)</span>
        </button>
      </div>

      <!-- Performance Indicator Badge -->
      <div
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono text-xs shadow-2xs font-bold"
        :class="modeConfig.perfColor"
      >
        <Zap v-if="activeAxis === 0" class="w-3.5 h-3.5 text-emerald-500" />
        <AlertTriangle v-else class="w-3.5 h-3.5 text-amber-500" />
        <span>{{ activeAxis === 0 ? 'C-Vectorized' : 'Python Loop Warning' }}</span>
      </div>
    </div>

    <!-- Main Workspace Container -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <!-- 1. AXIS = 0: COLUMN-WISE REDUCTION (Down Columns) -->
      <div v-if="activeAxis === 0" class="flex flex-col gap-4 items-center w-full animate-fade-in">
        <!-- Operation Formula Callout -->
        <div class="flex items-center gap-2 text-xs font-mono bg-card px-3 py-1.5 rounded-full border border-line shadow-2xs">
          <ArrowDown class="w-3.5 h-3.5 text-brand-blue" />
          <span class="text-muted">Vertical Vectorized Operation:</span>
          <code class="text-brand-blue font-bold">df.apply(np.mean, axis=0)</code>
        </div>

        <div class="overflow-x-auto max-w-full">
          <table class="dataframe">
            <thead>
              <tr>
                <th class="bg-card-subtle text-muted text-[10px] text-left pr-3">index</th>
                <th v-for="col in colNames" :key="'col-0-' + col" class="text-center font-bold px-4">
                  <div class="flex flex-col items-center">
                    <span>{{ col }}</span>
                    <ArrowDown class="w-3 h-3 text-brand-blue animate-bounce mt-0.5" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rIdx) in matrixData" :key="'row-0-' + rIdx" class="hover:bg-blue-50/40 dark:hover:bg-blue-950/20">
                <th class="text-left font-bold text-muted">{{ rIdx }}</th>
                <td v-for="(val, cIdx) in row" :key="'cell-0-' + rIdx + '-' + cIdx" class="text-right font-mono text-xs px-4">
                  {{ val }}
                </td>
              </tr>
              <!-- Collapsed Summary Row at Bottom (axis=0 Output) -->
              <tr class="border-t-2 border-brand-blue bg-blue-50/80 dark:bg-blue-950/60 font-bold">
                <th class="text-left font-bold text-brand-blue">mean ↓</th>
                <td v-for="(meanVal, cIdx) in colMeans" :key="'mean-' + cIdx" class="text-right font-mono text-xs text-brand-blue font-bold px-4">
                  {{ meanVal.toFixed(1) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Resulting Series Card -->
        <div class="w-full max-w-md rounded-md border border-line bg-card p-3 shadow-2xs font-mono text-xs flex items-center justify-between">
          <div class="flex flex-col">
            <span class="text-muted text-[11px]">Resulting Output Series:</span>
            <span class="font-bold text-brand-blue">Series([50.0, 50.0, 55.0], index=['A', 'B', 'C'])</span>
          </div>
          <span class="text-[10px] px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold">
            Vectorized (C-Speed)
          </span>
        </div>
      </div>

      <!-- 2. AXIS = 1: ROW-BY-ROW ITERATION (Across Rows) -->
      <div v-else class="flex flex-col gap-4 items-center w-full animate-fade-in">
        <!-- Operation Formula Callout -->
        <div class="flex items-center gap-2 text-xs font-mono bg-card px-3 py-1.5 rounded-full border border-line shadow-2xs">
          <ArrowRight class="w-3.5 h-3.5 text-amber-500" />
          <span class="text-muted">Horizontal Row Loop:</span>
          <code class="text-amber-600 dark:text-amber-400 font-bold">df.apply(lambda r: r.sum(), axis=1)</code>
        </div>

        <div class="overflow-x-auto max-w-full">
          <table class="dataframe">
            <thead>
              <tr>
                <th class="bg-card-subtle text-muted text-[10px] text-left pr-3">index</th>
                <th v-for="col in colNames" :key="'col-1-' + col" class="text-center font-bold px-4">
                  {{ col }}
                </th>
                <!-- Result Column added on Right -->
                <th class="bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold border-l-2 border-amber-500 px-4">
                  <div class="flex items-center gap-1 justify-center">
                    <span>row_sum →</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, rIdx) in matrixData"
                :key="'row-1-' + rIdx"
                class="transition-all"
                :class="[
                  activeRowStep === rIdx
                    ? 'bg-amber-500/20 ring-2 ring-amber-400 font-bold'
                    : activeRowStep > rIdx
                    ? 'bg-amber-500/5'
                    : 'opacity-60'
                ]"
              >
                <!-- Row Index + Python Worker Pin -->
                <th class="text-left font-bold" :class="activeRowStep === rIdx ? 'text-amber-800 dark:text-amber-300' : 'text-muted'">
                  <div class="flex items-center gap-1.5">
                    <span>{{ rIdx }}</span>
                    <span v-if="activeRowStep === rIdx" class="text-[9px] px-1 py-0.2 rounded bg-amber-500 text-slate-950 font-bold animate-pulse">
                      worker
                    </span>
                  </div>
                </th>

                <!-- Data Cells -->
                <td v-for="(val, cIdx) in row" :key="'cell-1-' + rIdx + '-' + cIdx" class="text-right font-mono text-xs px-4">
                  {{ val }}
                </td>

                <!-- Computed Row Sum Cell -->
                <td
                  class="text-right font-mono text-xs border-l-2 border-amber-500 font-bold px-4"
                  :class="activeRowStep >= rIdx ? 'text-amber-700 dark:text-amber-300 bg-amber-500/10' : 'text-muted italic'"
                >
                  <span v-if="activeRowStep >= rIdx">{{ rowSums[rIdx] }}</span>
                  <span v-else>--</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Row Worker Controller for Axis=1 -->
        <div class="flex items-center justify-between w-full max-w-md bg-card p-2.5 rounded-md border border-line shadow-2xs font-mono text-xs">
          <div class="flex items-center gap-1.5">
            <button
              type="button"
              @click="resetSimulation"
              class="p-1 rounded border border-line bg-card hover:bg-card-subtle text-muted hover:text-ink"
              title="Reset worker"
            >
              <RotateCcw class="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              @click="stepRowWorker"
              class="px-2.5 py-1 rounded border border-line bg-card hover:bg-card-subtle text-ink font-semibold flex items-center gap-1"
            >
              <StepForward class="w-3.5 h-3.5" />
              <span>Step Row</span>
            </button>
            <button
              type="button"
              @click="togglePlay"
              class="px-3 py-1 rounded font-bold flex items-center gap-1 shadow-xs"
              :class="isPlaying ? 'bg-amber-500 text-slate-950' : 'bg-brand-blue text-white'"
            >
              <Play class="w-3.5 h-3.5" />
              <span>{{ isPlaying ? 'Pause' : 'Run Loop' }}</span>
            </button>
          </div>
          <span class="text-muted text-[11px]">
            Row: {{ Math.min(4, activeRowStep) }} / 4
          </span>
        </div>
      </div>

      <!-- Bottom Architectural Invariant Footer -->
      <div class="mt-4 pt-3 border-t border-line/60 flex items-center justify-between gap-3 text-xs font-mono flex-wrap">
        <div class="flex items-center gap-2 text-muted">
          <span class="w-2 h-2 rounded-full" :class="activeAxis === 0 ? 'bg-emerald-500' : 'bg-amber-500'" />
          <span class="text-ink font-semibold">Axis Rule of Thumb:</span>
          <span>{{ activeAxis === 0 ? "axis=0 collapses down rows into a summary Series indexed by column names." : "axis=1 loops over rows. Avoid axis=1 when a vectorized alternative (e.g. df['A'] + df['B']) exists!" }}</span>
        </div>
      </div>
    </div>

    <!-- Educational HUD Footer Bar -->
    <div class="rounded-lg border border-line bg-card p-3 shadow-2xs font-mono text-xs flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 text-muted">
        <Sparkles class="w-4 h-4 text-brand-blue shrink-0" />
        <span>Execution Paradigm:</span>
        <span class="text-ink font-semibold">
          {{ modeConfig.description }}
        </span>
      </div>

      <div class="text-ink font-bold bg-card-subtle px-2 py-0.5 rounded border border-line">
        Output: {{ modeConfig.returnType }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.dataframe {
  border-collapse: collapse;
  margin: 0 auto;
}
</style>
