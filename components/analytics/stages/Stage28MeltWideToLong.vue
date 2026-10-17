<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Table,
  ArrowRight,
  RotateCcw,
  StepForward,
  Play,
  Anchor,
  Layers,
  Sparkles,
  CheckCircle2
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Data Models -----------------------------------------------------------
interface WideRow {
  salesperson: string
  Q1: number
  Q2: number
  Q3: number
  Q4: number
}

const wideRecords: WideRow[] = [
  { salesperson: 'Alice', Q1: 120, Q2: 140, Q3: 160, Q4: 180 },
  { salesperson: 'Bob', Q1: 90, Q2: 110, Q3: 130, Q4: 150 },
  { salesperson: 'Charlie', Q1: 150, Q2: 170, Q3: 190, Q4: 210 }
]

const quarters = ['Q1', 'Q2', 'Q3', 'Q4'] as const

// --- Melted Long Records (3 persons x 4 quarters = 12 rows) -----------------
interface LongRow {
  id: number
  salesperson: string
  quarter: string
  revenue: number
  origRowIdx: number
}

const meltedRecords: LongRow[] = []
let idCounter = 0
wideRecords.forEach((person, rIdx) => {
  quarters.forEach((q) => {
    meltedRecords.push({
      id: idCounter++,
      salesperson: person.salesperson,
      quarter: q,
      revenue: person[q],
      origRowIdx: rIdx
    })
  })
})

// --- State -----------------------------------------------------------------
// Steps:
// 0: Wide Table Baseline
// 1: Anchor id_vars ('salesperson' replicated 4x)
// 2: Unpivot value_vars (Q1-Q4 rotate into 'quarter' column)
// 3: Align values into single 'revenue' column
const currentStep = ref(0)
const isPlaying = ref(false)
let playTimer: ReturnType<typeof setInterval> | null = null

// Selected observation in melted table for drill-down
const selectedLongRow = ref<LongRow | null>(null)

const stepTitles = [
  'Wide Table Baseline (3 rows × 5 cols)',
  'Anchor ID Columns (id_vars=[\'salesperson\'])',
  'Unpivot Headers to Variable (var_name=\'quarter\')',
  'Align Values to Single Column (value_name=\'revenue\')'
]

// Inspection telemetry
const emitInspection = () => {
  const details: Record<string, any> = {
    'Melt Invocation': "pd.melt(df, id_vars=['salesperson'], value_vars=['Q1', 'Q2', 'Q3', 'Q4'], var_name='quarter', value_name='revenue')",
    'Current Phase': `[${currentStep.value}/3] ${stepTitles[currentStep.value]}`,
    'Dimensional Shift': `(3 rows × 5 cols) Wide → (12 rows × 3 cols) Long [3 × 4 = 12]`,
    'Anchor (id_vars)': "'salesperson' (repeated for each value column)",
    'Unpivoted Variables': "['Q1', 'Q2', 'Q3', 'Q4'] -> 'quarter'",
    'Tidy Data Invariant': "Every column is a variable; every row is an individual observation."
  }

  if (selectedLongRow.value) {
    const row = selectedLongRow.value
    details['Selected Observation'] = `Row #${row.id}: ${row.salesperson} | ${row.quarter} | $${row.revenue}k`
    details['Source Wide Cell'] = `df.loc['${row.salesperson}', '${row.quarter}'] = ${row.revenue}`
  }

  emit('inspect', {
    title: `pd.melt: ${stepTitles[currentStep.value].split('(')[0]}`,
    details
  })
}

// Stepper actions
const setStep = (s: number) => {
  currentStep.value = Math.max(0, Math.min(3, s))
  emitInspection()
}

