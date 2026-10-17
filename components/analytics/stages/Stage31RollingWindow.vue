<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Sliders,
  Play,
  RotateCcw,
  StepForward,
  Layers,
  Calculator,
  Info,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  AlertCircle
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Data Models -----------------------------------------------------------
interface TimePoint {
  date: string
  price: number
}

const seriesData: TimePoint[] = [
  { date: '2024-02-01', price: 100 },
  { date: '2024-02-02', price: 104 },
  { date: '2024-02-03', price: 102 },
  { date: '2024-02-04', price: 110 },
  { date: '2024-02-05', price: 108 },
  { date: '2024-02-06', price: 115 },
  { date: '2024-02-07', price: 120 },
  { date: '2024-02-08', price: 118 }
]

// --- State -----------------------------------------------------------------
const windowSize = ref(3) // W in [2, 3, 4]
const minPeriods = ref<1 | null>(null) // null = default W, 1 = min_periods=1
type StatFunc = 'mean' | 'sum' | 'std'
const statFunc = ref<StatFunc>('mean')

// Sliding animation pointer: row index t from 0 to N-1
const activeIdx = ref(2)
const isPlaying = ref(false)
let playTimer: ReturnType<typeof setInterval> | null = null

// --- Computeds -------------------------------------------------------------
interface ComputedRow {
  date: string
  price: number
  inCurrentWindow: boolean
  isWindowHead: boolean
  computedVal: number | null
  windowItems: number[]
  isNan: boolean
}

const rollingRows = computed<ComputedRow[]>(() => {
  return seriesData.map((item, idx) => {
    // Window covers [max(0, idx - windowSize + 1) .. idx]
    const startIdx = Math.max(0, idx - windowSize.value + 1)
    const items = seriesData.slice(startIdx, idx + 1).map(d => d.price)
    const requiredCount = minPeriods.value ?? windowSize.value
    const isNan = items.length < requiredCount

    let computedVal: number | null = null
    if (!isNan) {
      if (statFunc.value === 'mean') {
        computedVal = Number((items.reduce((a, b) => a + b, 0) / items.length).toFixed(2))
      } else if (statFunc.value === 'sum') {
        computedVal = Number(items.reduce((a, b) => a + b, 0).toFixed(2))
      } else if (statFunc.value === 'std') {
        if (items.length <= 1) {
          computedVal = 0
        } else {
          const m = items.reduce((a, b) => a + b, 0) / items.length
          const variance = items.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / (items.length - 1)
          computedVal = Number(Math.sqrt(variance).toFixed(2))
        }
      }
    }

    const curStart = Math.max(0, activeIdx.value - windowSize.value + 1)
    const inCurrentWindow = idx >= curStart && idx <= activeIdx.value
    const isWindowHead = idx === activeIdx.value

    return {
      date: item.date,
      price: item.price,
      inCurrentWindow,
      isWindowHead,
      computedVal,
      windowItems: items,
      isNan
    }
  })
})

const activeWindowItems = computed(() => {
  const startIdx = Math.max(0, activeIdx.value - windowSize.value + 1)
  return seriesData.slice(startIdx, activeIdx.value + 1).map(d => d.price)
})

const activeWindowIsNan = computed(() => {
  const req = minPeriods.value ?? windowSize.value
  return activeWindowItems.value.length < req
})

const activeFormulaText = computed(() => {
  const items = activeWindowItems.value
  const req = minPeriods.value ?? windowSize.value
  if (items.length < req) {
    return `Insufficient observations (${items.length} < min_periods=${req}) → NaN`
  }
  if (statFunc.value === 'mean') {
    return `(${items.join(' + ')}) / ${items.length} = ${(items.reduce((a, b) => a + b, 0) / items.length).toFixed(2)}`
  } else if (statFunc.value === 'sum') {
    return `${items.join(' + ')} = ${items.reduce((a, b) => a + b, 0)}`
  } else {
    return `Sample std of [${items.join(', ')}]`
  }
})

