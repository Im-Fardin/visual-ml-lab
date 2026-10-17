<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  FileText,
  FileSpreadsheet,
  FileCode,
  ArrowRight,
  Play,
  RotateCcw,
  StepForward,
  Table,
  CheckCircle2,
  Sparkles,
  Tag,
  Info
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- File Formats -----------------------------------------------------------
type FileFormat = 'csv' | 'json' | 'excel'
const activeFormat = ref<FileFormat>('csv')

// Raw file stream representation for each format
const rawBuffers: Record<FileFormat, { name: string; rawText: string; func: string; desc: string }> = {
  csv: {
    name: 'employees.csv',
    rawText: `name,age,salary,joined
Alice,30,75000.50,2021-03-15
Bob,24,52000.00,2023-08-01
Charlie,38,91000.00,2019-11-20
Diana,29,63000.75,2022-01-10`,
    func: "pd.read_csv('employees.csv')",
    desc: "Comma-Separated Values: Fast C-tokenizer parses text stream, splits by sep=',' and infers dtypes."
  },
  json: {
    name: 'employees.json',
    rawText: `[
  {"name": "Alice", "age": 30, "salary": 75000.5, "joined": "2021-03-15"},
  {"name": "Bob", "age": 24, "salary": 52000.0, "joined": "2023-08-01"},
  {"name": "Charlie", "age": 38, "salary": 91000.0, "joined": "2019-11-20"},
  {"name": "Diana", "age": 29, "salary": 63000.75, "joined": "2022-01-10"}
]`,
    func: "pd.read_json('employees.json')",
    desc: "JavaScript Object Notation: Parses list of key-value dictionaries into columnar series."
  },
  excel: {
    name: 'employees.xlsx',
    rawText: `[Binary ZIP / OpenXML Workbook Container]
Sheet1:
┌─────────┬─────┬──────────┬────────────┐
│ name    │ age │ salary   │ joined     │
├─────────┼─────┼──────────┼────────────┤
│ Alice   │  30 │ 75000.50 │ 2021-03-15 │
│ Bob     │  24 │ 52000.00 │ 2023-08-01 │
│ Charlie │  38 │ 91000.00 │ 2019-11-20 │
│ Diana   │  29 │ 63000.75 │ 2022-01-10 │
└─────────┴─────┴──────────┴────────────┘`,
    func: "pd.read_excel('employees.xlsx', sheet_name='Sheet1')",
    desc: "Excel Spreadsheet: Uses openpyxl / xlrd engine to decode XML sheets and cell styles."
  }
}

// Ingestion Pipeline Steps
// 0: Raw Buffer, 1: Tokenization/Parsing, 2: Header Elevation, 3: Type Casting & DataFrame
const currentStep = ref(0)
const isPlaying = ref(false)
let playTimer: ReturnType<typeof setInterval> | null = null

const stepLabels = [
  'Phase 0: Raw Input Stream (Disk / File Buffer)',
  'Phase 1: Tokenization & Delimiter Splitting',
  'Phase 2: Header Promotion (header=0)',
  'Phase 3: Automated Type Inference & DataFrame Assembly'
]

const columnSchemas = [
  { name: 'name', inferredDtype: 'object', align: 'text-left' },
  { name: 'age', inferredDtype: 'int64', align: 'text-right' },
  { name: 'salary', inferredDtype: 'float64', align: 'text-right' },
  { name: 'joined', inferredDtype: 'datetime64[ns]', align: 'text-left' }
]

const tableRows = [
  { name: 'Alice', age: 30, salary: '75000.50', joined: '2021-03-15' },
  { name: 'Bob', age: 24, salary: '52000.00', joined: '2023-08-01' },
  { name: 'Charlie', age: 38, salary: '91000.00', joined: '2019-11-20' },
  { name: 'Diana', age: 29, salary: '63000.75', joined: '2022-01-10' }
]

