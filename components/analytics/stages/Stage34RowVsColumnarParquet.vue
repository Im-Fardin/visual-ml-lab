<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  FileSpreadsheet,
  FileBox,
  Layers,
  ArrowRight,
  Database,
  CheckCircle2,
  AlertTriangle,
  Zap,
  HardDrive,
  Cpu,
  Sparkles,
  RotateCcw
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
  department: string
  role: string
  salary: number
  hire_date: string
}

const sampleData: EmployeeRow[] = [
  { id: 101, name: 'Alice Smith', department: 'Engineering', role: 'Staff Eng', salary: 145000, hire_date: '2021-03-15' },
  { id: 102, name: 'Bob Jones', department: 'Marketing', role: 'Lead Strategist', salary: 98000, hire_date: '2022-06-01' },
  { id: 103, name: 'Charlie Kim', department: 'Engineering', role: 'DevOps Lead', salary: 132000, hire_date: '2020-11-20' },
  { id: 104, name: 'Diana Vance', department: 'Finance', role: 'Controller', salary: 115000, hire_date: '2019-08-10' },
  { id: 105, name: 'Evan Wright', department: 'Sales', role: 'Account Exec', salary: 88000, hire_date: '2023-01-09' },
  { id: 106, name: 'Fiona Gallagher', department: 'Engineering', role: 'Frontend Architect', salary: 140000, hire_date: '2021-07-14' }
]

const columns = [
  { key: 'id', label: 'id', type: 'int64', estBytes: 8 },
  { key: 'name', label: 'name', type: 'string', estBytes: 24 },
  { key: 'department', label: 'department', type: 'string', estBytes: 16 },
  { key: 'role', label: 'role', type: 'string', estBytes: 20 },
  { key: 'salary', label: 'salary', type: 'int64', estBytes: 8 },
  { key: 'hire_date', label: 'hire_date', type: 'string', estBytes: 12 }
]

// --- State -----------------------------------------------------------------
type QueryType = 'salary_only' | 'dept_salary' | 'all_cols'
const selectedQuery = ref<QueryType>('salary_only')

type StorageFormat = 'both' | 'csv' | 'parquet'
const viewMode = ref<StorageFormat>('both')

// --- Computeds -------------------------------------------------------------
const activeQueryColumns = computed<string[]>(() => {
  if (selectedQuery.value === 'salary_only') {
    return ['salary']
  } else if (selectedQuery.value === 'dept_salary') {
    return ['department', 'salary']
  } else {
    return ['id', 'name', 'department', 'role', 'salary', 'hire_date']
  }
})

// Column is scanned in Parquet
const isColReadInParquet = (colKey: string) => {
  return activeQueryColumns.value.includes(colKey)
}

// In CSV, ALL columns are ALWAYS scanned from disk!
const isColReadInCsv = (_colKey: string) => {
  return true
}

// Simulated real-world 10M rows I/O metrics
const ioMetrics = computed(() => {
  // Assuming a 10M row table
  const csvTotalMb = 840 // 840 MB raw CSV
  const parquetTotalMb = 145 // 145 MB compressed Parquet

  let csvScannedMb = csvTotalMb // Always scans 100%
  let parquetScannedMb = 0

  if (selectedQuery.value === 'salary_only') {
    parquetScannedMb = Math.round(parquetTotalMb * (8 / 88)) // only salary column (~13 MB)
  } else if (selectedQuery.value === 'dept_salary') {
    parquetScannedMb = Math.round(parquetTotalMb * (24 / 88)) // dept + salary (~39 MB)
  } else {
    parquetScannedMb = parquetTotalMb
  }

  const ioSkippedPct = Math.round(((csvScannedMb - parquetScannedMb) / csvScannedMb) * 100)
  const speedupFactor = (csvScannedMb / Math.max(1, parquetScannedMb)).toFixed(1)

  return {
    csvScannedMb,
    parquetScannedMb,
    ioSkippedPct,
    speedupFactor
  }
})