const activeCodeSnippet = computed(() => {
  const mpArg = minPeriods.value ? `, min_periods=1` : ''
  return `# Sliding Window Calculation
df['rolling_${statFunc.value}'] = df['price'].rolling(window=${windowSize.value}${mpArg}).${statFunc.value}()`
})

// --- Methods ---------------------------------------------------------------
const emitInspection = () => {
  const currentRow = rollingRows.value[activeIdx.value]
  emit('inspect', {
    title: `s.rolling(${windowSize.value}).${statFunc.value}()`,
    details: {
      'Window Size (W)': windowSize.value,
      'Active Row (t)': activeIdx.value,
      'Date': currentRow.date,
      'min_periods': minPeriods.value ?? windowSize.value,
      'Window Slice': `[${Math.max(0, activeIdx.value - windowSize.value + 1)}:${activeIdx.value + 1}]`,
      'Window Items': `[${activeWindowItems.value.join(', ')}]`,
      'Result Value': activeWindowIsNan.value ? 'NaN' : currentRow.computedVal,
      'NaN Invariant': `${windowSize.value - (minPeriods.value ?? windowSize.value)} initial NaNs expected`
    }
  })
}

const setActiveRow = (idx: number) => {
  activeIdx.value = idx
  emitInspection()
}

const nextStep = () => {
  if (activeIdx.value < seriesData.length - 1) {
    activeIdx.value++
  } else {
    activeIdx.value = 0
  }
  emitInspection()
}

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) {
    if (activeIdx.value >= seriesData.length - 1) activeIdx.value = 0
    playTimer = setInterval(() => {
      if (activeIdx.value < seriesData.length - 1) {
        activeIdx.value++
        emitInspection()
      } else {
        isPlaying.value = false
        if (playTimer) clearInterval(playTimer)
      }
    }, 1200)
  } else if (playTimer) {
    clearInterval(playTimer)
  }
}

