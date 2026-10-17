<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Crosshair,
  Hash,
  Tag,
  CheckCircle2,
  XCircle,
  Sparkles,
  MousePointerClick,
  RotateCcw,
  Clock,
  Layers
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Data Models -----------------------------------------------------------
const colPos = [0, 1, 2]
const colLabels = ['dept', 'score', 'bonus']
const colDtypes = ['object', 'int64', 'float64']

const rowPos = [0, 1, 2, 3]
const rowLabels = ['R_40', 'R_12', 'R_88', 'R_05'] // Non-consecutive, shuffled index labels

const rawTableData: (string | number)[][] = [
  ['Eng', 92, 1200.5],
  ['Marketing', 78, 850.0],
  ['Sales', 85, 1050.25],
  ['Product', 95, 1500.0]
]

const formattedTableData: string[][] = [
  ["'Eng'", '92', '1200.50'],
  ["'Marketing'", '78', '850.00'],
  ["'Sales'", '85', '1050.25'],
  ["'Product'", '95', '1500.00']
]

// --- Preset Modes ----------------------------------------------------------
type ModeKey = 'iloc_slice' | 'loc_slice' | 'iloc_offset' | 'loc_range'

interface PresetDef {
  key: ModeKey
  label: string
  mode: 'iloc' | 'loc'
  code: string
  intervalRule: string
  isInclusive: boolean
  selectedRows: number[] // positional indices
  selectedCols: number[] // positional indices
  boundaryRowPos: number | null
  boundaryStatus: 'excluded' | 'included' | null
  explanation: string
}

const presets: Record<ModeKey, PresetDef> = {
  iloc_slice: {
    key: 'iloc_slice',
    label: '.iloc[0:2, 0:2]',
    mode: 'iloc',
    code: 'df.iloc[0:2, 0:2]',
    intervalRule: 'Half-Open Interval [start, stop): Row 0 & 1 included; Row 2 EXCLUDED',
    isInclusive: false,
    selectedRows: [0, 1],
    selectedCols: [0, 1],
    boundaryRowPos: 2,
    boundaryStatus: 'excluded',
    explanation: ".iloc adheres strictly to Python half-open [start, stop) slicing conventions. The stop offset (2) is EXCLUDED from the result."
  },
  loc_slice: {
    key: 'loc_slice',
    label: ".loc['R_40':'R_88', 'dept':'score']",
    mode: 'loc',
    code: "df.loc['R_40':'R_88', 'dept':'score']",
    intervalRule: "Closed Interval [start, stop]: Stop label 'R_88' is INCLUDED",
    isInclusive: true,
    selectedRows: [0, 1, 2],
    selectedCols: [0, 1],
    boundaryRowPos: 2,
    boundaryStatus: 'included',
    explanation: ".loc performs label-based lookup. Because users cannot easily determine what label 'comes after' an arbitrary index in pandas, the stop label is INCLUDED."
  },
  iloc_offset: {
    key: 'iloc_offset',
    label: '.iloc[1:3, 1:3]',
    mode: 'iloc',
    code: 'df.iloc[1:3, 1:3]',
    intervalRule: 'Half-Open Interval [1, 3): Row 1 & 2 included; Row 3 EXCLUDED',
    isInclusive: false,
    selectedRows: [1, 2],
    selectedCols: [1, 2],
    boundaryRowPos: 3,
    boundaryStatus: 'excluded',
    explanation: "Zero-based positional offset slicing: grabs rows at positions 1 and 2, stopping before position 3."
  },
  loc_range: {
    key: 'loc_range',
    label: ".loc['R_12':'R_05', 'score':'bonus']",
    mode: 'loc',
    code: "df.loc['R_12':'R_05', 'score':'bonus']",
    intervalRule: "Closed Interval ['R_12', 'R_05']: 'R_05' is INCLUDED",
    isInclusive: true,
    selectedRows: [1, 2, 3],
    selectedCols: [1, 2],
    boundaryRowPos: 3,
    boundaryStatus: 'included',
    explanation: "Label-based scan from 'R_12' down to 'R_05', inclusive of both endpoints."
  }
}

// --- State -----------------------------------------------------------------
const activePresetKey = ref<ModeKey>('iloc_slice')
const clickedCell = ref<{ r: number; c: number } | null>(null)

const activeConfig = computed(() => presets[activePresetKey.value])

// Helpers for cell highlight states
const isCellInSelection = (r: number, c: number) => {
  if (clickedCell.value) {
    return clickedCell.value.r === r && clickedCell.value.c === c
  }
  return activeConfig.value.selectedRows.includes(r) && activeConfig.value.selectedCols.includes(c)
}

