<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  FileText,
  ArrowRight,
  Play,
  RotateCcw,
  StepForward,
  Split,
  Table,
  CheckCircle2,
  Sparkles,
  Tag
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Data Models -----------------------------------------------------------
interface RawRow {
  raw: string
  tokens: string[]
}

const rawLines: RawRow[] = [
  { raw: 'name,age,salary,joined', tokens: ['name', 'age', 'salary', 'joined'] },
  { raw: 'Alice,30,75000.50,2021-03-15', tokens: ['Alice', '30', '75000.50', '2021-03-15'] },
  { raw: 'Bob,24,52000.00,2023-08-01', tokens: ['Bob', '24', '52000.00', '2023-08-01'] },
  { raw: 'Charlie,38,91000.00,2019-11-20', tokens: ['Charlie', '38', '91000.00', '2019-11-20'] },
  { raw: 'Diana,29,63000.75,2022-01-10', tokens: ['Diana', '29', '63000.75', '2022-01-10'] }
]

const columnSchemas = [
  { name: 'name', rawDtype: 'string', inferredDtype: 'object', align: 'text-left', desc: 'Categorical strings' },
  { name: 'age', rawDtype: 'string', inferredDtype: 'int64', align: 'text-right', desc: 'Continuous integer ages' },
  { name: 'salary', rawDtype: 'string', inferredDtype: 'float64', align: 'text-right', desc: 'IEEE 754 float values' },
  { name: 'joined', rawDtype: 'string', inferredDtype: 'object', align: 'text-left', desc: 'ISO 8601 Date strings' }
]

// --- State -----------------------------------------------------------------
// Step: 0: Raw Buffer, 1: Delimiter Splitting, 2: Header Recognition, 3: Type Inference, 4: Index Bound
const currentStep = ref(0)
const isPlaying = ref(false)
let playTimer: ReturnType<typeof setInterval> | null = null

// Delimiter & Index config
const activeDelimiter = ref<',' | ';' | '\t'>(',')
const indexColOption = ref<'none' | 'name'>('none')
const selectedToken = ref<string | null>(null)

const stepLabels = [
  'Step 0: Raw File Stream in Buffer',
  'Step 1: Delimiter Splitting (sep=\',\')',
  'Step 2: Header Promotion (header=0)',
  'Step 3: Dtype Inference & Type Casting',
  'Step 4: Index Rail Generation (RangeIndex / index_col)'
]

// Parsed table columns depending on index_col
const displayColumns = computed(() => {
  if (indexColOption.value === 'name') {
    return columnSchemas.filter(c => c.name !== 'name')
  }
  return columnSchemas
})

const rowRecords = computed(() => {
  return rawLines.slice(1).map((line, rIdx) => {
    const rawTokens = line.tokens
    const record: Record<string, string> = {
      name: rawTokens[0],
      age: rawTokens[1],
      salary: rawTokens[2],
      joined: rawTokens[3]
    }
    const indexLabel = indexColOption.value === 'name' ? rawTokens[0] : String(rIdx)
    return {
      indexLabel,
      record,
      rawTokens
    }
  })
})

// Inspection telemetry
const emitInspection = () => {
  const details: Record<string, any> = {
    'Parser Invocation': `pd.read_csv('raw_data.csv', sep='${activeDelimiter.value}', header=0, index_col=${indexColOption.value === 'none' ? 'None' : "'name'"})`,
    'Current Phase': `[${currentStep.value}/4] ${stepLabels[currentStep.value]}`,
    'Active Delimiter': `'${activeDelimiter.value}'`,
    'Header Strategy': currentStep.value >= 2 ? "header=0 (First line promoted to column names)" : "Pending detection",
    'Type Casting Strategy': currentStep.value >= 3
      ? "Auto-inferred: name -> object, age -> int64, salary -> float64, joined -> object"
      : "Raw strings (untyped ASCII buffer)",
    'Index Rail': currentStep.value >= 4
      ? (indexColOption.value === 'name' ? "pd.Index(['Alice', 'Bob', ...], name='name')" : "pd.RangeIndex(start=0, stop=4, step=1)")
      : "Unbound"
  }

  if (selectedToken.value) {
    details['Inspected Token'] = selectedToken.value
  }

  emit('inspect', {
    title: `CSV Ingestion: ${stepLabels[currentStep.value].split(':')[1]}`,
    details
  })
}