const resetSimulation = () => {
  isPlaying.value = false
  if (playTimer) clearInterval(playTimer)
  activeIdx.value = windowSize.value - 1
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
      <!-- Window Size Controls -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">window (W):</span>
        <button
          v-for="w in [2, 3, 4, 5]"
          :key="w"
          type="button"
          @click="windowSize = w; resetSimulation()"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="windowSize === w ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          W={{ w }}
        </button>

        <span class="text-line mx-1">|</span>

        <!-- min_periods Toggle -->
        <span class="text-muted">min_periods:</span>
        <button
          type="button"
          @click="minPeriods = null; emitInspection()"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="minPeriods === null ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
          title="Default: Requires full window W before calculating"
        >
          None ({{ windowSize }})
        </button>
        <button
          type="button"
          @click="minPeriods = 1; emitInspection()"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="minPeriods === 1 ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500 font-bold' : 'bg-card border-line text-muted hover:text-ink'"
          title="min_periods=1: Computes with available entries (No initial NaNs)"
        >
          1 (No NaNs)
        </button>

        <span class="text-line mx-1">|</span>

        <!-- Statistic Method -->
        <button
          type="button"
          @click="statFunc = 'mean'; emitInspection()"
          class="px-2 py-0.5 rounded border text-[11px]"
          :class="statFunc === 'mean' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border-emerald-500/40' : 'bg-card border-line text-muted'"
        >
          mean()
        </button>
        <button
          type="button"
          @click="statFunc = 'sum'; emitInspection()"
          class="px-2 py-0.5 rounded border text-[11px]"
          :class="statFunc === 'sum' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border-emerald-500/40' : 'bg-card border-line text-muted'"
        >
          sum()
        </button>
        <button
          type="button"
          @click="statFunc = 'std'; emitInspection()"
          class="px-2 py-0.5 rounded border text-[11px]"
          :class="statFunc === 'std' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border-emerald-500/40' : 'bg-card border-line text-muted'"
        >
          std()
        </button>
      </div>

      <!-- Active Position Badge -->
      <div class="flex items-center gap-1.5 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <span class="w-2 h-2 rounded-full bg-brand-blue" />
        <span class="font-bold text-ink">Window Head:</span>
        <span class="text-brand-blue font-bold">t={{ activeIdx }}</span>
        <span class="text-muted">({{ seriesData[activeIdx].date }})</span>
      </div>
    </div>

    <!-- Main Rolling Arena -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- LEFT 7 COLS: Authentic Jupyter Table with Sliding Highlight Bracket -->
        <div class="lg:col-span-7 flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1.5">
            <span class="flex items-center gap-1.5">
              <Layers class="w-4 h-4 text-brand-blue" />
              DataFrame with Sliding Window Bracket
            </span>
            <span class="text-[11px] font-normal text-muted">
              W={{ windowSize }} • Bracket Highlights Rows [t-{{ windowSize - 1 }}..t]
            </span>
          </div>

          <div class="overflow-x-auto w-full">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-10 text-center text-muted">#</th>
                  <th class="text-left font-bold text-ink">date</th>
                  <th class="text-right font-bold text-ink">price</th>
                  <th class="text-center w-8 text-muted font-normal">⇄</th>
                  <th class="text-right font-bold text-brand-blue">rolling_{{ statFunc }}</th>
                  <th class="text-center font-bold text-muted text-[10px]">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in rollingRows"
                  :key="row.date"
                  @click="setActiveRow(idx)"
                  class="cursor-pointer transition-all duration-150"
                  :class="[
                    row.isWindowHead
                      ? 'bg-brand-blue/15 font-bold border-l-4 border-l-brand-blue text-ink'
                      : row.inCurrentWindow
                        ? 'bg-brand-blue/5 border-l-2 border-l-brand-blue/60 text-ink'
                        : 'hover:bg-card-subtle text-muted'
                  ]"
                >
                  <td class="text-center font-mono text-[11px]" :class="row.isWindowHead ? 'text-brand-blue font-bold' : 'text-muted'">
                    {{ idx }}
                  </td>
                  <td class="font-mono font-semibold py-1.5" :class="row.isWindowHead ? 'text-ink' : ''">
                    {{ row.date }}
                  </td>
                  <td class="font-mono text-right font-semibold" :class="row.inCurrentWindow ? 'text-ink font-bold' : ''">
                    \${{ row.price }}
                  </td>
                  <td class="text-center text-[10px] text-muted">
                    <span v-if="row.isWindowHead" class="text-brand-blue font-bold">▶</span>
                    <span v-else-if="row.inCurrentWindow" class="text-brand-blue/50">|</span>
                  </td>
                  <td class="font-mono text-right font-bold">
                    <span v-if="row.computedVal !== null" :class="row.isWindowHead ? 'text-brand-blue font-bold' : 'text-ink'">
                      {{ row.computedVal }}
                    </span>
                    <span v-else class="nan font-mono text-xs">NaN</span>
                  </td>
                  <td class="text-center font-mono text-[10px]">
                    <span
                      v-if="row.isNan"
                      class="px-1.5 py-0.2 rounded text-[9px] uppercase font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300"
                    >
                      Init NaN
                    </span>
                    <span
                      v-else-if="row.isWindowHead"
                      class="px-1.5 py-0.2 rounded text-[9px] uppercase font-bold bg-brand-blue text-white"
                    >
                      Active
                    </span>
                    <span v-else class="text-muted text-[10px]">Computed</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- RIGHT 5 COLS: Step Breakdown & Math Mechanics -->
        <div class="lg:col-span-5 flex flex-col gap-3">
          <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1.5">
            <span class="flex items-center gap-1.5">
              <Calculator class="w-4 h-4 text-emerald-500" />
              Window Reduction Mechanics
            </span>
            <span class="text-[11px] font-normal text-muted">Step t={{ activeIdx }}</span>
          </div>

          <!-- Active Window Bracket Card -->
          <div class="rounded-md border border-line bg-card p-3 flex flex-col gap-2.5">
            <div class="flex items-center justify-between text-xs font-mono">
              <span class="text-muted font-medium">Window Elements (len={{ activeWindowItems.length }}):</span>
              <span class="font-bold text-ink">[ {{ activeWindowItems.join(', ') }} ]</span>
            </div>

            <!-- Mathematical Breakdown -->
            <div class="p-2.5 rounded bg-card-subtle border border-line/70 font-mono text-xs flex flex-col gap-1">
              <div class="text-[11px] text-muted flex items-center justify-between">
                <span>Formula:</span>
                <span class="font-bold text-ink">{{ statFunc.toUpperCase() }}</span>
              </div>
              <div class="text-ink font-semibold break-all">
                {{ activeFormulaText }}
              </div>
            </div>

            <!-- Invariant Check Indicator -->
            <div
              class="flex items-center gap-2 p-2 rounded text-xs font-mono"
              :class="activeWindowIsNan ? 'bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30' : 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30'"
            >
              <AlertCircle v-if="activeWindowIsNan" class="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <CheckCircle2 v-else class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div class="text-[11px] leading-tight">
                <span v-if="activeWindowIsNan">
                  <strong>Initial Warm-up:</strong> Window not saturated ({{ activeWindowItems.length }} of {{ windowSize }} required).
                </span>
                <span v-else>
                  <strong>Saturated Window:</strong> Full sample available. Result assigned to row index <code>t={{ activeIdx }}</code>.
                </span>
              </div>
            </div>
          </div>

          <!-- Educational Callout on min_periods -->
          <div class="rounded-md border border-line bg-card-subtle p-3 text-xs font-mono text-muted space-y-1.5">
            <div class="text-ink font-bold flex items-center gap-1.5">
              <Info class="w-3.5 h-3.5 text-brand-blue" />
              <span>The Initial NaN Rule</span>
            </div>
            <p class="text-[11px] leading-relaxed">
              By default, <code>rolling(W)</code> yields <strong>W - 1 initial NaNs</strong> because rolling operations refuse to calculate on incomplete historical samples.
            </p>
            <p class="text-[11px] leading-relaxed">
              Setting <code>min_periods=1</code> instructs Pandas to compute statistics on partial windows from row 0 immediately.
            </p>
          </div>
        </div>
      </div>

      <!-- Bottom Interactive Stepper & Playback Controls -->
      <div class="mt-6 pt-3 border-t border-line flex items-center justify-between flex-wrap gap-3">
        <!-- Controls -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="togglePlay"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-blue text-white text-xs font-mono font-medium hover:bg-brand-blue/90 shadow-2xs cursor-pointer"
          >
            <Play class="w-3.5 h-3.5 fill-current" v-if="!isPlaying" />
            <span v-else class="w-3.5 h-3.5 flex items-center justify-center font-bold">||</span>
            <span>{{ isPlaying ? 'Pause' : 'Slide Window' }}</span>
          </button>

          <button
            type="button"
            @click="nextStep"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card text-xs font-mono text-ink hover:bg-card-subtle shadow-2xs cursor-pointer"
          >
            <StepForward class="w-3.5 h-3.5 text-muted" />
            <span>Next Row</span>
          </button>

          <button
            type="button"
            @click="resetSimulation"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card text-xs font-mono text-muted hover:text-ink hover:bg-card-subtle shadow-2xs cursor-pointer"
            title="Reset position"
          >
            <RotateCcw class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Row Slider Jump Buttons -->
        <div class="flex items-center gap-1">
          <button
            v-for="(_, idx) in seriesData"
            :key="idx"
            type="button"
            @click="setActiveRow(idx)"
            class="w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono border transition-all cursor-pointer"
            :class="activeIdx === idx ? 'bg-brand-blue text-white border-brand-blue font-bold shadow-2xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            {{ idx }}
          </button>
        </div>
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active Rolling Invariant:</span>
        <span class="text-brand-blue font-semibold">Strict Historical Causal Window</span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ activeCodeSnippet }}</code></pre>
    </div>
  </div>
</template>