const isRowSelected = (r: number) => {
  if (clickedCell.value) return clickedCell.value.r === r
  return activeConfig.value.selectedRows.includes(r)
}

const isColSelected = (c: number) => {
  if (clickedCell.value) return clickedCell.value.c === c
  return activeConfig.value.selectedCols.includes(c)
}

// Sliced Sub-DataFrame computed data
const slicedRows = computed(() => {
  if (clickedCell.value) {
    return [clickedCell.value.r]
  }
  return activeConfig.value.selectedRows
})

const slicedCols = computed(() => {
  if (clickedCell.value) {
    return [clickedCell.value.c]
  }
  return activeConfig.value.selectedCols
})

// Inspection telemetry
const emitInspection = () => {
  const cfg = activeConfig.value
  const details: Record<string, any> = {
    'Indexing Paradigm': clickedCell.value
      ? 'Scalar Coordinate Dual Resolution'
      : cfg.mode === 'iloc'
      ? '.iloc (Integer Positional Indexing)'
      : '.loc (Label-Based Coordinate Lookup)',
    'Slice Syntax': clickedCell.value
      ? `Cell pos=[${clickedCell.value.r}, ${clickedCell.value.c}]`
      : cfg.code,
    'Boundary Rule': cfg.intervalRule,
    'Index Rail (Shuffled)': `[${rowLabels.map((l, i) => `#${i}: '${l}'`).join(', ')}]`,
    'Columns': `[${colLabels.map((c, i) => `#${i}: '${c}'`).join(', ')}]`
  }

  if (clickedCell.value) {
    const { r, c } = clickedCell.value
    const rLabel = rowLabels[r]
    const cLabel = colLabels[c]
    const val = formattedTableData[r][c]
    details['.loc Syntax'] = `df.loc['${rLabel}', '${cLabel}'] = ${val}`
    details['.iloc Syntax'] = `df.iloc[${r}, ${c}] = ${val}`
    details['Performance Benchmark'] = '.iloc calculates direct C memory offset (1 * stride), ~15-20% faster than .loc label-hash lookup.'
    details['Architectural Rule'] = "Use .iloc when indexing by integer row/column count (loop counters); use .loc when looking up business keys/names."
  } else {
    details['Selected Slice Shape'] = `(${slicedRows.value.length} rows × ${slicedCols.value.length} cols)`
    details['Architectural Rationale'] = cfg.explanation
  }

  emit('inspect', {
    title: clickedCell.value
      ? `Scalar Lookup: df.loc['${rowLabels[clickedCell.value.r]}', '${colLabels[clickedCell.value.c]}']`
      : `Slice: ${cfg.code}`,
    details
  })
}

// Handlers
const selectPreset = (key: ModeKey) => {
  activePresetKey.value = key
  clickedCell.value = null
  emitInspection()
}

const onCellClick = (r: number, c: number) => {
  clickedCell.value = { r, c }
  emitInspection()
}

