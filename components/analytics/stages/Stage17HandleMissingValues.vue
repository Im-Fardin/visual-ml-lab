<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Trash2,
  ArrowDown,
  Sparkles,
  Info,
  Layers,
  Database
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Data Models -----------------------------------------------------------
interface EmployeeRow {
  id: number
  name: string
  age: number | null
  salary: number | null
  dept: string | null
}

const rawData: EmployeeRow[] = [
  { id: 0, name: 'Alice', age: 30, salary: 85000, dept: 'Engineering' },
  { id: 1, name: 'Bob', age: null, salary: 62000, dept: 'Marketing' },
  { id: 2, name: 'Charlie', age: 45, salary: null, dept: null },
  { id: 3, name: 'Diana', age: 28, salary: 58000, dept: 'Engineering' },
  { id: 4, name: 'Evan', age: null, salary: 72000, dept: 'Sales' }
]

type NullAction = 'raw' | 'isna' | 'dropna' | 'fillna_zero' | 'fillna_ffill' | 'fillna_mean'
const activeAction = ref<NullAction>('raw')

// Mean calculations for imputation
const meanAge = 34.3 // (30 + 45 + 28) / 3
const meanSalary = 69250 // (85000 + 62000 + 58000 + 72000) / 4

// Computed Rows based on active action
interface ProcessedRow {
  id: number
  name: string
  age: string
  salary: string
  dept: string
  ageIsNan: boolean
  salIsNan: boolean
  deptIsNan: boolean
  isImputed: boolean
}

const processedData = computed(() => {
  if (activeAction.value === 'dropna') {
    // Drop rows containing any NaN (keeps rows 0 and 3)
    const valid = rawData.filter(r => r.age !== null && r.salary !== null && r.dept !== null)
    return valid.map(r => ({
      id: r.id,
      name: r.name,
      age: String(r.age),
      salary: `$${r.salary!.toLocaleString()}`,
      dept: r.dept!,
      ageIsNan: false,
      salIsNan: false,
      deptIsNan: false,
      isImputed: false
    }))
  }

  // Pre-calculate ffill
  let lastAge = 30
  let lastSal = 85000
  let lastDept = 'Engineering'

  return rawData.map(r => {
    let displayAge = r.age !== null ? String(r.age) : 'NaN'
    let displaySal = r.salary !== null ? `$${r.salary.toLocaleString()}` : 'NaN'
    let displayDept = r.dept !== null ? r.dept : 'NaN'
    let isImputed = false

    if (activeAction.value === 'isna') {
      displayAge = r.age === null ? 'True' : 'False'
      displaySal = r.salary === null ? 'True' : 'False'
      displayDept = r.dept === null ? 'True' : 'False'
    } else if (activeAction.value === 'fillna_zero') {
      if (r.age === null) { displayAge = '0'; isImputed = true }
      if (r.salary === null) { displaySal = '$0'; isImputed = true }
      if (r.dept === null) { displayDept = 'Unknown'; isImputed = true }
    } else if (activeAction.value === 'fillna_ffill') {
      if (r.age !== null) lastAge = r.age
      else { displayAge = `${lastAge} (ffill)`; isImputed = true }

      if (r.salary !== null) lastSal = r.salary
      else { displaySal = `$${lastSal.toLocaleString()} (ffill)`; isImputed = true }

      if (r.dept !== null) lastDept = r.dept
      else { displayDept = `${lastDept} (ffill)`; isImputed = true }
    } else if (activeAction.value === 'fillna_mean') {
      if (r.age === null) { displayAge = `${meanAge} (μ)`; isImputed = true }
      if (r.salary === null) { displaySal = `$${meanSalary.toLocaleString()} (μ)`; isImputed = true }
      if (r.dept === null) { displayDept = 'Mode: Eng'; isImputed = true }
    }

    return {
      id: r.id,
      name: r.name,
      age: displayAge,
      salary: displaySal,
      dept: displayDept,
      ageIsNan: r.age === null,
      salIsNan: r.salary === null,
      deptIsNan: r.dept === null,
      isImputed
    }
  })
})