// Stepper actions
const setStep = (step: number) => {
  currentStep.value = Math.max(0, Math.min(4, step))
  emitInspection()
}

const nextStep = () => {
  if (currentStep.value < 4) {
    setStep(currentStep.value + 1)
  } else {
    setStep(0)
  }
}

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) {
    if (currentStep.value >= 4) currentStep.value = 0
    playTimer = setInterval(() => {
      if (currentStep.value < 4) {
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
  selectedToken.value = null
  emitInspection()
}

const toggleIndexCol = () => {
  indexColOption.value = indexColOption.value === 'none' ? 'name' : 'none'
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
      <!-- Parser Parameters -->
      <div class="flex items-center gap-2 flex-wrap">
        <div class="flex items-center gap-1.5 bg-card px-2.5 py-1 rounded-md border border-line shadow-2xs">
          <span class="text-muted">sep=</span>
          <span class="font-bold text-brand-blue">'{{ activeDelimiter }}'</span>
        </div>

        <div class="flex items-center gap-1.5 bg-card px-2.5 py-1 rounded-md border border-line shadow-2xs">
          <span class="text-muted">header=</span>
          <span class="font-bold text-ink">0</span>
        </div>

        <button
          type="button"
          @click="toggleIndexCol"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all shadow-2xs cursor-pointer"
          :class="indexColOption === 'name' ? 'bg-amber-500/20 border-amber-500 text-amber-800 dark:text-amber-300 font-bold' : 'bg-card border-line text-muted hover:text-ink'"
          title="Toggle index_col='name' vs index_col=None"
        >
          <Tag class="w-3.5 h-3.5" />
          <span>index_col={{ indexColOption === 'name' ? "'name'" : 'None' }}</span>
        </button>
      </div>

      <!-- Step Indicator Badge -->
      <div class="flex items-center gap-1.5 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <span class="w-2 h-2 rounded-full" :class="currentStep === 4 ? 'bg-emerald-500' : 'bg-brand-blue'" />
        <span class="font-bold text-ink">Phase {{ currentStep }}/4:</span>
        <span class="text-muted">{{ currentStep === 0 ? 'Raw Buffer' : currentStep === 1 ? 'Delimiters' : currentStep === 2 ? 'Header' : currentStep === 3 ? 'Casting' : 'Indexed' }}</span>
      </div>
    </div>

    <!-- Main Ingestion Studio: Raw File Buffer vs Parsed DataFrame -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <!-- ZONE 1: Raw File Buffer (raw_data.csv) -->
        <div class="flex flex-col gap-2 w-full">
          <div class="flex items-center justify-between text-xs font-mono border-b border-line pb-1.5">
            <div class="flex items-center gap-1.5 font-bold text-ink">
              <FileText class="w-3.5 h-3.5 text-brand-blue" />
              <span>raw_data.csv (Memory Text Buffer)</span>
            </div>
            <span class="text-[10px] text-muted">UTF-8 • 168 Bytes</span>
          </div>

          <!-- Raw Monospace Buffer Editor View -->
          <div class="rounded-md border border-line bg-card p-3 font-mono text-xs leading-relaxed overflow-x-auto shadow-2xs">
            <div
              v-for="(row, rIdx) in rawLines"
              :key="'raw-line-' + rIdx"
              class="flex items-center py-0.5 transition-colors rounded px-1"
              :class="[
                rIdx === 0 && currentStep >= 2 ? 'bg-blue-500/10 text-brand-blue font-bold' : '',
                rIdx > 0 && currentStep >= 3 ? 'text-ink' : 'text-slate-700 dark:text-slate-300'
              ]"
            >
              <!-- Line Number -->
              <span class="w-6 text-muted select-none text-[10px]">{{ rIdx }}:</span>

              <!-- Content with highlighted tokens and delimiters -->
              <div class="flex items-center flex-wrap">
                <template v-for="(tok, tIdx) in row.tokens" :key="'tok-' + rIdx + '-' + tIdx">
                  <!-- Token Pill -->
                  <span
                    @click="selectedToken = tok; emitInspection()"
                    class="cursor-pointer transition-all px-1 py-0.2 rounded"
                    :class="[
                      currentStep >= 1 ? 'bg-stage border border-line/60 hover:border-brand-blue' : '',
                      rIdx === 0 && currentStep >= 2 ? 'text-brand-blue font-bold bg-blue-50 dark:bg-blue-950/40' : '',
                      selectedToken === tok ? 'ring-2 ring-brand-blue' : ''
                    ]"
                  >
                    {{ tok }}
                  </span>

                  <!-- Delimiter Symbol -->
                  <span
                    v-if="tIdx < row.tokens.length - 1"
                    class="mx-0.5 text-muted font-bold select-none"
                    :class="currentStep >= 1 ? 'text-red-500 dark:text-red-400 bg-red-500/10 px-0.5 rounded text-[11px]' : 'opacity-60'"
                  >
                    {{ activeDelimiter }}
                  </span>
                </template>
                <span class="text-muted text-[10px] ml-1 opacity-50 select-none">\n</span>
              </div>
            </div>
          </div>

          <div class="text-[10px] font-mono text-muted">
            {{ currentStep === 0 ? 'File loaded in RAM buffer as raw byte stream.' : currentStep === 1 ? 'Delimiter \',\' scanned; string slices extracted into token vectors.' : 'Tokens mapped into structured tabular memory.' }}
          </div>
        </div>

        <!-- ZONE 2: Parsed Typed DataFrame (pd.read_csv) -->
        <div class="flex flex-col gap-2 w-full">
          <div class="flex items-center justify-between text-xs font-mono border-b border-line pb-1.5">
            <div class="flex items-center gap-1.5 font-bold text-ink">
              <Table class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Parsed DataFrame (pd.read_csv)</span>
            </div>
            <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              {{ currentStep >= 4 ? '4 rows × ' + displayColumns.length + ' cols' : 'Constructing...' }}
            </span>
          </div>

          <!-- Authentic Jupyter DataFrame Table -->
          <div class="overflow-x-auto max-w-full">
            <table class="dataframe">
              <thead>
                <tr>
                  <!-- Index Header -->
                  <th class="bg-card-subtle text-muted text-[10px] text-left pr-3">
                    {{ currentStep >= 4 && indexColOption === 'name' ? 'name' : '' }}
                  </th>

                  <!-- Column Headers -->
                  <th
                    v-for="col in displayColumns"
                    :key="'df-hdr-' + col.name"
                    class="transition-all"
                    :class="currentStep >= 2 ? 'bg-card-subtle text-ink font-bold' : 'opacity-30 border-dashed'"
                  >
                    <div class="flex flex-col items-center gap-0.5">
                      <span v-if="currentStep >= 2">{{ col.name }}</span>
                      <span v-else class="text-muted italic text-[10px]">col_{{ col.name }}</span>

                      <!-- Dtype pill on step >= 3 -->
                      <span
                        v-if="currentStep >= 3"
                        class="text-[9px] px-1 py-0.2 rounded font-mono font-normal"
                        :class="col.inferredDtype === 'int64' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300' : col.inferredDtype === 'float64' ? 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300' : 'bg-card border border-line text-muted'"
                      >
                        {{ col.inferredDtype }}
                      </span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                <!-- Placeholder / Loading Wireframe if Step < 1 -->
                <tr v-if="currentStep === 0" v-for="placeholderIdx in [0, 1, 2, 3]" :key="'ph-' + placeholderIdx" class="opacity-25">
                  <th class="text-muted text-xs">--</th>
                  <td v-for="col in displayColumns" :key="'ph-col-' + col.name" class="text-center text-xs italic text-muted">
                    empty
                  </td>
                </tr>

                <!-- Populated Rows -->
                <tr
                  v-else
                  v-for="(row, rIdx) in rowRecords"
                  :key="'df-row-' + rIdx"
                  class="transition-all"
                >
                  <!-- Index Column -->
                  <th
                    class="text-left font-bold transition-colors"
                    :class="currentStep >= 4 ? (indexColOption === 'name' ? 'text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20' : 'text-ink bg-card-subtle') : 'opacity-40 text-muted'"
                  >
                    {{ currentStep >= 4 ? row.indexLabel : (indexColOption === 'name' ? '--' : rIdx) }}
                  </th>

                  <!-- Data Cells -->
                  <td
                    v-for="col in displayColumns"
                    :key="'df-cell-' + rIdx + '-' + col.name"
                    class="font-mono text-xs transition-all"
                    :class="[
                      col.align,
                      currentStep === 1 ? 'opacity-50 italic text-muted' : '',
                      currentStep >= 3 && col.inferredDtype === 'int64' ? 'text-brand-blue font-semibold' : '',
                      currentStep >= 3 && col.inferredDtype === 'float64' ? 'text-cyan-700 dark:text-cyan-400 font-semibold' : ''
                    ]"
                  >
                    <span>{{ row.record[col.name] }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Metadata Footer -->
          <div class="dataframe-footer text-xs font-mono text-muted flex items-center justify-between w-full px-1">
            <span>{{ currentStep >= 4 ? '4 rows × ' + displayColumns.length + ' columns' : 'Parsing in progress...' }}</span>
            <span v-if="currentStep >= 3" class="text-[11px]">
              dtypes: {{ displayColumns.map(c => `${c.name}: ${c.inferredDtype}`).join(', ') }}
            </span>
          </div>
        </div>
      </div>

      <!-- Playback & Progression Controller -->
      <div class="flex items-center justify-between gap-2 pt-4 border-t border-line/60 flex-wrap z-20 mt-4">
        <!-- Step Indicators -->
        <div class="flex items-center gap-1 font-mono text-xs">
          <button
            v-for="s in [0, 1, 2, 3, 4]"
            :key="s"
            type="button"
            @click="setStep(s)"
            class="px-2 py-0.5 rounded text-[11px] font-medium transition-all"
            :class="currentStep === s ? 'bg-brand-blue text-white font-bold shadow-2xs' : 'text-muted hover:text-ink bg-card border border-line'"
          >
            {{ s === 0 ? 'Raw' : 'Step ' + s }}
          </button>
        </div>

        <!-- Playback Trigger Buttons -->
        <div class="flex items-center gap-1.5 font-mono text-xs">
          <button
            type="button"
            @click="resetSimulation"
            class="p-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-muted hover:text-ink transition-colors"
            title="Reset parsing pipeline"
          >
            <RotateCcw class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            @click="nextStep"
            class="px-2.5 py-1 rounded-md border border-line bg-card hover:bg-card-subtle text-ink font-semibold flex items-center gap-1.5 transition-colors text-[11px]"
          >
            <StepForward class="w-3.5 h-3.5" />
            <span>Step</span>
          </button>
          <button
            type="button"
            @click="togglePlay"
            class="px-3 py-1 rounded-md font-bold flex items-center gap-1.5 transition-all text-[11px]"
            :class="isPlaying ? 'bg-brand-amber text-slate-950 shadow-xs' : 'bg-brand-blue text-white shadow-xs'"
          >
            <Play class="w-3.5 h-3.5" :class="{ 'animate-pulse': isPlaying }" />
            <span>{{ isPlaying ? 'Pause' : 'Play Ingestion' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Educational HUD Footer Bar -->
    <div class="rounded-lg border border-line bg-card p-3 shadow-2xs font-mono text-xs flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 text-muted">
        <Sparkles class="w-4 h-4 text-brand-blue shrink-0" />
        <span>Parser Invariant:</span>
        <span class="text-ink font-semibold">
          {{ currentStep === 0
            ? "pd.read_csv begins with an untyped continuous byte stream from disk or network."
            : currentStep === 1
            ? "C parser engine tokenizes stream at delimiter boundary characters (sep=',')."
            : currentStep === 2
            ? "Row 0 lifts into df.columns (Index of strings); remaining rows become Series elements."
            : currentStep === 3
            ? "Numeric strings are converted from ASCII digits into contiguous C numpy arrays (int64/float64)."
            : indexColOption === 'name'
            ? "index_col='name' promotes the 'name' column into the DataFrame Index rail."
            : "RangeIndex(0, 4) is synthesized as a lightweight O(1) integer coordinate sequence."
          }}
        </span>
      </div>

      <div class="text-ink font-bold bg-card-subtle px-2 py-0.5 rounded border border-line">
        Engine: C Engine (Fast)
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
