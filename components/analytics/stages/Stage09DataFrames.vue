<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Table,
  Layers,
  Split,
  Tag,
  Hash,
  Crosshair,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Info
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Data Models -----------------------------------------------------------
const rowLabels = ['ID_4', 'ID_1', 'ID_9', 'ID_2']
const columns = [
  { key: 'dept', label: 'dept', dtype: 'object', values: ["'Eng'", "'Mkt'", "'Sales'", "'DevOps'"] },
  { key: 'age', label: 'age', dtype: 'int64', values: ['29', '34', '41', '28'] },
  { key: 'salary', label: 'salary', dtype: 'float64', values: ['75000.0', '62000.0', '98000.0', '84000.0'] },
  { key: 'active', label: 'active', dtype: 'bool', values: ['True', 'False', 'True', 'True'] }
]

// --- State -----------------------------------------------------------------
type ViewSubmode = 'anatomy' | 'indexing'
const activeSubmode = ref<ViewSubmode>('indexing')

// Anatomy submode: Explode columns to dict of series
const isExploded = ref(false)

// Indexing submode: .loc vs .iloc
type IndexingPreset = 'iloc_slice' | 'loc_slice' | 'single_cell'
const activeIndexingPreset = ref<IndexingPreset>('iloc_slice')

// Selected cell or row
const selectedCell = ref<{ r: number; c: number } | null>(null)

// --- Computeds -------------------------------------------------------------
const indexingConfig = computed(() => {
  if (activeIndexingPreset.value === 'iloc_slice') {
    return {
      title: "df.iloc[0:2, 0:3]",
      mode: 'iloc',
      code: "subset = df.iloc[0:2, 0:3]",
      rows: [0, 1], // Rows 0 and 1 (row 2 is excluded)
      cols: [0, 1, 2],
      boundaryRow: 2,
      boundaryDesc: "Row Index 2 is strictly EXCLUDED (Half-Open Interval [0, 2))",
      ruleDesc: "Integer positional indexing behaves like Python lists: [start:stop) excludes stop."
    }
  } else if (activeIndexingPreset.value === 'loc_slice') {
    return {
      title: "df.loc['ID_4':'ID_9', 'dept':'salary']",
      mode: 'loc',
      code: "subset = df.loc['ID_4':'ID_9', 'dept':'salary']",
      rows: [0, 1, 2], // ID_4, ID_1, ID_9 (all 3 included)
      cols: [0, 1, 2],
      boundaryRow: 2, // 'ID_9'
      boundaryDesc: "Label 'ID_9' is strictly INCLUDED (Closed Interval [start, stop])",
      ruleDesc: "Label-based indexing includes the stop label because you cannot know the 'next' label in an arbitrary index."
    }
  } else {
    return {
      title: "Single Item: df.loc['ID_1', 'salary'] vs df.iloc[1, 2]",
      mode: 'loc',
      code: "val = df.loc['ID_1', 'salary']  # 62000.0\n# or df.iloc[1, 2]",
      rows: [1],
      cols: [2],
      boundaryRow: null,
      boundaryDesc: "Exact coordinate intersection",
      ruleDesc: "Fast scalar extraction using row label/position and column name/position."
    }
  }
})

const activeCodeSnippet = computed(() => {
  if (activeSubmode.value === 'anatomy') {
    if (isExploded.value) {
      return `# DataFrame as a Dictionary of Series
import pandas as pd

# Each column is an independent Series with its own homogenous dtype
df = pd.DataFrame({
    'dept': pd.Series(['Eng', 'Mkt', 'Sales', 'DevOps'], index=['ID_4', 'ID_1', 'ID_9', 'ID_2'], dtype='object'),
    'age': pd.Series([29, 34, 41, 28], index=['ID_4', 'ID_1', 'ID_9', 'ID_2'], dtype='int64'),
    'salary': pd.Series([75000.0, 62000.0, 98000.0, 84000.0], index=['ID_4', 'ID_1', 'ID_9', 'ID_2'], dtype='float64'),
    'active': pd.Series([True, False, True, True], index=['ID_4', 'ID_1', 'ID_9', 'ID_2'], dtype='bool')
})`
    } else {
      return `# Unified DataFrame
import pandas as pd

df = pd.DataFrame({
    'dept': ['Eng', 'Mkt', 'Sales', 'DevOps'],
    'age': [29, 34, 41, 28],
    'salary': [75000.0, 62000.0, 98000.0, 84000.0],
    'active': [True, False, True, True]
}, index=['ID_4', 'ID_1', 'ID_9', 'ID_2'])

print("Shape:", df.shape) # (4, 4)
print("Dtypes:\\n", df.dtypes)`
    }
  } else {
    return `# Indexing Invariant: .loc vs .iloc
import pandas as pd

${indexingConfig.value.code}
print(subset)`
  }
})

