<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Table,
  Split,
  Columns,
  Rows,
  Layers,
  ArrowRight,
  Database,
  Check,
  RotateCcw,
  Sparkles
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Data Model -----------------------------------------------------------
interface ColumnDef {
  name: string
  dtype: 'object' | 'int64' | 'float64' | 'bool'
  values: (string | number | boolean)[]
  formatted: string[]
  align: 'text-left' | 'text-right' | 'text-center'
  desc: string
}

const rowLabels = ['EMP_101', 'EMP_102', 'EMP_103', 'EMP_104']

const columns: ColumnDef[] = [
  {
    name: 'name',
    dtype: 'object',
    values: ['Alice', 'Bob', 'Charlie', 'Diana'],
    formatted: ["'Alice'", "'Bob'", "'Charlie'", "'Diana'"],
    align: 'text-left',
    desc: 'Categorical string identifiers (stored as pointers to Python heap objects)'
  },
  {
    name: 'age',
    dtype: 'int64',
    values: [30, 24, 38, 29],
    formatted: ['30', '24', '38', '29'],
    align: 'text-right',
    desc: '8-byte contiguous signed integers (C-level numpy array)'
  },
  {
    name: 'salary',
    dtype: 'float64',
    values: [72500.5, 54000.0, 91200.75, 63000.0],
    formatted: ['72500.50', '54000.00', '91200.75', '63000.00'],
    align: 'text-right',
    desc: '8-byte IEEE 754 floating point numeric values'
  },
  {
    name: 'active',
    dtype: 'bool',
    values: [true, false, true, true],
    formatted: ['True', 'False', 'True', 'True'],
    align: 'text-center',
    desc: '1-byte boolean flags'
  }
]

// --- State ----------------------------------------------------------------
const isExploded = ref(false)
type SliceType = 'none' | 'column' | 'row'
const activeSlice = ref<SliceType>('none')
const selectedColName = ref<string>('salary')
const selectedRowLabel = ref<string>('EMP_101')
const selectedCell = ref<{ row: string; col: string } | null>(null)

// Computed helpers
const activeColDef = computed(() => columns.find(c => c.name === selectedColName.value) || columns[2])
const activeRowIdx = computed(() => rowLabels.indexOf(selectedRowLabel.value))

// Row cross-section values (coerced to object)
const rowSeriesData = computed(() => {
  const rIdx = activeRowIdx.value >= 0 ? activeRowIdx.value : 0
  return columns.map(c => ({
    name: c.name,
    rawVal: c.values[rIdx],
    formatted: c.formatted[rIdx],
    originalDtype: c.dtype
  }))
})

// Inspection telemetry
const emitInspection = () => {
  const details: Record<string, any> = {
    'DataFrame Shape': '(4 rows × 4 columns)',
    'Memory Paradigm': isExploded.value
      ? 'EXPLODED: Dictionary of 1D Series { col_name: pd.Series } bound to single Index instance'
      : 'TABULAR: Unified 2D DataFrame (column-oriented heterogeneous container)',
    'Columns & Dtypes': columns.map(c => `${c.name}: ${c.dtype}`).join(' | '),
    'Shared Row Index': `pd.Index(labels=[${rowLabels.map(l => `'${l}'`).join(', ')}])`
  }

  if (activeSlice.value === 'column') {
    const col = activeColDef.value
    details['Extracted Column'] = `df['${col.name}'] (pd.Series)`
    details['Series Dtype'] = `${col.dtype} (Zero-copy column view)`
    details['Memory Efficiency'] = 'O(1) dictionary key lookup. Returns a Series referencing the existing column buffer with zero data copying.'
    details['Values Buffer'] = `np.array([${col.formatted.join(', ')}], dtype=${col.dtype})`
  } else if (activeSlice.value === 'row') {
    details['Extracted Row'] = `df.loc['${selectedRowLabel.value}'] (pd.Series)`
    details['Coerced Dtype'] = 'object (All elements upcast to Python object!)'
    details['Critical Invariant'] = 'A Series must have a SINGLE homogeneous dtype. When a row slice contains mixed dtypes (str, int, float, bool), pandas is forced to upcast all values to object.'
    details['Values'] = rowSeriesData.value.map(item => `${item.name}=${item.formatted}`).join(', ')
  } else if (selectedCell.value) {
    const col = columns.find(c => c.name === selectedCell.value?.col)
    const rIdx = rowLabels.indexOf(selectedCell.value?.row)
    details['Selected Cell'] = `df.loc['${selectedCell.value.row}', '${selectedCell.value.col}']`
    details['Native Dtype'] = col?.dtype
    details['Value'] = col?.formatted[rIdx]
  }

  emit('inspect', {
    title: isExploded.value
      ? 'DataFrame Anatomy: Exploded Dict-of-Series'
      : activeSlice.value === 'column'
      ? `Column Slice: df['${activeColDef.value.name}']`
      : activeSlice.value === 'row'
      ? `Row Slice: df.loc['${selectedRowLabel.value}']`
      : 'DataFrame Anatomy: Tabular View',
    details
  })
}