const resetToPreset = () => {
  clickedCell.value = null
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
      <!-- Preset Slicing Selectors -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <button
          v-for="preset in presets"
          :key="preset.key"
          type="button"
          @click="selectPreset(preset.key)"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs"
          :class="[
            activePresetKey === preset.key && !clickedCell
              ? preset.mode === 'iloc'
                ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs'
                : 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs'
              : 'bg-card border-line text-muted hover:text-ink hover:bg-card-subtle'
          ]"
        >
          <span :class="preset.mode === 'iloc' ? 'text-blue-300' : 'text-emerald-300'">
            {{ preset.mode === 'iloc' ? '#' : '@' }}
          </span>
          {{ preset.label }}
        </button>
      </div>

      <!-- Boundary Rule Pill -->
      <div
        class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono text-xs shadow-2xs"
        :class="activeConfig.mode === 'iloc'
          ? 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
          : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'"
      >
        <span class="font-bold text-[11px]">
          {{ activeConfig.mode === 'iloc' ? '[start, stop) Half-Open' : '[start, stop] Closed' }}
        </span>
      </div>
    </div>

    <!-- Main Workspace Container -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs overflow-x-auto min-h-[320px] flex flex-col justify-between gap-4">
      <!-- Section A: Original DataFrame with Dual Coordinate Rails -->
      <div class="flex flex-col items-center gap-3 w-full">
        <div class="text-[11px] font-mono text-muted text-center flex items-center gap-1">
          <Layers class="w-3.5 h-3.5 text-brand-blue" />
          <span>Source DataFrame (with intentionally shuffled non-consecutive Index labels)</span>
        </div>

        <div class="overflow-x-auto max-w-full">
          <table class="dataframe">
            <thead>
              <!-- Top Row: Physical Pos + Labels for Columns -->
              <tr>
                <th class="bg-card-subtle text-muted text-[10px] text-center px-2">
                  <div class="flex items-center justify-center gap-2">
                    <span class="text-blue-600 dark:text-blue-400 font-bold">#pos</span>
                    <span>|</span>
                    <span class="text-amber-600 dark:text-amber-400 font-bold">label</span>
                  </div>
                </th>
                <th
                  v-for="c in colPos"
                  :key="'th-col-' + c"
                  class="transition-colors text-center"
                  :class="[
                    isColSelected(c)
                      ? 'bg-blue-500/15 text-brand-blue font-bold'
                      : 'bg-card-subtle text-ink'
                  ]"
                >
                  <div class="flex flex-col items-center gap-0.5">
                    <div class="flex items-center gap-1.5 text-[10px]">
                      <span class="text-blue-600 dark:text-blue-400 font-mono">#{{ c }}</span>
                      <span class="text-[9px] text-muted">({{ colDtypes[c] }})</span>
                    </div>
                    <span class="font-bold text-xs">{{ colLabels[c] }}</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="r in rowPos"
                :key="'tr-row-' + r"
                :class="isRowSelected(r) ? 'bg-blue-500/10' : ''"
              >
                <!-- Row Header: Positional # + Shuffled Label + Boundary Tag -->
                <th
                  class="text-left font-mono text-xs transition-colors select-none"
                  :class="[
                    isRowSelected(r)
                      ? 'bg-blue-500/15 text-ink'
                      : 'bg-card text-muted'
                  ]"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                      <!-- Positional Index (#pos) -->
                      <span
                        class="px-1 py-0.2 rounded text-[10px] font-bold"
                        :class="activeConfig.mode === 'iloc' && isRowSelected(r)
                          ? 'bg-brand-blue text-white'
                          : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'"
                      >
                        #{{ r }}
                      </span>

                      <!-- Label Index (.loc) -->
                      <span
                        class="px-1.5 py-0.2 rounded font-bold"
                        :class="activeConfig.mode === 'loc' && isRowSelected(r)
                          ? 'bg-emerald-600 text-white'
                          : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'"
                      >
                        '{{ rowLabels[r] }}'
                      </span>
                    </div>

                    <!-- Boundary Indicators (Included / Excluded) -->
                    <div v-if="!clickedCell && activeConfig.boundaryRowPos === r">
                      <span
                        v-if="activeConfig.boundaryStatus === 'excluded'"
                        class="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-600 dark:text-red-400 font-bold flex items-center gap-1"
                        title="Index 2 is the stop boundary and is excluded"
                      >
                        <XCircle class="w-3 h-3" />
                        <span>[start, stop) EXCLUDED</span>
                      </span>
                      <span
                        v-else-if="activeConfig.boundaryStatus === 'included'"
                        class="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1"
                        title="Stop label is included in .loc"
                      >
                        <CheckCircle2 class="w-3 h-3" />
                        <span>[start, stop] INCLUDED</span>
                      </span>
                    </div>
                  </div>
                </th>

                <!-- Data Cells -->
                <td
                  v-for="c in colPos"
                  :key="'td-cell-' + r + '-' + c"
                  @click="onCellClick(r, c)"
                  class="cursor-pointer font-mono text-xs transition-all select-none text-right px-3 py-1.5"
                  :class="[
                    isCellInSelection(r, c)
                      ? activeConfig.mode === 'iloc' || (clickedCell && clickedCell.r === r && clickedCell.c === c)
                        ? 'bg-blue-500 text-white font-bold ring-2 ring-blue-400/40 shadow-xs'
                        : 'bg-emerald-600 text-white font-bold ring-2 ring-emerald-400/40 shadow-xs'
                      : 'hover:bg-card-subtle text-ink'
                  ]"
                  :title="`Click to inspect cell: df.loc['${rowLabels[r]}', '${colLabels[c]}'] / df.iloc[${r}, ${c}]`"
                >
                  <span>{{ formattedTableData[r][c] }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="dataframe-footer text-xs font-mono text-muted flex items-center justify-between w-full max-w-lg px-2">
          <span>4 rows × 3 columns</span>
          <span class="text-[11px]">Index: ['R_40', 'R_12', 'R_88', 'R_05']</span>
        </div>
      </div>

      <!-- Section B: Sliced Sub-Table or Scalar Dual Resolution Box -->
      <div class="border-t border-line/60 pt-3 flex flex-col items-center gap-3">
        <!-- Case 1: Sliced Sub-DataFrame (Preset Mode) -->
        <div v-if="!clickedCell" class="flex flex-col items-center gap-2 animate-fade-in w-full max-w-lg">
          <div class="flex items-center justify-between w-full text-xs font-mono">
            <span class="font-bold text-ink flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full" :class="activeConfig.mode === 'iloc' ? 'bg-brand-blue' : 'bg-emerald-600'" />
              <span>Isolated Sliced Sub-Table:</span>
              <code class="px-1.5 py-0.5 rounded bg-card border border-line" :class="activeConfig.mode === 'iloc' ? 'text-brand-blue font-bold' : 'text-emerald-600 dark:text-emerald-400 font-bold'">
                {{ activeConfig.code }}
              </code>
            </span>
            <span class="text-muted text-[11px]">
              {{ slicedRows.length }} rows × {{ slicedCols.length }} columns
            </span>
          </div>

          <div class="overflow-x-auto max-w-full">
            <table class="dataframe">
              <thead>
                <tr>
                  <th class="bg-card-subtle text-muted text-[10px]"></th>
                  <th v-for="c in slicedCols" :key="'sub-hdr-' + c" class="font-bold text-xs text-center">
                    {{ colLabels[c] }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in slicedRows" :key="'sub-row-' + r">
                  <th class="text-left font-bold text-amber-700 dark:text-amber-400">
                    '{{ rowLabels[r] }}'
                  </th>
                  <td v-for="c in slicedCols" :key="'sub-cell-' + r + '-' + c" class="text-right font-mono text-xs font-semibold">
                    {{ formattedTableData[r][c] }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Case 2: Custom Scalar Cell Click (Dual Resolution) -->
        <div v-else class="flex flex-col items-center gap-2 animate-fade-in w-full max-w-lg">
          <div class="flex items-center justify-between w-full text-xs font-mono">
            <span class="font-bold text-ink flex items-center gap-1.5">
              <Crosshair class="w-3.5 h-3.5 text-brand-blue" />
              <span>Dual Coordinate Resolution for Cell:</span>
            </span>
            <button
              type="button"
              @click="resetToPreset"
              class="text-[11px] text-brand-blue hover:underline flex items-center gap-1"
            >
              <RotateCcw class="w-3 h-3" />
              <span>Back to Preset Slice</span>
            </button>
          </div>

          <!-- Dual Syntax Comparison Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
            <!-- .loc Resolution Card -->
            <div class="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 flex flex-col gap-1 text-xs font-mono">
              <div class="flex items-center justify-between text-amber-800 dark:text-amber-300 font-bold">
                <span class="flex items-center gap-1">
                  <Tag class="w-3.5 h-3.5" />
                  <span>.loc[label, col]</span>
                </span>
                <span class="text-[10px] bg-amber-500/20 px-1 rounded">Label match</span>
              </div>
              <div class="text-sm font-bold text-ink py-1">
                df.loc['{{ rowLabels[clickedCell.r] }}', '{{ colLabels[clickedCell.c] }}']
              </div>
              <div class="text-[11px] text-muted flex items-center justify-between pt-1 border-t border-amber-500/20">
                <span>Resolved Value:</span>
                <span class="font-bold text-ink text-xs">{{ formattedTableData[clickedCell.r][clickedCell.c] }}</span>
              </div>
            </div>

            <!-- .iloc Resolution Card -->
            <div class="rounded-md border border-blue-500/30 bg-blue-500/10 p-2.5 flex flex-col gap-1 text-xs font-mono">
              <div class="flex items-center justify-between text-blue-800 dark:text-blue-300 font-bold">
                <span class="flex items-center gap-1">
                  <Hash class="w-3.5 h-3.5" />
                  <span>.iloc[row_idx, col_idx]</span>
                </span>
                <span class="text-[10px] bg-blue-500/20 px-1 rounded">Positional offset</span>
              </div>
              <div class="text-sm font-bold text-ink py-1">
                df.iloc[{{ clickedCell.r }}, {{ clickedCell.c }}]
              </div>
              <div class="text-[11px] text-muted flex items-center justify-between pt-1 border-t border-blue-500/20">
                <span>Resolved Value:</span>
                <span class="font-bold text-ink text-xs">{{ formattedTableData[clickedCell.r][clickedCell.c] }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Educational HUD Footer Bar -->
    <div class="rounded-lg border border-line bg-card p-3 shadow-2xs font-mono text-xs flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 text-muted">
        <Sparkles class="w-4 h-4 text-brand-blue shrink-0" />
        <span>Endpoint Invariant:</span>
        <span class="text-ink font-semibold">
          {{ clickedCell
            ? "Both methods point to the identical C-array byte in RAM, but .iloc uses direct stride multiplication while .loc hashes the index label."
            : activeConfig.explanation
          }}
        </span>
      </div>

      <div class="text-ink font-bold bg-card-subtle px-2 py-0.5 rounded border border-line">
        {{ activeConfig.intervalRule }}
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