// --- Methods ---------------------------------------------------------------
const emitInspection = () => {
  if (activeSubmode.value === 'anatomy') {
    emit('inspect', {
      title: isExploded.value ? 'DataFrame: Exploded Dictionary of Series' : 'DataFrame: Unified 2D Structure',
      details: {
        'Shape': '(4, 4)',
        'Index Rail': "Index(['ID_4', 'ID_1', 'ID_9', 'ID_2'], dtype='object')",
        'Columns': "Index(['dept', 'age', 'salary', 'active'])",
        'Architecture': isExploded.value ? 'Independent 1D Series sharing the identical row Index rail' : 'Assembled 2D heterogeneous tabular container',
        'Heterogeneous Dtypes': 'dept: object (strings) | age: int64 | salary: float64 | active: bool'
      }
    })
  } else {
    emit('inspect', {
      title: indexingConfig.value.title,
      details: {
        'Indexing Type': indexingConfig.value.mode === 'iloc' ? 'Positional Integer (.iloc)' : 'Label Based (.loc)',
        'Boundary Rule': indexingConfig.value.boundaryDesc,
        'Selected Rows': indexingConfig.value.rows.map(r => rowLabels[r]).join(', '),
        'Selected Cols': indexingConfig.value.cols.map(c => columns[c].label).join(', '),
        'Core Invariant': indexingConfig.value.ruleDesc
      }
    })
  }
}

const setPreset = (p: IndexingPreset) => {
  activeIndexingPreset.value = p
  emitInspection()
}