const activeCodeSnippet = computed(() => {
  const f = rawBuffers[activeFormat.value]
  return `# Ingesting from ${activeFormat.value.toUpperCase()}
import pandas as pd

df = ${f.func}

print(df.head())
print("\\nInferred Dtypes:\\n", df.dtypes)`
})

// Inspection telemetry
const emitInspection = () => {
  const f = rawBuffers[activeFormat.value]
  emit('inspect', {
    title: `File Ingestion: ${f.func}`,
    details: {
      'Source File': f.name,
      'Ingestion Method': f.func,
      'Pipeline Phase': stepLabels[currentStep.value],
      'Inferred Dtypes': 'name: object, age: int64, salary: float64, joined: datetime64',
      'Format Mechanic': f.desc
    }
  })
}

// Stepper
const setStep = (s: number) => {
  currentStep.value = Math.max(0, Math.min(3, s))
  emitInspection()
}

const nextStep = () => {
  if (currentStep.value < 3) setStep(currentStep.value + 1)
  else setStep(0)
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
  emitInspection()
}

const setFormat = (fmt: FileFormat) => {
  activeFormat.value = fmt
  resetSimulation()
}

onMounted(() => emitInspection())
onBeforeUnmount(() => {
  if (playTimer) clearInterval(playTimer)
})
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <!-- Top Action Toolbar -->
    <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
      <!-- File Format Selector Pills -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">File Format:</span>
        <button
          type="button"
          @click="setFormat('csv')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeFormat === 'csv' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <FileText class="w-3.5 h-3.5" />
          <span>.csv (read_csv)</span>
        </button>
        <button
          type="button"
          @click="setFormat('json')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeFormat === 'json' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <FileCode class="w-3.5 h-3.5" />
          <span>.json (read_json)</span>
        </button>
        <button
          type="button"
          @click="setFormat('excel')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeFormat === 'excel' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <FileSpreadsheet class="w-3.5 h-3.5" />
          <span>.xlsx (read_excel)</span>
        </button>
      </div>

      <!-- Phase Indicator Badge -->
      <div class="flex items-center gap-2 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <span class="w-2 h-2 rounded-full" :class="currentStep === 3 ? 'bg-emerald-500' : 'bg-brand-blue'" />
        <span class="font-bold text-ink">Phase {{ currentStep }}/3:</span>
        <span class="text-muted">{{ currentStep === 0 ? 'Buffer' : currentStep === 1 ? 'Tokenized' : currentStep === 2 ? 'Header' : 'DataFrame' }}</span>
      </div>
    </div>

    <!-- Main Living Table Arena -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <!-- LEFT BAY: Raw File Buffer / Stream -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1.5">
            <span class="flex items-center gap-1.5">
              <component :is="activeFormat === 'csv' ? FileText : activeFormat === 'json' ? FileCode : FileSpreadsheet" class="w-4 h-4 text-brand-blue" />
              <span>Raw Stream: {{ rawBuffers[activeFormat].name }}</span>
            </span>
            <span class="text-[10px] text-muted">Disk / Byte Stream</span>
          </div>

          <!-- Raw Stream Monospace Block -->
          <div class="rounded-md border border-line bg-card p-3 font-mono text-xs overflow-x-auto max-h-[220px]">
            <pre class="text-ink leading-relaxed select-text"><code>{{ rawBuffers[activeFormat].rawText }}</code></pre>
          </div>

          <p class="text-[11px] font-mono text-muted leading-relaxed">
            {{ rawBuffers[activeFormat].desc }}
          </p>
        </div>

        <!-- RIGHT BAY: Ingestion Flow & DataFrame Target -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1.5">
            <span class="flex items-center gap-1.5">
              <Table class="w-4 h-4 text-emerald-500" />
              <span>Target: Ingested DataFrame</span>
            </span>
            <span class="text-[10px] text-muted">4 rows x 4 columns</span>
          </div>

          <!-- Ingestion Preview based on currentStep -->
          <div v-if="currentStep >= 2" class="overflow-x-auto w-full">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-10 text-center text-muted font-normal text-[10px]">#</th>
                  <th
                    v-for="col in columnSchemas"
                    :key="col.name"
                    class="text-left font-bold"
                  >
                    {{ col.name }}
                    <span v-if="currentStep === 3" class="text-[9px] font-normal text-emerald-600 dark:text-emerald-400 block font-mono">
                      {{ col.inferredDtype }}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in tableRows" :key="idx" class="hover:bg-card-subtle">
                  <td class="text-center font-mono text-[11px] text-muted">{{ idx }}</td>
                  <td class="font-mono text-ink py-1.5">{{ row.name }}</td>
                  <td class="font-mono text-right font-bold text-brand-blue">{{ row.age }}</td>
                  <td class="font-mono text-right text-emerald-600 dark:text-emerald-400 font-bold">\${{ row.salary }}</td>
                  <td class="font-mono text-muted text-[11px]">{{ row.joined }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Earlier Steps Preview -->
          <div
            v-else
            class="rounded-md border border-dashed border-line bg-card-subtle p-6 flex flex-col items-center justify-center text-center gap-2"
          >
            <Sparkles class="w-6 h-6 text-brand-blue" />
            <div class="text-xs font-mono font-bold text-ink">{{ stepLabels[currentStep] }}</div>
            <p class="text-[11px] font-mono text-muted max-w-sm">
              {{ currentStep === 0 ? 'Click "Step Ingestion" or "Animate Flow" to watch the C-parsing engine tokenize delimiters and promote headers.' : 'Tokens extracted from file buffer. Next step: header promotion.' }}
            </p>
          </div>

          <!-- Bottom Invariant Strip -->
          <div class="p-2.5 rounded border border-line bg-card-subtle text-[11px] font-mono text-muted flex items-center justify-between">
            <span>Engine: <strong class="text-ink">C-parser (fast)</strong></span>
            <span>Header: <strong class="text-ink">header=0 promoted</strong></span>
            <span>Dtype Inference: <strong class="text-emerald-600 dark:text-emerald-400">Automated</strong></span>
          </div>
        </div>
      </div>

      <!-- Bottom Interactive Stepper & Playback Controls -->
      <div class="mt-4 pt-3 border-t border-line flex items-center justify-between flex-wrap gap-3">
        <!-- Controls -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="togglePlay"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-blue text-white text-xs font-mono font-medium hover:bg-brand-blue/90 shadow-2xs cursor-pointer"
          >
            <Play class="w-3.5 h-3.5 fill-current" v-if="!isPlaying" />
            <span v-else class="w-3.5 h-3.5 flex items-center justify-center font-bold">||</span>
            <span>{{ isPlaying ? 'Pause' : 'Animate Flow' }}</span>
          </button>

          <button
            type="button"
            @click="nextStep"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card text-xs font-mono text-ink hover:bg-card-subtle shadow-2xs cursor-pointer"
          >
            <StepForward class="w-3.5 h-3.5 text-muted" />
            <span>Step</span>
          </button>

          <button
            type="button"
            @click="resetSimulation"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card text-xs font-mono text-muted hover:text-ink hover:bg-card-subtle shadow-2xs cursor-pointer"
            title="Reset"
          >
            <RotateCcw class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Stepper Phase Buttons -->
        <div class="flex items-center gap-1">
          <button
            v-for="s in [0, 1, 2, 3]"
            :key="s"
            type="button"
            @click="setStep(s)"
            class="px-2.5 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer"
            :class="currentStep === s ? 'bg-brand-blue text-white border-brand-blue font-bold shadow-2xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            {{ s === 0 ? '1. Stream' : s === 1 ? '2. Tokenize' : s === 2 ? '3. Header' : '4. Cast' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active File Ingestion Command:</span>
        <span class="text-brand-blue font-semibold">{{ rawBuffers[activeFormat].func }}</span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ activeCodeSnippet }}</code></pre>
    </div>
  </div>
</template>

