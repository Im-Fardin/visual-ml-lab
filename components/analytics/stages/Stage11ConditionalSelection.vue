<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Filter,
  CheckCircle2,
  XCircle,
  RotateCcw,
  RefreshCw,
  Sparkles,
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

// --- Base Dataset (5 rows x 4 columns) -------------------------------------
interface EmployeeRecord {
  origIdx: number
  name: string
  dept: string
  age: number
  salary: number
}

const baseRecords: EmployeeRecord[] = [
  { origIdx: 0, name: 'Alice', dept: 'Eng', age: 30, salary: 75000.0 },
  { origIdx: 1, name: 'Bob', dept: 'HR', age: 24, salary: 52000.0 },
  { origIdx: 2, name: 'Charlie', dept: 'Eng', age: 38, salary: 91000.0 },
  { origIdx: 3, name: 'Diana', dept: 'Sales', age: 29, salary: 63000.0 },
  { origIdx: 4, name: 'Evan', dept: 'Eng', age: 42, salary: 84000.0 }
]

// --- Condition Presets -----------------------------------------------------
type PresetKey = 'salary_60k' | 'young_eng' | 'eng_or_rich'

interface PresetConfig {
  key: PresetKey
  label: string
  predicate: string
  syntax: string
  description: string
  evaluate: (r: EmployeeRecord) => boolean
}

const presets: Record<PresetKey, PresetConfig> = {
  salary_60k: {
    key: 'salary_60k',
    label: "df['salary'] > 60000",
    predicate: "salary > 60000",
    syntax: "df[df['salary'] > 60000]",
    description: "Simple scalar comparison returning a boolean Series of shape (5,)",
    evaluate: (r) => r.salary > 60000
  },
  young_eng: {
    key: 'young_eng',
    label: "(age < 30) & (dept == 'Eng')",
    predicate: "(age < 30) & (dept == 'Eng')",
    syntax: "df[(df['age'] < 30) & (df['dept'] == 'Eng')]",
    description: "Bitwise AND (&) requires parentheses around each predicate due to operator precedence",
    evaluate: (r) => r.age < 30 && r.dept === 'Eng'
  },
  eng_or_rich: {
    key: 'eng_or_rich',
    label: "(dept == 'Eng') | (salary > 80k)",
    predicate: "(dept == 'Eng') | (salary > 80000)",
    syntax: "df[(df['dept'] == 'Eng') | (df['salary'] > 80000)]",
    description: "Bitwise OR (|) selects union of matches while preserving original index coordinates",
    evaluate: (r) => r.dept === 'Eng' || r.salary > 80000
  }
}

// --- State -----------------------------------------------------------------
const activePresetKey = ref<PresetKey>('salary_60k')
const showMaskOnly = ref(false)
const isResetIndex = ref(false) // toggle for df.reset_index(drop=True)
const isFilteredView = ref(false) // false = show base table with mask column, true = show extracted sub-dataframe

const activePreset = computed(() => presets[activePresetKey.value])

// Evaluated Boolean Mask
const maskResults = computed(() => {
  return baseRecords.map((r) => activePreset.value.evaluate(r))
})

// Filtered Records
const matchingRecords = computed(() => {
  return baseRecords.filter((r, idx) => maskResults.value[idx])
})

// Inspection Telemetry
const emitInspection = () => {
  const p = activePreset.value
  const matchesCount = matchingRecords.value.length
  const details: Record<string, any> = {
    'Filter Expression': p.syntax,
    'Predicate Logic': p.description,
    'Retained Rows': `${matchesCount} / ${baseRecords.length} rows (${Math.round((matchesCount / baseRecords.length) * 100)}%)`,
    'Boolean Mask Series': `pd.Series([${maskResults.value.join(', ')}], dtype=bool)`,
    'Index Preservation Invariant': isResetIndex.value
      ? "RESET: df.reset_index(drop=True) generates new contiguous RangeIndex(0, " + matchesCount + ")"
      : "PRESERVED: Original index labels [" + matchingRecords.value.map(r => r.origIdx).join(', ') + "] retained without renumbering!",
    'Python Caveat': "Never use Python keywords 'and' / 'or' for Series filtering! Always use bitwise operators '&' / '|' with parentheses."
  }

  emit('inspect', {
    title: `Conditional Filtering: ${p.label}`,
    details
  })
}

// Handlers
const selectPreset = (key: PresetKey) => {
  activePresetKey.value = key
  emitInspection()
}