// Interaction handlers
const toggleExplode = (val: boolean) => {
  isExploded.value = val
  if (val) activeSlice.value = 'none'
  selectedCell.value = null
  emitInspection()
}

const selectColumn = (colName: string) => {
  selectedColName.value = colName
  activeSlice.value = 'column'
  selectedCell.value = null
  emitInspection()
}

const selectRow = (rowLabel: string) => {
  selectedRowLabel.value = rowLabel
  activeSlice.value = 'row'
  selectedCell.value = null
  emitInspection()
}

const selectCell = (rowLabel: string, colName: string) => {
  selectedCell.value = { row: rowLabel, col: colName }
  activeSlice.value = 'none'
  emitInspection()
}

const resetView = () => {
  isExploded.value = false
  activeSlice.value = 'none'
  selectedCell.value = null
  selectedColName.value = 'salary'
  selectedRowLabel.value = 'EMP_101'
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
      <!-- Architecture View Switcher -->
      <div class="flex items-center gap-1.5">
        <button
          type="button"
          @click="toggleExplode(false)"
          class="px-3 py-1.5 rounded-md border transition-all flex items-center gap-1.5 shadow-2xs"
          :class="!isExploded ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink hover:bg-card-subtle'"
        >
          <Table class="w-3.5 h-3.5" />
          <span>Assembled DataFrame</span>
        </button>

        <button
          type="button"
          @click="toggleExplode(true)"
          class="px-3 py-1.5 rounded-md border transition-all flex items-center gap-1.5 shadow-2xs"
          :class="isExploded ? 'bg-brand-amber text-slate-950 font-bold border-amber-500 shadow-xs' : 'bg-card border-line text-muted hover:text-ink hover:bg-card-subtle'"
        >
          <Split class="w-3.5 h-3.5" />
          <span>Explode to Dict of Series (df.to_dict())</span>
        </button>
      </div>

      <!-- Slicing Action Buttons (Available in Assembled View) -->
      <div v-if="!isExploded" class="flex items-center gap-1 bg-card p-1 rounded-md border border-line shadow-2xs">
        <span class="text-[11px] text-muted px-1.5">Slice:</span>
        <button
          type="button"
          @click="selectColumn(selectedColName)"
          class="px-2 py-0.5 rounded transition-all flex items-center gap-1 text-[11px]"
          :class="activeSlice === 'column' ? 'bg-brand-blue text-white font-bold shadow-2xs' : 'text-muted hover:text-ink hover:bg-card-subtle'"
        >
          <Columns class="w-3 h-3" />
          <span>df['{{ selectedColName }}']</span>
        </button>
        <button
          type="button"
          @click="selectRow(selectedRowLabel)"
          class="px-2 py-0.5 rounded transition-all flex items-center gap-1 text-[11px]"
          :class="activeSlice === 'row' ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs' : 'text-muted hover:text-ink hover:bg-card-subtle'"
        >
          <Rows class="w-3 h-3" />
          <span>df.loc['{{ selectedRowLabel }}']</span>
        </button>
        <button
          v-if="activeSlice !== 'none' || selectedCell !== null"
          type="button"
          @click="resetView"
          class="px-1.5 py-0.5 rounded text-muted hover:text-ink hover:bg-card-subtle"
          title="Clear slice"
        >
          <RotateCcw class="w-3 h-3" />
        </button>
      </div>
    </div>

    <!-- Main Table Presentation Area -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs overflow-x-auto min-h-[300px] flex flex-col justify-center">
      <!-- 1. ASSEMBLED DATAFRAME VIEW -->
      <div v-if="!isExploded" class="flex flex-col gap-4 items-center">
        <div class="overflow-x-auto max-w-full">
          <table class="dataframe">
            <thead>
              <tr>
                <th class="bg-card-subtle text-muted text-[11px] text-left pr-3">
                  <span>df.index</span>
                </th>
                <th
                  v-for="col in columns"
                  :key="'hdr-' + col.name"
                  @click="selectColumn(col.name)"
                  class="cursor-pointer transition-colors"
                  :class="[
                    activeSlice === 'column' && selectedColName === col.name
                      ? 'bg-blue-500 text-white font-bold shadow-xs'
                      : 'hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-brand-blue'
                  ]"
                  :title="`Click to extract column: df['${col.name}']`"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span>{{ col.name }}</span>
                    <span
                      class="text-[9px] px-1 py-0.2 rounded font-mono font-normal"
                      :class="activeSlice === 'column' && selectedColName === col.name ? 'bg-white/20 text-white' : 'bg-card border border-line text-muted'"
                    >
                      {{ col.dtype }}
                    </span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(rLabel, rIdx) in rowLabels"
                :key="'row-' + rLabel"
                :class="activeSlice === 'row' && selectedRowLabel === rLabel ? 'bg-amber-500/15' : ''"
              >
                <!-- Row Index Label -->
                <th
                  @click="selectRow(rLabel)"
                  class="cursor-pointer transition-colors text-left font-bold"
                  :class="[
                    activeSlice === 'row' && selectedRowLabel === rLabel
                      ? 'bg-amber-500 text-slate-950 shadow-xs'
                      : 'text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                  ]"
                  :title="`Click to extract row: df.loc['${rLabel}']`"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span>{{ rLabel }}</span>
                    <span class="text-[9px] opacity-60 font-mono">#{{ rIdx }}</span>
                  </div>
                </th>

                <!-- Data Cells -->
                <td
                  v-for="col in columns"
                  :key="'cell-' + rLabel + '-' + col.name"
                  @click="selectCell(rLabel, col.name)"
                  class="cursor-pointer font-mono text-xs transition-all select-none"
                  :class="[
                    col.align,
                    selectedCell?.row === rLabel && selectedCell?.col === col.name
                      ? 'ring-2 ring-brand-blue bg-blue-100 dark:bg-blue-900/60 font-bold'
                      : activeSlice === 'column' && selectedColName === col.name
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 text-brand-blue font-semibold'
                      : activeSlice === 'row' && selectedRowLabel === rLabel
                      ? 'bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 font-semibold'
                      : 'hover:bg-card-subtle'
                  ]"
                  :title="`Cell df.loc['${rLabel}', '${col.name}']`"
                >
                  <span>{{ col.formatted[rIdx] }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Authentic Jupyter DataFrame Metadata Footer -->
        <div class="dataframe-footer text-xs font-mono text-muted flex items-center justify-between w-full max-w-xl px-2">
          <span>4 rows × 4 columns</span>
          <span class="text-[11px]">dtypes: object(1), int64(1), float64(1), bool(1)</span>
        </div>

        <!-- Extracted Slice Detail Panel -->
        <div
          v-if="activeSlice !== 'none'"
          class="w-full max-w-xl rounded-md border border-line bg-card p-3 shadow-2xs font-mono text-xs animate-fade-in flex flex-col gap-2"
        >
          <!-- Column Slice View -->
          <div v-if="activeSlice === 'column'" class="flex flex-col gap-2">
            <div class="flex items-center justify-between border-b border-line pb-1.5">
              <div class="flex items-center gap-1.5 font-bold text-brand-blue">
                <Columns class="w-3.5 h-3.5" />
                <span>Extracted Column Series: df['{{ activeColDef.name }}']</span>
              </div>
              <span class="text-[11px] px-1.5 py-0.5 rounded bg-blue-500/10 text-brand-blue font-semibold">
                dtype: {{ activeColDef.dtype }}
              </span>
            </div>
            <p class="text-muted text-[11px] font-sans">
              <strong>Zero-Copy O(1) View:</strong> Extracting a column returns a 1D Series that points directly to the column's underlying array in memory without data copying.
            </p>
            <div class="flex items-center gap-2 overflow-x-auto text-[11px] bg-stage p-1.5 rounded border border-line">
              <span class="text-muted">Values:</span>
              <span class="font-bold text-ink">[{{ activeColDef.formatted.join(', ') }}]</span>
            </div>
          </div>

          <!-- Row Slice View -->
          <div v-else-if="activeSlice === 'row'" class="flex flex-col gap-2">
            <div class="flex items-center justify-between border-b border-line pb-1.5">
              <div class="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                <Rows class="w-3.5 h-3.5" />
                <span>Extracted Row Series: df.loc['{{ selectedRowLabel }}']</span>
              </div>
              <span class="text-[11px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                dtype: object (Upcasted!)
              </span>
            </div>
            <p class="text-muted text-[11px] font-sans">
              <strong>Heterogeneous Upcasting Warning:</strong> A pandas Series must hold a single uniform dtype. When row values of mixed types (string, int, float, bool) are cross-sectioned, pandas is forced to coerce all elements to <code class="bg-stage px-1 py-0.2 rounded font-mono text-amber-600">object</code>!
            </p>
            <div class="grid grid-cols-4 gap-2 text-center text-[11px] pt-1">
              <div
                v-for="item in rowSeriesData"
                :key="'sub-item-' + item.name"
                class="p-1 rounded border border-line bg-stage flex flex-col items-center"
              >
                <span class="text-muted text-[10px]">{{ item.name }}</span>
                <span class="font-bold text-ink">{{ item.formatted }}</span>
                <span class="text-[9px] text-amber-600 dark:text-amber-400">-> object</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2. EXPLODED DICT-OF-SERIES VIEW -->
      <div v-else class="flex flex-col gap-6 items-center w-full py-2">
        <!-- Architecture Concept Banner -->
        <div class="flex items-center gap-2 text-xs font-mono bg-card px-3 py-1.5 rounded-full border border-line shadow-2xs text-muted">
          <Database class="w-3.5 h-3.5 text-brand-blue" />
          <span>Internal Storage Model:</span>
          <span class="text-ink font-bold font-mono">dict[str, pd.Series]</span>
          <span class="text-muted">sharing one</span>
          <span class="text-amber-600 dark:text-amber-400 font-bold">pd.Index</span>
        </div>

        <!-- Exploded Columns Container -->
        <div class="flex items-start justify-center gap-4 sm:gap-6 flex-wrap w-full">
          <!-- Shared Index Rail (Left Floating Column) -->
          <div class="flex flex-col items-center">
            <div class="text-[11px] font-mono font-bold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
              <span>Shared Index Rail</span>
            </div>
            <table class="dataframe">
              <thead>
                <tr>
                  <th class="bg-amber-500/15 text-amber-700 dark:text-amber-300">df.index</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="rLabel in rowLabels" :key="'exp-idx-' + rLabel">
                  <th class="bg-card text-left font-bold text-amber-700 dark:text-amber-400">
                    {{ rLabel }}
                  </th>
                </tr>
              </tbody>
            </table>
            <div class="text-[10px] font-mono text-muted text-center pt-1">
              Type: Index (labels)
            </div>
          </div>

          <!-- Connecting Divider Wire -->
          <div class="hidden md:flex flex-col justify-center items-center h-44 text-muted shrink-0">
            <div class="h-full w-px bg-dashed border-l border-line" />
            <span class="text-[10px] font-mono rotate-90 text-muted my-auto">binds</span>
            <div class="h-full w-px bg-dashed border-l border-line" />
          </div>

          <!-- Independent Series Tables -->
          <div
            v-for="col in columns"
            :key="'exp-col-' + col.name"
            class="flex flex-col items-center"
          >
            <!-- Column Series Header -->
            <div class="text-[11px] font-mono font-bold text-brand-blue mb-1 flex items-center gap-1">
              <span>Series['{{ col.name }}']</span>
            </div>

            <!-- Series Table -->
            <table class="dataframe">
              <thead>
                <tr>
                  <th class="bg-card-subtle text-ink font-bold">{{ col.name }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(val, vIdx) in col.formatted" :key="'exp-val-' + col.name + '-' + vIdx">
                  <td class="font-mono text-xs" :class="col.align">
                    {{ val }}
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Series Footer Dtype -->
            <div class="text-[10px] font-mono text-muted text-center pt-1">
              dtype: <span class="font-bold text-ink">{{ col.dtype }}</span>
            </div>
          </div>
        </div>

        <!-- Exploded Mechanics Explanation Pill -->
        <div class="max-w-xl text-center text-xs font-mono text-muted bg-card px-4 py-2 rounded-lg border border-line shadow-2xs">
          Each column is an independent 1D array with its own contiguous memory allocation. Columns do NOT need to share data types or memory blocks; they only synchronize on row indices via <strong class="text-amber-600 dark:text-amber-400">df.index</strong>.
        </div>
      </div>
    </div>

    <!-- Educational HUD Footer Bar -->
    <div class="rounded-lg border border-line bg-card p-3 shadow-2xs font-mono text-xs flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 text-muted">
        <Sparkles class="w-4 h-4 text-brand-blue shrink-0" />
        <span>Core Architectural Invariant:</span>
        <span class="text-ink font-semibold">
          {{ isExploded
            ? "DataFrame is a dict of Series. Adding/removing columns is as lightweight as adding/removing keys from a Python dictionary."
            : activeSlice === "column"
            ? "df['col'] preserves the column's native C-type in O(1) time without copying memory."
            : activeSlice === "row"
            ? "df.loc['row'] coerces all heterogeneous elements into a single Series of dtype 'object'."
            : "A DataFrame is a 2D tabular abstraction over heterogeneous 1D Series columns sharing a common Index rail."
          }}
        </span>
      </div>

      <div v-if="selectedCell" class="text-ink font-bold bg-card-subtle px-2 py-0.5 rounded border border-line">
        Cell [{{ selectedCell.row }}, {{ selectedCell.col }}] = {{ columns.find(c => c.name === selectedCell?.col)?.formatted[rowLabels.indexOf(selectedCell?.row)] }}
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