const activeCodeSnippet = computed(() => {
  if (activeAction.value === 'isna') {
    return `# 1. Detecting Missing Values
df.isna()          # Boolean DataFrame: True where NaN exists
df.isna().sum()    # Total missing count per column`
  } else if (activeAction.value === 'dropna') {
    return `# 2. Dropping Incomplete Rows
# Drops any row containing 1 or more NaNs
df_clean = df.dropna()
# or df.dropna(subset=['salary'])`
  } else if (activeAction.value === 'fillna_zero') {
    return `# 3. Constant Value Imputation
df['salary'] = df['salary'].fillna(0)
df['dept'] = df['dept'].fillna('Unknown')`
  } else if (activeAction.value === 'fillna_ffill') {
    return `# 4. Forward-Fill (ffill) Imputation
# Propagates the previous valid observation downward
df = df.ffill()`
  } else if (activeAction.value === 'fillna_mean') {
    return `# 5. Mean & Median Imputation
df['age'] = df['age'].fillna(df['age'].mean())
df['salary'] = df['salary'].fillna(df['salary'].median())`
  } else {
    return `# Raw DataFrame with Missing Values (NaN)
print(df.isna().sum())`
  }
})

const emitInspection = () => {
  emit('inspect', {
    title: `Missing Value Handling: ${activeAction.value.toUpperCase()}`,
    details: {
      'Total Records': rawData.length,
      'Active Rows': processedData.value.length,
      'Missing Counts': 'age: 2, salary: 1, dept: 1 (Total: 4 NaNs)',
      'Action Strategy': activeAction.value === 'isna' ? 'Detection (isna)' : activeAction.value === 'dropna' ? 'Row Elimination (dropna)' : 'Imputation (fillna)',
      'NaN Invariant': activeAction.value === 'dropna' ? 'Drops rows with any null (reduces sample size)' : 'Imputation preserves sample size but introduces distribution assumptions'
    }
  })
}

const setAction = (act: NullAction) => {
  activeAction.value = act
  emitInspection()
}