onMounted(() => emitInspection())
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <!-- Top Action Toolbar -->
    <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
      <!-- Mode Toggle -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">Topic Focus:</span>
        <button
          type="button"
          @click="activeSubmode = 'indexing'; emitInspection()"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeSubmode === 'indexing' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <Crosshair class="w-3.5 h-3.5" />
          <span>.loc vs .iloc (Boundary Rules)</span>
        </button>
        <button
          type="button"
          @click="activeSubmode = 'anatomy'; emitInspection()"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeSubmode === 'anatomy' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <Layers class="w-3.5 h-3.5" />
          <span>DataFrame Anatomy (Dict of Series)</span>
        </button>

        <!-- Submode Context Controls -->
        <template v-if="activeSubmode === 'indexing'">
          <span class="text-line mx-1">|</span>
          <button
            type="button"
            @click="setPreset('iloc_slice')"
            class="px-2 py-0.5 rounded border text-[11px]"
            :class="activeIndexingPreset === 'iloc_slice' ? 'bg-brand-blue/15 text-brand-blue font-bold border-brand-blue/40' : 'bg-card border-line text-muted'"
          >
            .iloc[0:2] (Stop Excluded)
          </button>
          <button
            type="button"
            @click="setPreset('loc_slice')"
            class="px-2 py-0.5 rounded border text-[11px]"
            :class="activeIndexingPreset === 'loc_slice' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border-emerald-500/40' : 'bg-card border-line text-muted'"
          >
            .loc['ID_4':'ID_9'] (Stop Included)
          </button>
          <button
            type="button"
            @click="setPreset('single_cell')"
            class="px-2 py-0.5 rounded border text-[11px]"
            :class="activeIndexingPreset === 'single_cell' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold border-amber-500/40' : 'bg-card border-line text-muted'"
          >
            Scalar Coordinate
          </button>
        </template>
        <template v-else>
          <span class="text-line mx-1">|</span>
          <button
            type="button"
            @click="isExploded = !isExploded; emitInspection()"
            class="px-2.5 py-1 rounded border text-[11px] font-medium transition-all cursor-pointer"
            :class="isExploded ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold border-amber-500/40' : 'bg-card border-line text-muted'"
          >
            {{ isExploded ? 'Unified Table' : 'Explode to Dict of Series' }}
          </button>
        </template>
      </div>

      <!-- Quick Info Badge -->
      <div class="flex items-center gap-2 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <span class="w-2 h-2 rounded-full" :class="activeSubmode === 'indexing' && activeIndexingPreset === 'loc_slice' ? 'bg-emerald-500' : 'bg-brand-blue'" />
        <span class="font-bold text-ink">Shape: (4, 4)</span>
      </div>
    </div>

    <!-- Main Living Table Arena -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <!-- 1. INDEXING BAY (.loc vs .iloc) -->
      <div v-if="activeSubmode === 'indexing'" class="flex flex-col gap-4">
        <!-- Table with explicit Index Rail & Position Counters -->
        <div class="overflow-x-auto w-full">
          <table class="dataframe w-full text-xs">
            <thead>
              <tr>
                <th class="w-12 text-center text-muted font-normal text-[10px]">iloc #</th>
                <th class="w-20 text-left font-bold text-ink border-r-2 border-line">loc Index</th>
                <th
                  v-for="(col, cIdx) in columns"
                  :key="col.key"
                  class="text-left font-bold transition-colors"
                  :class="indexingConfig.cols.includes(cIdx) ? 'bg-brand-blue/15 text-brand-blue border-b-2 border-brand-blue font-bold' : 'text-ink'"
                >
                  {{ col.label }}
                  <span class="text-[9px] font-normal text-muted block">{{ col.dtype }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(rLabel, rIdx) in rowLabels"
                :key="rLabel"
                class="transition-colors"
                :class="[
                  indexingConfig.rows.includes(rIdx)
                    ? 'bg-brand-blue/10 font-medium'
                    : rIdx === indexingConfig.boundaryRow && indexingConfig.mode === 'iloc'
                      ? 'bg-rose-500/10'
                      : 'hover:bg-card-subtle'
                ]"
              >
                <!-- iloc position index -->
                <td class="text-center font-mono text-[11px] text-muted">
                  <span class="px-1.5 py-0.5 rounded bg-muted/15 font-bold">{{ rIdx }}</span>
                </td>

                <!-- loc text index label -->
                <td class="font-mono text-ink font-bold py-2 border-r-2 border-line">
                  {{ rLabel }}
                </td>

                <!-- Cells -->
                <td
                  v-for="(col, cIdx) in columns"
                  :key="col.key"
                  class="font-mono py-2 transition-colors"
                  :class="[
                    indexingConfig.rows.includes(rIdx) && indexingConfig.cols.includes(cIdx)
                      ? 'text-brand-blue font-bold bg-brand-blue/20'
                      : 'text-ink'
                  ]"
                >
                  {{ col.values[rIdx] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Boundary Invariant Banner -->
        <div
          class="p-3 rounded-md border font-mono text-xs flex items-center justify-between flex-wrap gap-2"
          :class="indexingConfig.mode === 'iloc' ? 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200' : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'"
        >
          <div class="flex items-center gap-2">
            <component :is="indexingConfig.mode === 'iloc' ? XCircle : CheckCircle2" class="w-4 h-4 shrink-0" />
            <span>Boundary Invariant:</span>
            <strong>{{ indexingConfig.boundaryDesc }}</strong>
          </div>
          <span class="text-[11px] font-bold">
            {{ indexingConfig.mode === 'iloc' ? '[0:2] yields 2 rows (0, 1)' : "['ID_4':'ID_9'] yields 3 rows (ID_4, ID_1, ID_9)" }}
          </span>
        </div>
      </div>

      <!-- 2. ANATOMY BAY (Unified vs Exploded Dict of Series) -->
      <div v-else class="flex flex-col gap-4">
        <!-- Unified View -->
        <div v-if="!isExploded" class="overflow-x-auto w-full">
          <div class="text-xs font-mono font-bold text-ink border-b border-line pb-1.5 mb-2 flex items-center justify-between">
            <span>Unified DataFrame: 4 rows x 4 columns</span>
            <span class="text-[10px] text-muted">Heterogeneous Memory (Columns have independent dtypes)</span>
          </div>

          <table class="dataframe w-full text-xs">
            <thead>
              <tr>
                <th class="w-20 text-left font-bold text-ink border-r-2 border-line">Index</th>
                <th v-for="col in columns" :key="col.key" class="text-left font-bold text-ink">
                  {{ col.label }}
                  <span class="text-[9px] font-normal text-muted block">{{ col.dtype }}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(rLabel, rIdx) in rowLabels" :key="rLabel" class="hover:bg-card-subtle">
                <td class="font-mono font-bold text-ink py-2 border-r-2 border-line">{{ rLabel }}</td>
                <td v-for="col in columns" :key="col.key" class="font-mono text-ink py-2">
                  {{ col.values[rIdx] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Exploded View: Dict of Series Ribbons -->
        <div v-else class="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div
            v-for="col in columns"
            :key="col.key"
            class="rounded-md border border-line bg-card p-2.5 flex flex-col gap-1.5 shadow-2xs"
          >
            <div class="text-xs font-mono font-bold text-brand-blue border-b border-line pb-1 flex items-center justify-between">
              <span>df['{{ col.label }}']</span>
              <span class="text-[9px] text-muted">{{ col.dtype }}</span>
            </div>

            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="text-left text-[10px] text-muted">Index</th>
                  <th class="text-right text-[10px] text-brand-blue">Value</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(rLabel, rIdx) in rowLabels" :key="rLabel">
                  <td class="font-mono text-[11px] text-ink py-1">{{ rLabel }}</td>
                  <td class="font-mono text-right text-[11px] font-bold text-brand-blue py-1">
                    {{ col.values[rIdx] }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="p-3 rounded-md border border-line bg-card-subtle font-mono text-xs flex items-center justify-between">
          <span>Memory Architecture:</span>
          <strong class="text-ink">Columns are NOT stored in a single 2D NumPy array; each column is a separate 1D Series!</strong>
        </div>
      </div>

      <!-- Bottom Hint Strip -->
      <div class="mt-4 pt-3 border-t border-line flex items-center justify-between flex-wrap gap-2 text-xs font-mono text-muted">
        <span>DataFrame Rule:</span>
        <strong class="text-ink">Use .iloc for numeric array offsets; use .loc for relational business keys</strong>
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active DataFrame Command:</span>
        <span class="text-brand-blue font-semibold">{{ activeSubmode === 'indexing' ? indexingConfig.title : (isExploded ? 'Exploded Dict-of-Series' : 'Unified DataFrame') }}</span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ activeCodeSnippet }}</code></pre>
    </div>
  </div>
</template>