const activeCodeSnippet = computed(() => {
  if (selectedQuery.value === 'salary_only') {
    return `# --- Query: df['salary'].mean() ---
# 1. Row-Oriented CSV: Must parse 100% of rows and columns across entire disk file
df_csv = pd.read_csv('employees.csv') # Reads 840 MB
mean_salary = df_csv['salary'].mean()

# 2. Column-Oriented Parquet: Column projection pushdown reads ONLY the 'salary' block!
df_parquet = pd.read_parquet('employees.parquet', columns=['salary']) # Reads ~13 MB (98% I/O skipped!)
mean_salary = df_parquet['salary'].mean()`
  } else if (selectedQuery.value === 'dept_salary') {
    return `# --- Query: df[['department', 'salary']].groupby('department').mean() ---
# CSV: Full table scan
df_csv = pd.read_csv('employees.csv')[['department', 'salary']]

# Parquet: Reads ONLY 2 columnar blocks directly from disk
df_parquet = pd.read_parquet('employees.parquet', columns=['department', 'salary'])`
  } else {
    return `# --- Query: SELECT * (All Columns) ---
df_csv = pd.read_csv('employees.csv')         # 840 MB (Raw text parsing)
df_parquet = pd.read_parquet('employees.parquet') # 145 MB (Snappy compressed vectors)`
  }
})

// --- Methods ---------------------------------------------------------------
const emitInspection = () => {
  emit('inspect', {
    title: 'Row (CSV) vs Columnar (Parquet) I/O Pushdown',
    details: {
      'Active Query': selectedQuery.value === 'salary_only' ? "df['salary'].mean()" : selectedQuery.value === 'dept_salary' ? "df[['department', 'salary']]" : "df.all()",
      'Requested Columns': activeQueryColumns.value.join(', '),
      'CSV Disk I/O': `${ioMetrics.value.csvScannedMb} MB (100% full table scan)`,
      'Parquet Disk I/O': `${ioMetrics.value.parquetScannedMb} MB (Projection Pushdown)`,
      'Disk I/O Saved': `${ioMetrics.value.ioSkippedPct}% bypassed`,
      'Query Acceleration': `${ioMetrics.value.speedupFactor}x faster I/O throughput`,
      'Encoding': 'Snappy + Dictionary + RLE'
    }
  })
}