onMounted(() => emitInspection())
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <!-- Top Action Toolbar -->
    <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
      <!-- Strategy Selector -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">Mitigation:</span>
        <button
          type="button"
          @click="setAction('raw')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeAction === 'raw' ? 'bg-muted text-ink font-bold border-muted-dark' : 'bg-card border-line text-muted hover:text-ink'"
        >
          Raw (NaNs)
        </button>
        <button
          type="button"
          @click="setAction('isna')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeAction === 'isna' ? 'bg-amber-600 text-white font-bold border-amber-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          df.isna() [Bool Matrix]
        </button>
        <button
          type="button"
          @click="setAction('dropna')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeAction === 'dropna' ? 'bg-rose-600 text-white font-bold border-rose-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <Trash2 class="w-3.5 h-3.5" />
          <span>df.dropna()</span>
        </button>

        <span class="text-line mx-1">|</span>

        <button
          type="button"
          @click="setAction('fillna_mean')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeAction === 'fillna_mean' ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <Sparkles class="w-3.5 h-3.5" />
          <span>fillna(mean)</span>
        </button>
        <button
          type="button"
          @click="setAction('fillna_ffill')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeAction === 'fillna_ffill' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <ArrowDown class="w-3.5 h-3.5" />
          <span>fillna(ffill)</span>
        </button>
      </div>

      <!-- Quick Summary Badge -->
      <div class="flex items-center gap-2 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <span class="w-2 h-2 rounded-full" :class="activeAction === 'raw' ? 'bg-amber-500' : 'bg-emerald-500'" />
        <span class="font-bold text-ink">Rows: {{ processedData.length }}</span>
      </div>
    </div>

    <!-- Main Living Table Arena -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <div class="flex flex-col gap-3">
        <div class="text-xs font-mono font-bold text-ink border-b border-line pb-1.5 flex items-center justify-between">
          <span class="flex items-center gap-1.5">
            <Database class="w-4 h-4 text-brand-blue" />
            <span>Dataset Null Mitigation Table</span>
          </span>
          <span class="text-[10px] text-muted">
            {{ activeAction === 'dropna' ? 'Rows 1, 2, 4 dropped (Incomplete records eliminated)' : '4 Total Missing Entries (NaN)' }}
          </span>
        </div>

        <!-- Living Table -->
        <div class="overflow-x-auto w-full">
          <table class="dataframe w-full text-xs">
            <thead>
              <tr>
                <th class="w-10 text-center text-muted">#</th>
                <th class="text-left font-bold text-ink">name</th>
                <th class="text-right font-bold text-ink">age</th>
                <th class="text-right font-bold text-ink">salary</th>
                <th class="text-left font-bold text-ink">dept</th>
                <th class="text-center font-bold text-muted text-[10px]">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in processedData"
                :key="row.id"
                class="hover:bg-card-subtle transition-colors"
                :class="row.isImputed ? 'bg-emerald-500/5' : ''"
              >
                <td class="text-center font-mono text-[11px] text-muted">#{{ row.id }}</td>
                <td class="font-mono text-ink font-semibold py-2">{{ row.name }}</td>

                <!-- Age cell -->
                <td class="font-mono text-right py-2">
                  <span v-if="activeAction === 'isna'" :class="row.age === 'True' ? 'text-amber-600 font-bold' : 'text-muted'">
                    {{ row.age }}
                  </span>
                  <span v-else-if="row.age === 'NaN'" class="nan font-mono text-xs">NaN</span>
                  <span v-else :class="row.ageIsNan ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-ink'">
                    {{ row.age }}
                  </span>
                </td>

                <!-- Salary cell -->
                <td class="font-mono text-right py-2">
                  <span v-if="activeAction === 'isna'" :class="row.salary === 'True' ? 'text-amber-600 font-bold' : 'text-muted'">
                    {{ row.salary }}
                  </span>
                  <span v-else-if="row.salary === 'NaN'" class="nan font-mono text-xs">NaN</span>
                  <span v-else :class="row.salIsNan ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-ink'">
                    {{ row.salary }}
                  </span>
                </td>

                <!-- Dept cell -->
                <td class="font-mono text-left py-2">
                  <span v-if="activeAction === 'isna'" :class="row.dept === 'True' ? 'text-amber-600 font-bold' : 'text-muted'">
                    {{ row.dept }}
                  </span>
                  <span v-else-if="row.dept === 'NaN'" class="nan font-mono text-xs">NaN</span>
                  <span v-else :class="row.deptIsNan ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-ink'">
                    {{ row.dept }}
                  </span>
                </td>

                <!-- Row status -->
                <td class="text-center font-mono text-[10px]">
                  <span
                    v-if="row.isImputed"
                    class="px-1.5 py-0.2 rounded font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300"
                  >
                    Imputed
                  </span>
                  <span
                    v-else-if="row.ageIsNan || row.salIsNan || row.deptIsNan"
                    class="px-1.5 py-0.2 rounded font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300"
                  >
                    Has NaN
                  </span>
                  <span v-else class="text-muted text-[10px]">Complete</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Summary Strategy Note -->
        <div class="p-3 rounded-md border border-line bg-card-subtle font-mono text-xs flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <Info class="w-4 h-4 text-brand-blue shrink-0" />
            <span class="text-muted">Imputation Invariant:</span>
            <strong class="text-ink">Mean imputation preserves sample size but suppresses feature variance</strong>
          </div>
          <span class="text-muted text-[11px]">Use <code>dropna()</code> when sample size is large; use <code>fillna()</code> when dropping causes severe data loss.</span>
        </div>
      </div>

      <!-- Bottom Hint Strip -->
      <div class="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs font-mono text-muted">
        <span>Cleaned Status:</span>
        <strong :class="activeAction === 'raw' || activeAction === 'isna' ? 'text-amber-600' : 'text-emerald-600 dark:text-emerald-400'">
          {{ activeAction === 'raw' || activeAction === 'isna' ? 'Contains Unhandled NaNs' : 'Cleaned & Ready for Machine Learning' }}
        </strong>
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active Missing Data Operation:</span>
        <span class="text-brand-blue font-semibold">{{ activeAction === 'isna' ? 'Inspection' : activeAction === 'dropna' ? 'Elimination' : 'Imputation' }}</span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ activeCodeSnippet }}</code></pre>
    </div>
  </div>
</template>