const toggleFilterView = () => {
  isFilteredView.value = !isFilteredView.value
  emitInspection()
}

const toggleResetIndex = () => {
  isResetIndex.value = !isResetIndex.value
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
      <!-- Preset Predicates -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <button
          v-for="p in presets"
          :key="p.key"
          type="button"
          @click="selectPreset(p.key)"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="[
            activePresetKey === p.key
              ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs'
              : 'bg-card border-line text-muted hover:text-ink hover:bg-card-subtle'
          ]"
        >
          {{ p.label }}
        </button>
      </div>

      <!-- Action Toggles -->
      <div class="flex items-center gap-2">
        <!-- View Toggle (Evaluate Mask vs Extract Sub-Table) -->
        <button
          type="button"
          @click="toggleFilterView"
          class="flex items-center gap-1.5 px-3 py-1 rounded-md border font-mono text-xs transition-all shadow-2xs cursor-pointer"
          :class="isFilteredView ? 'bg-emerald-600 text-white font-bold border-emerald-600' : 'bg-card border-line text-muted hover:text-ink hover:bg-card-subtle'"
        >
          <Filter class="w-3.5 h-3.5" />
          <span>{{ isFilteredView ? 'View: Filtered Sub-Table' : 'View: Mask Injection' }}</span>
        </button>

        <!-- df.reset_index(drop=True) Toggle -->
        <button
          v-if="isFilteredView"
          type="button"
          @click="toggleResetIndex"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono text-xs transition-all shadow-2xs cursor-pointer"
          :class="isResetIndex ? 'bg-amber-500 text-slate-950 font-bold border-amber-500' : 'bg-card border-line text-muted hover:text-ink hover:bg-card-subtle'"
          title="Toggle df.reset_index(drop=True)"
        >
          <RefreshCw class="w-3.5 h-3.5" />
          <span>reset_index(drop={{ isResetIndex }})</span>
        </button>
      </div>
    </div>

    <!-- Main Workspace Container -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <!-- 1. MASK EVALUATION VIEW (Base table + Injected Boolean Mask Column) -->
      <div v-if="!isFilteredView" class="flex flex-col gap-4 items-center w-full">
        <!-- Syntax Formula Callout -->
        <div class="flex items-center gap-2 text-xs font-mono bg-card px-3 py-1.5 rounded-full border border-line shadow-2xs">
          <span class="text-muted">Boolean Mask Generation:</span>
          <code class="text-brand-blue font-bold">mask = {{ activePreset.syntax.replace('df[', '').slice(0, -1) }}</code>
        </div>

        <div class="overflow-x-auto max-w-full">
          <table class="dataframe">
            <thead>
              <tr>
                <th class="bg-card-subtle text-muted text-[10px] text-left pr-3">index</th>
                <th>name</th>
                <th>dept</th>
                <th>age</th>
                <th>salary</th>
                <!-- Injected Boolean Mask Column Header -->
                <th class="bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-bold border-l-2 border-emerald-500">
                  <div class="flex items-center gap-1 justify-center">
                    <span>mask (bool)</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, rIdx) in baseRecords"
                :key="'eval-row-' + rIdx"
                class="transition-all"
                :class="[
                  maskResults[rIdx]
                    ? 'bg-emerald-500/10'
                    : 'opacity-40 hover:opacity-75'
                ]"
              >
                <!-- Original Index -->
                <th class="text-left font-bold" :class="maskResults[rIdx] ? 'text-emerald-800 dark:text-emerald-300' : 'text-muted'">
                  {{ row.origIdx }}
                </th>

                <!-- Columns -->
                <td class="text-left font-mono text-xs">{{ row.name }}</td>
                <td class="text-left font-mono text-xs">{{ row.dept }}</td>
                <td class="text-right font-mono text-xs text-brand-blue">{{ row.age }}</td>
                <td class="text-right font-mono text-xs text-cyan-700 dark:text-cyan-400 font-semibold">{{ row.salary.toFixed(1) }}</td>

                <!-- Evaluated Boolean Mask Cell -->
                <td
                  class="text-center font-mono text-xs border-l-2 border-emerald-500/60 font-bold"
                  :class="maskResults[rIdx] ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/20' : 'text-red-500 dark:text-red-400 bg-red-500/10'"
                >
                  <span class="inline-flex items-center gap-1">
                    <CheckCircle2 v-if="maskResults[rIdx]" class="w-3.5 h-3.5 text-emerald-500" />
                    <XCircle v-else class="w-3.5 h-3.5 text-red-500" />
                    <span>{{ maskResults[rIdx] ? 'True' : 'False' }}</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div class="dataframe-footer text-xs font-mono text-muted flex items-center justify-between w-full max-w-xl px-2">
          <span>5 rows × 4 columns</span>
          <span class="text-emerald-600 dark:text-emerald-400 font-bold">
            Matches: {{ matchingRecords.length }} / 5 True
          </span>
        </div>
      </div>

      <!-- 2. EXTRACTED SUB-DATAFRAME VIEW (df[mask]) -->
      <div v-else class="flex flex-col gap-4 items-center w-full animate-fade-in">
        <!-- Sub-DataFrame Header -->
        <div class="flex items-center gap-2 text-xs font-mono bg-card px-3 py-1.5 rounded-full border border-line shadow-2xs">
          <span class="text-muted">Result of:</span>
          <code class="text-emerald-600 dark:text-emerald-400 font-bold">{{ activePreset.syntax }}</code>
        </div>

        <div class="overflow-x-auto max-w-full">
          <table class="dataframe">
            <thead>
              <tr>
                <!-- Index Header with Notice -->
                <th
                  class="text-[10px] text-left pr-3 font-mono"
                  :class="isResetIndex ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold' : 'bg-card-subtle text-muted'"
                >
                  {{ isResetIndex ? 'index (reset)' : 'index (preserved)' }}
                </th>
                <th>name</th>
                <th>dept</th>
                <th>age</th>
                <th>salary</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(row, rIdx) in matchingRecords"
                :key="'sub-match-' + row.origIdx"
                class="hover:bg-card-subtle transition-colors"
              >
                <!-- Preserved vs Reset Index -->
                <th
                  class="text-left font-bold"
                  :class="isResetIndex ? 'text-amber-700 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20' : 'text-ink bg-card-subtle'"
                >
                  <div class="flex items-center gap-1.5">
                    <span>{{ isResetIndex ? rIdx : row.origIdx }}</span>
                    <span v-if="!isResetIndex" class="text-[9px] text-muted font-normal">(orig)</span>
                  </div>
                </th>

                <!-- Columns -->
                <td class="text-left font-mono text-xs">{{ row.name }}</td>
                <td class="text-left font-mono text-xs">{{ row.dept }}</td>
                <td class="text-right font-mono text-xs text-brand-blue">{{ row.age }}</td>
                <td class="text-right font-mono text-xs text-cyan-700 dark:text-cyan-400 font-semibold">{{ row.salary.toFixed(1) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div class="dataframe-footer text-xs font-mono text-muted flex items-center justify-between w-full max-w-lg px-2">
          <span>{{ matchingRecords.length }} rows × 4 columns</span>
          <span class="text-[11px] font-semibold" :class="isResetIndex ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'">
            Index Rail: {{ isResetIndex ? `RangeIndex(0, ${matchingRecords.length})` : `Non-consecutive [${matchingRecords.map(r => r.origIdx).join(', ')}]` }}
          </span>
        </div>
      </div>

      <!-- Bottom Invariant Banner -->
      <div class="mt-4 pt-3 border-t border-line/60 flex items-center justify-between gap-3 text-xs font-mono flex-wrap">
        <div class="flex items-center gap-2 text-muted">
          <span class="w-2 h-2 rounded-full" :class="isResetIndex ? 'bg-amber-500' : 'bg-emerald-500'" />
          <span class="text-ink font-semibold">Index Retention Invariant:</span>
          <span>Pandas row filtering never re-indexes. Use <code class="bg-card px-1 py-0.2 rounded border border-line text-ink">df.reset_index(drop=True)</code> when sequential 0..N indices are required.</span>
        </div>
      </div>
    </div>

    <!-- Educational HUD Footer Bar -->
    <div class="rounded-lg border border-line bg-card p-3 shadow-2xs font-mono text-xs flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 text-muted">
        <Sparkles class="w-4 h-4 text-brand-blue shrink-0" />
        <span>Condition Mechanics:</span>
        <span class="text-ink font-semibold">
          {{ activePreset.description }}. Resulting boolean array aligns row-for-row with the source DataFrame index.
        </span>
      </div>

      <div class="text-ink font-bold bg-card-subtle px-2 py-0.5 rounded border border-line">
        Bitwise Precedence: Use (&) and (|) with parentheses
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