const setQuery = (q: QueryType) => {
  selectedQuery.value = q
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
      <!-- Query Selector -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">Target Query:</span>
        <button
          type="button"
          @click="setQuery('salary_only')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="selectedQuery === 'salary_only' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          df['salary'].mean() [1 Col]
        </button>
        <button
          type="button"
          @click="setQuery('dept_salary')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="selectedQuery === 'dept_salary' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          df[['dept', 'salary']] [2 Cols]
        </button>
        <button
          type="button"
          @click="setQuery('all_cols')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="selectedQuery === 'all_cols' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          df.all() [Full Scan]
        </button>
      </div>

      <!-- I/O Efficiency Badge -->
      <div class="flex items-center gap-2 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <Zap class="w-3.5 h-3.5 text-emerald-500" />
        <span class="font-bold text-ink">Parquet I/O Speedup:</span>
        <span class="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
          {{ ioMetrics.speedupFactor }}x Throughput
        </span>
        <span class="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold">
          -{{ ioMetrics.ioSkippedPct }}% I/O
        </span>
      </div>
    </div>

    <!-- Main Comparison Arena -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <!-- LEFT BAY: CSV Row-Oriented Physical Storage -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1.5">
            <span class="flex items-center gap-1.5">
              <FileSpreadsheet class="w-4 h-4 text-amber-500" />
              <span>Row-Oriented: CSV / SQLite</span>
            </span>
            <span class="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
              100% Full Scan Required
            </span>
          </div>

          <!-- Explanatory note -->
          <p class="text-[11px] font-mono text-muted leading-tight">
            Data is stored sequentially row-by-row on disk. To extract <code>salary</code>, the disk engine MUST parse every preceding string and delimiter.
          </p>

          <div class="overflow-x-auto w-full">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th
                    v-for="col in columns"
                    :key="col.key"
                    class="text-left font-bold transition-colors"
                    :class="[
                      'bg-amber-500/20 text-amber-900 dark:text-amber-200 border-b-2 border-amber-500 font-bold'
                    ]"
                  >
                    {{ col.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in sampleData"
                  :key="row.id"
                  class="bg-amber-500/5 transition-colors"
                >
                  <td
                    v-for="col in columns"
                    :key="col.key"
                    class="font-mono py-1 border-r border-line/40 last:border-0"
                    :class="[
                      activeQueryColumns.includes(col.key)
                        ? 'text-ink font-bold bg-amber-500/15'
                        : 'text-amber-800/70 dark:text-amber-300/70'
                    ]"
                  >
                    {{ (row as any)[col.key] }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Disk I/O Metric Footer -->
          <div class="p-2.5 rounded border border-amber-500/30 bg-amber-500/10 text-[11px] font-mono text-amber-900 dark:text-amber-200 flex items-center justify-between">
            <span>Disk I/O Scanned: <strong>{{ ioMetrics.csvScannedMb }} MB (All Columns)</strong></span>
            <span>Wasted I/O: <strong>{{ ioMetrics.ioSkippedPct }}%</strong></span>
          </div>
        </div>

        <!-- RIGHT BAY: Parquet Columnar Storage (Projection Pushdown) -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1.5">
            <span class="flex items-center gap-1.5">
              <FileBox class="w-4 h-4 text-emerald-500" />
              <span>Column-Oriented: Apache Parquet</span>
            </span>
            <span class="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
              Projection Pushdown Active
            </span>
          </div>

          <!-- Explanatory note -->
          <p class="text-[11px] font-mono text-muted leading-tight">
            Columns are stored as contiguous binary arrays with Snappy compression. The reader seeks directly to the target column's byte offset.
          </p>

          <div class="overflow-x-auto w-full">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th
                    v-for="col in columns"
                    :key="col.key"
                    class="text-left font-bold transition-colors"
                    :class="[
                      isColReadInParquet(col.key)
                        ? 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 border-b-2 border-emerald-500 font-bold'
                        : 'bg-muted/10 text-muted/60 opacity-50'
                    ]"
                  >
                    {{ col.label }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in sampleData"
                  :key="row.id"
                  class="transition-colors"
                >
                  <td
                    v-for="col in columns"
                    :key="col.key"
                    class="font-mono py-1 border-r border-line/40 last:border-0 transition-colors"
                    :class="[
                      isColReadInParquet(col.key)
                        ? 'bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 font-bold'
                        : 'text-muted/40 opacity-30 select-none'
                    ]"
                  >
                    <span v-if="isColReadInParquet(col.key)">
                      {{ (row as any)[col.key] }}
                    </span>
                    <span v-else class="text-[10px] font-mono">
                      [skipped]
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Disk I/O Metric Footer -->
          <div class="p-2.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-mono text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
            <span>Disk I/O Scanned: <strong>{{ ioMetrics.parquetScannedMb }} MB (Target Block Only)</strong></span>
            <span>I/O Bypassed: <strong>{{ ioMetrics.ioSkippedPct }}%</strong></span>
          </div>
        </div>
      </div>

      <!-- Bottom Interactive Invariant & Summary Strip -->
      <div class="mt-6 pt-3 border-t border-line flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="setQuery('salary_only')"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-blue text-white text-xs font-mono font-medium hover:bg-brand-blue/90 shadow-2xs cursor-pointer"
          >
            <Sparkles class="w-3.5 h-3.5" />
            <span>Test Single Column Projection</span>
          </button>

          <button
            type="button"
            @click="setQuery('all_cols')"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card text-xs font-mono text-muted hover:text-ink hover:bg-card-subtle shadow-2xs cursor-pointer"
            title="Reset"
          >
            <RotateCcw class="w-3.5 h-3.5" />
          </button>
        </div>

        <div class="text-xs font-mono text-muted">
          <span>Columnar Storage Invariant: </span>
          <strong class="text-emerald-600 dark:text-emerald-400">Zero Unnecessary Disk Reads</strong>
        </div>
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active I/O Benchmark:</span>
        <span class="text-emerald-600 dark:text-emerald-400 font-semibold">{{ ioMetrics.speedupFactor }}x Faster Query Execution</span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ activeCodeSnippet }}</code></pre>
    </div>
  </div>
</template>