const nextStep = () => {
  if (currentStep.value < 3) {
    setStep(currentStep.value + 1)
  } else {
    setStep(0)
  }
}

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) {
    if (currentStep.value >= 3) currentStep.value = 0
    playTimer = setInterval(() => {
      if (currentStep.value < 3) {
        currentStep.value++
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
  currentStep.value = 0
  selectedLongRow.value = null
  emitInspection()
}

const selectObservation = (row: LongRow) => {
  selectedLongRow.value = row
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
      <!-- Formula Display -->
      <div class="flex items-center gap-2 bg-card px-3 py-1.5 rounded-md border border-line shadow-2xs">
        <span class="text-muted">Function:</span>
        <code class="text-brand-blue font-bold">pd.melt(df, id_vars=['salesperson'], var_name='quarter', value_name='revenue')</code>
      </div>

      <!-- Step Indicator Badge -->
      <div class="flex items-center gap-1.5 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <span class="w-2 h-2 rounded-full" :class="currentStep === 3 ? 'bg-emerald-500' : 'bg-brand-blue'" />
        <span class="font-bold text-ink">Phase {{ currentStep }}/3:</span>
        <span class="text-muted">{{ currentStep === 0 ? 'Wide Baseline' : currentStep === 1 ? 'Anchored IDs' : currentStep === 2 ? 'Unpivoted Headers' : 'Normalized Tidy' }}</span>
      </div>
    </div>

    <!-- Main Reshaping Arena -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <!-- LEFT BAY: Wide Format Table -->
        <div class="flex flex-col gap-2 w-full">
          <div class="flex items-center justify-between text-xs font-mono border-b border-line pb-1.5">
            <div class="flex items-center gap-1.5 font-bold text-ink">
              <Table class="w-3.5 h-3.5 text-brand-blue" />
              <span>Input: Wide Quarterly Format (3 rows × 5 cols)</span>
            </div>
            <span class="text-[10px] text-muted">Untidy: Quarters are column headers</span>
          </div>

          <div class="overflow-x-auto max-w-full">
            <table class="dataframe">
              <thead>
                <tr>
                  <th class="bg-card-subtle text-muted text-[10px]">#</th>
                  <!-- Anchored ID Column Header -->
                  <th
                    class="transition-colors"
                    :class="currentStep >= 1 ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold' : ''"
                  >
                    <div class="flex items-center gap-1">
                      <Anchor v-if="currentStep >= 1" class="w-3 h-3 text-amber-600" />
                      <span>salesperson</span>
                    </div>
                  </th>
                  <!-- Value Variables Headers (Q1 - Q4) -->
                  <th
                    v-for="q in quarters"
                    :key="'wide-hdr-' + q"
                    class="text-right px-3 transition-colors"
                    :class="[
                      currentStep >= 2 ? 'bg-blue-500/20 text-brand-blue font-bold' : '',
                      selectedLongRow && selectedLongRow.quarter === q ? 'ring-2 ring-brand-blue' : ''
                    ]"
                  >
                    {{ q }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, rIdx) in wideRecords"
                  :key="'wide-row-' + row.salesperson"
                  class="transition-colors"
                  :class="[
                    selectedLongRow && selectedLongRow.salesperson === row.salesperson ? 'bg-blue-50/70 dark:bg-blue-950/40' : ''
                  ]"
                >
                  <th class="text-muted text-[10px]">{{ rIdx }}</th>
                  <th
                    class="text-left font-bold transition-colors"
                    :class="currentStep >= 1 ? 'text-amber-700 dark:text-amber-400 font-bold' : 'text-ink'"
                  >
                    {{ row.salesperson }}
                  </th>
                  <td
                    v-for="q in quarters"
                    :key="'cell-' + row.salesperson + '-' + q"
                    class="text-right font-mono text-xs px-3 transition-colors"
                    :class="[
                      selectedLongRow && selectedLongRow.salesperson === row.salesperson && selectedLongRow.quarter === q
                        ? 'bg-blue-500 text-white font-bold ring-2 ring-blue-400'
                        : 'text-ink'
                    ]"
                  >
                    ${{ row[q] }}k
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="text-[10px] font-mono text-muted">
            Quarters (Q1..Q4) contain measurements of the same variable (revenue).
          </div>
        </div>

        <!-- RIGHT BAY: Melted Long Tidy Table -->
        <div class="flex flex-col gap-2 w-full">
          <div class="flex items-center justify-between text-xs font-mono border-b border-line pb-1.5">
            <div class="flex items-center gap-1.5 font-bold text-ink">
              <Layers class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Output: Normalized Tidy Format (12 rows × 3 cols)</span>
            </div>
            <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              3 × 4 = 12 observations
            </span>
          </div>

          <!-- Melted Table with Virtual Scroll / Scrollable Container -->
          <div class="overflow-x-auto max-h-[260px] overflow-y-auto border border-line rounded-md">
            <table class="dataframe w-full">
              <thead class="sticky top-0 bg-card z-10 shadow-2xs">
                <tr>
                  <th class="bg-card-subtle text-muted text-[10px] text-left pr-2">index</th>
                  <!-- Replicated ID column -->
                  <th :class="currentStep >= 1 ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold' : 'opacity-40'">
                    salesperson
                  </th>
                  <!-- Unpivoted Var Name -->
                  <th :class="currentStep >= 2 ? 'bg-blue-500/15 text-blue-800 dark:text-blue-300 font-bold' : 'opacity-40'">
                    quarter
                  </th>
                  <!-- Unpivoted Value Name -->
                  <th :class="currentStep >= 3 ? 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold text-right' : 'opacity-40 text-right'">
                    revenue
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="m in meltedRecords"
                  :key="'melt-' + m.id"
                  @click="selectObservation(m)"
                  class="cursor-pointer transition-colors text-xs font-mono select-none"
                  :class="[
                    selectedLongRow?.id === m.id
                      ? 'bg-blue-100 dark:bg-blue-900/60 font-bold ring-1 ring-brand-blue'
                      : 'hover:bg-card-subtle'
                  ]"
                >
                  <th class="text-muted text-[10px] text-left">{{ m.id }}</th>

                  <!-- Replicated Person -->
                  <td
                    class="font-semibold text-left"
                    :class="currentStep >= 1 ? 'text-amber-700 dark:text-amber-400' : 'opacity-30 italic'"
                  >
                    {{ currentStep >= 1 ? m.salesperson : '--' }}
                  </td>

                  <!-- Quarter -->
                  <td
                    class="font-semibold text-center"
                    :class="currentStep >= 2 ? 'text-blue-600 dark:text-blue-400' : 'opacity-30 italic'"
                  >
                    {{ currentStep >= 2 ? m.quarter : '--' }}
                  </td>

                  <!-- Revenue Value -->
                  <td
                    class="text-right font-bold"
                    :class="currentStep >= 3 ? 'text-ink' : 'opacity-30 italic'"
                  >
                    {{ currentStep >= 3 ? `$${m.revenue}k` : '--' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Metadata Footer -->
          <div class="dataframe-footer text-xs font-mono text-muted flex items-center justify-between w-full px-1">
            <span>12 rows × 3 columns (scrollable)</span>
            <span class="text-[11px]">Click row to trace source wide cell</span>
          </div>
        </div>
      </div>

      <!-- Playback & Progression Controller -->
      <div class="flex items-center justify-between gap-2 pt-4 border-t border-line/60 flex-wrap z-20 mt-4">
        <!-- Step Indicators -->
        <div class="flex items-center gap-1 font-mono text-xs">
          <button
            v-for="s in [0, 1, 2, 3]"
            :key="s"
            type="button"
            @click="setStep(s)"
            class="px-2.5 py-0.5 rounded text-[11px] font-medium transition-all cursor-pointer"
            :class="currentStep === s ? 'bg-brand-blue text-white font-bold shadow-2xs' : 'text-muted hover:text-ink bg-card border border-line'"
          >
            {{ s === 0 ? 'Wide' : 'Step ' + s }}
          </button>
        </div>

        <!-- Playback Buttons -->
        <div class="flex items-center gap-1.5 font-mono text-xs">
          <button
            type="button"
            @click="resetSimulation"
            class="p-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-muted hover:text-ink transition-colors cursor-pointer"
            title="Reset melt pipeline"
          >
            <RotateCcw class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            @click="nextStep"
            class="px-2.5 py-1 rounded-md border border-line bg-card hover:bg-card-subtle text-ink font-semibold flex items-center gap-1.5 transition-colors text-[11px] cursor-pointer"
          >
            <StepForward class="w-3.5 h-3.5" />
            <span>Step</span>
          </button>
          <button
            type="button"
            @click="togglePlay"
            class="px-3 py-1 rounded-md font-bold flex items-center gap-1.5 transition-all text-[11px] cursor-pointer"
            :class="isPlaying ? 'bg-brand-amber text-slate-950 shadow-xs' : 'bg-brand-blue text-white shadow-xs'"
          >
            <Play class="w-3.5 h-3.5" :class="{ 'animate-pulse': isPlaying }" />
            <span>{{ isPlaying ? 'Pause' : 'Play Melt' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Educational HUD Footer Bar -->
    <div class="rounded-lg border border-line bg-card p-3 shadow-2xs font-mono text-xs flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 text-muted">
        <Sparkles class="w-4 h-4 text-brand-blue shrink-0" />
        <span>Tidy Data Principle:</span>
        <span class="text-ink font-semibold">
          {{ currentStep === 0
            ? "Wide tables spread variable names (Q1, Q2, ...) across column headers, making groupby and seaborn plotting difficult."
            : currentStep === 1
            ? "id_vars replicates identifier columns exactly K times (where K is the number of unpivoted columns)."
            : currentStep === 2
            ? "Column headers pivot 90° into a new categorical column ('var_name')."
            : "All measurements consolidate into a single contiguous vector ('value_name'). Shape increases from 3 to 12 rows."
          }}
        </span>
      </div>

      <div v-if="selectedLongRow" class="text-ink font-bold bg-card-subtle px-2 py-0.5 rounded border border-line">
        Observation: {{ selectedLongRow.salesperson }} in {{ selectedLongRow.quarter }} = ${{ selectedLongRow.revenue }}k
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

