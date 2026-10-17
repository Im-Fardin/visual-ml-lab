<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Cpu,
  Layers,
  ArrowRight,
  Database,
  Gauge,
  Sparkles,
  Info,
  CheckCircle2,
  HardDrive,
  FileCode,
  RotateCcw
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Sample Data -----------------------------------------------------------
interface RecordRow {
  id: number
  region: string
  tier: string
  code_region: number
  code_tier: number
}

const sampleRows: RecordRow[] = [
  { id: 0, region: 'North America', tier: 'Enterprise', code_region: 0, code_tier: 0 },
  { id: 1, region: 'Europe', tier: 'Pro', code_region: 1, code_tier: 1 },
  { id: 2, region: 'Asia Pacific', tier: 'Free', code_region: 2, code_tier: 2 },
  { id: 3, region: 'North America', tier: 'Pro', code_region: 0, code_tier: 1 },
  { id: 4, region: 'Europe', tier: 'Enterprise', code_region: 1, code_tier: 0 },
  { id: 5, region: 'North America', tier: 'Enterprise', code_region: 0, code_tier: 0 },
  { id: 6, region: 'Asia Pacific', tier: 'Pro', code_region: 2, code_tier: 1 },
  { id: 7, region: 'Europe', tier: 'Free', code_region: 1, code_tier: 2 }
]

const categoriesRegion = ['North America', 'Europe', 'Asia Pacific']
const categoriesTier = ['Enterprise', 'Pro', 'Free']

// --- State -----------------------------------------------------------------
type DtypeState = 'object' | 'category'
const currentDtype = ref<DtypeState>('object')
const simulatedRowCount = ref<10000 | 100000 | 1000000>(100000)
const selectedRowIdx = ref<number | null>(null)

// --- Computeds -------------------------------------------------------------
// Realistic RAM calculation:
// Object dtype: 8 bytes (pointer in numpy array) + ~64 bytes PyObject header + string bytes (~15 bytes) = ~87 bytes per string element.
// Category dtype: 1 byte (int8 code in numpy array) + category lookup dictionary (negligible amortized over 100k rows).
const memoryStats = computed(() => {
  const N = simulatedRowCount.value

  // 2 text columns (region + tier)
  const objectBytesPerElem = 8 + 64 + 14 // ~86 bytes
  const categoryBytesPerElem = 1 // int8 = 1 byte

  const objectRamKb = (N * 2 * objectBytesPerElem) / 1024
  const categoryRamKb = (N * 2 * categoryBytesPerElem + (3 * 2 * objectBytesPerElem)) / 1024

  const savingsPct = Math.round(((objectRamKb - categoryRamKb) / objectRamKb) * 100)

  return {
    objectMb: (objectRamKb / 1024).toFixed(2),
    categoryMb: (categoryRamKb / 1024).toFixed(2),
    savingsPct,
    currentMb: currentDtype.value === 'object' ? (objectRamKb / 1024).toFixed(2) : (categoryRamKb / 1024).toFixed(2)
  }
})

const activeCodeSnippet = computed(() => {
  if (currentDtype.value === 'object') {
    return `# Default Ingestion: Text columns stored as generic Python objects
df['region'].dtype  # dtype('O') -> 64-bit pointers to heap PyObjects
df.memory_usage(deep=True)  # ~${memoryStats.value.objectMb} MB memory consumption`
  } else {
    return `# Optimized Ingestion: Dictionary encoding into integer codes
df['region'] = df['region'].astype('category')
df['tier'] = df['tier'].astype('category')

# Internal storage:
df['region'].cat.codes       # int8 array [0, 1, 2, 0, ...]
df['region'].cat.categories  # Index(['North America', 'Europe', 'Asia Pacific'])
df.memory_usage(deep=True)   # ~${memoryStats.value.categoryMb} MB (${memoryStats.value.savingsPct}% reduction!)`
  }
})

// --- Methods ---------------------------------------------------------------
const emitInspection = () => {
  emit('inspect', {
    title: currentDtype.value === 'object' ? "dtype('O') [String Objects]" : "dtype('category') [Dictionary Encoded]",
    details: {
      'Active Dtype': currentDtype.value === 'object' ? 'object (PyObject pointer)' : 'category (int8 codes)',
      'Simulated Rows': simulatedRowCount.value.toLocaleString(),
      'Memory Footprint': `${memoryStats.value.currentMb} MB`,
      'Storage Invariant': currentDtype.value === 'object' ? '64-bit Pointer + PyObject heap duplicate' : '1-byte int8 code -> Shared Dictionary Lookup',
      'RAM Compaction': currentDtype.value === 'object' ? 'Baseline (0% saved)' : `${memoryStats.value.savingsPct}% memory freed`,
      'Inspected Row': selectedRowIdx.value !== null ? `Row #${selectedRowIdx.value}` : 'None'
    }
  })
}

const setDtype = (dt: DtypeState) => {
  currentDtype.value = dt
  emitInspection()
}

const selectRow = (idx: number) => {
  selectedRowIdx.value = idx
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
      <!-- Dtype Toggle -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">Column Dtype:</span>
        <button
          type="button"
          @click="setDtype('object')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="currentDtype === 'object' ? 'bg-amber-600 text-white font-bold border-amber-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          dtype('O') [String Object]
        </button>
        <button
          type="button"
          @click="setDtype('category')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="currentDtype === 'category' ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          astype('category') [Int8 Codes]
        </button>

        <span class="text-line mx-1">|</span>

        <!-- Scale Simulator -->
        <span class="text-muted">Simulate Scale:</span>
        <button
          v-for="count in [10000, 100000, 1000000]"
          :key="count"
          type="button"
          @click="simulatedRowCount = count as any; emitInspection()"
          class="px-2 py-0.5 rounded border text-[11px]"
          :class="simulatedRowCount === count ? 'bg-brand-blue/15 text-brand-blue font-bold border-brand-blue/40' : 'bg-card border-line text-muted'"
        >
          {{ count >= 1000000 ? '1M rows' : count >= 1000 ? `${count / 1000}k rows` : `${count} rows` }}
        </button>
      </div>

      <!-- RAM Gauge Metric -->
      <div class="flex items-center gap-2 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <Gauge class="w-3.5 h-3.5" :class="currentDtype === 'category' ? 'text-emerald-500' : 'text-amber-500'" />
        <span class="font-bold text-ink">RAM Footprint:</span>
        <span
          class="font-mono font-bold"
          :class="currentDtype === 'category' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'"
        >
          {{ memoryStats.currentMb }} MB
        </span>
        <span
          v-if="currentDtype === 'category'"
          class="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold"
        >
          -{{ memoryStats.savingsPct }}%
        </span>
      </div>
    </div>

    <!-- Main Memory Comparison Arena -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- LEFT 7 COLS: Authentic Jupyter DataFrame View -->
        <div class="lg:col-span-7 flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1.5">
            <span class="flex items-center gap-1.5">
              <Database class="w-4 h-4" :class="currentDtype === 'category' ? 'text-emerald-500' : 'text-amber-500'" />
              <span>df.head(8)</span>
              <span class="text-[11px] font-normal text-muted">
                ({{ currentDtype === 'object' ? 'object pointers' : 'category encoded' }})
              </span>
            </span>
            <span class="text-[11px] font-normal text-muted">
              {{ currentDtype === 'category' ? 'cat.codes + cat.categories' : 'PyObject Heap References' }}
            </span>
          </div>

          <div class="overflow-x-auto w-full">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-10 text-center text-muted">#</th>
                  <th class="text-left font-bold text-ink">region</th>
                  <th class="text-left font-bold text-ink">tier</th>
                  <th class="text-center font-bold text-muted text-[10px]">Cell Memory</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in sampleRows"
                  :key="row.id"
                  @click="selectRow(idx)"
                  class="cursor-pointer transition-colors"
                  :class="[
                    selectedRowIdx === idx ? 'bg-brand-blue/10 font-medium' : 'hover:bg-card-subtle'
                  ]"
                >
                  <td class="text-center font-mono text-[11px] text-muted">{{ row.id }}</td>

                  <!-- Region Column -->
                  <td class="font-mono py-1.5">
                    <div v-if="currentDtype === 'object'" class="flex items-center justify-between">
                      <span class="text-ink font-medium">{{ row.region }}</span>
                      <span class="text-[10px] text-muted font-mono">ptr → 0x{{ (0x4a00 + idx * 80).toString(16) }}</span>
                    </div>
                    <div v-else class="flex items-center justify-between">
                      <span class="text-ink font-semibold">{{ row.region }}</span>
                      <span class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold">
                        code={{ row.code_region }}
                      </span>
                    </div>
                  </td>

                  <!-- Tier Column -->
                  <td class="font-mono py-1.5">
                    <div v-if="currentDtype === 'object'" class="flex items-center justify-between">
                      <span class="text-ink font-medium">{{ row.tier }}</span>
                      <span class="text-[10px] text-muted font-mono">ptr → 0x{{ (0x8b00 + idx * 80).toString(16) }}</span>
                    </div>
                    <div v-else class="flex items-center justify-between">
                      <span class="text-ink font-semibold">{{ row.tier }}</span>
                      <span class="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold">
                        code={{ row.code_tier }}
                      </span>
                    </div>
                  </td>

                  <!-- Cell Memory Metric -->
                  <td class="text-center font-mono text-[10px]">
                    <span v-if="currentDtype === 'object'" class="text-amber-600 dark:text-amber-400 font-bold">
                      ~86 bytes
                    </span>
                    <span v-else class="text-emerald-600 dark:text-emerald-400 font-bold">
                      1 byte (int8)
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Bottom Summary Indicator -->
          <div class="p-2.5 rounded border border-line bg-card-subtle text-[11px] font-mono text-muted flex items-center justify-between">
            <span>Dtypes: <strong class="text-ink">{{ currentDtype === 'object' ? 'object, object' : 'category, category' }}</strong></span>
            <span>Index: <strong class="text-ink">RangeIndex(0, {{ simulatedRowCount.toLocaleString() }})</strong></span>
            <span>Est. RAM: <strong :class="currentDtype === 'category' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'">{{ memoryStats.currentMb }} MB</strong></span>
          </div>
        </div>

        <!-- RIGHT 5 COLS: Memory Layout Architecture Visualizer -->
        <div class="lg:col-span-5 flex flex-col gap-3">
          <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1.5">
            <span class="flex items-center gap-1.5">
              <Cpu class="w-4 h-4 text-brand-blue" />
              Physical RAM Layout
            </span>
            <span class="text-[11px] font-normal text-muted">Architecture Diagram</span>
          </div>

          <!-- OBJECT MEMORY DIAGRAM -->
          <div v-if="currentDtype === 'object'" class="flex flex-col gap-2.5">
            <div class="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 flex flex-col gap-2">
              <div class="text-xs font-mono font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <HardDrive class="w-3.5 h-3.5" />
                <span>Object Dtype: Heavy Pointer Indirection</span>
              </div>
              <p class="text-[11px] font-mono text-muted leading-relaxed">
                Pandas allocates an array of <strong>64-bit pointers</strong>. Each pointer references an isolated <code>PyUnicodeObject</code> on Python's garbage-collected heap.
              </p>

              <!-- Box Visual of Pointers -->
              <div class="rounded border border-line bg-card p-2 font-mono text-[10px] space-y-1">
                <div class="text-muted font-bold text-[9px] uppercase">Contiguous Buffer:</div>
                <div class="grid grid-cols-4 gap-1 text-center font-bold text-ink">
                  <div class="p-1 rounded bg-muted/15 border border-line">0x4a00</div>
                  <div class="p-1 rounded bg-muted/15 border border-line">0x4a50</div>
                  <div class="p-1 rounded bg-muted/15 border border-line">0x4aa0</div>
                  <div class="p-1 rounded bg-muted/15 border border-line">0x4af0</div>
                </div>
                <div class="text-amber-600 dark:text-amber-400 text-center text-[9px] pt-1">
                  ↓ ↓ ↓ Pointers scattered across Python Heap ↓ ↓ ↓
                </div>
                <div class="p-1.5 rounded bg-amber-500/10 border border-amber-500/30 text-ink text-[10px] space-y-0.5">
                  <div>[PyObject Header (64B)] + "North America"</div>
                  <div>[PyObject Header (64B)] + "Europe"</div>
                  <div>[PyObject Header (64B)] + "Asia Pacific"</div>
                </div>
              </div>
            </div>

            <!-- Warning Card -->
            <div class="rounded-md border border-line bg-card-subtle p-2.5 text-xs font-mono text-muted space-y-1">
              <div class="text-amber-700 dark:text-amber-300 font-bold text-[11px]">Memory Bloat Warning:</div>
              <p class="text-[11px]">
                Identical string values ("North America") are duplicated repeatedly in memory. CPU cache misses spike due to pointer dereferencing.
              </p>
            </div>
          </div>

          <!-- CATEGORY MEMORY DIAGRAM -->
          <div v-else class="flex flex-col gap-2.5">
            <div class="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 flex flex-col gap-2">
              <div class="text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                <CheckCircle2 class="w-3.5 h-3.5" />
                <span>Categorical: Two-Part Lookup Dictionary</span>
              </div>
              <p class="text-[11px] font-mono text-muted leading-relaxed">
                Unique strings are stored <strong>exactly once</strong> in a category lookup index. The DataFrame cells store tiny <code>int8</code> (1-byte) codes.
              </p>

              <!-- Box Visual of Codes and Categories -->
              <div class="rounded border border-line bg-card p-2 font-mono text-[10px] space-y-2">
                <div>
                  <div class="text-muted font-bold text-[9px] uppercase">1. Compact Codes Array (int8, 1 byte/row):</div>
                  <div class="grid grid-cols-8 gap-1 text-center font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    <div class="p-1 rounded bg-emerald-500/10 border border-emerald-500/30">0</div>
                    <div class="p-1 rounded bg-emerald-500/10 border border-emerald-500/30">1</div>
                    <div class="p-1 rounded bg-emerald-500/10 border border-emerald-500/30">2</div>
                    <div class="p-1 rounded bg-emerald-500/10 border border-emerald-500/30">0</div>
                    <div class="p-1 rounded bg-emerald-500/10 border border-emerald-500/30">1</div>
                    <div class="p-1 rounded bg-emerald-500/10 border border-emerald-500/30">0</div>
                    <div class="p-1 rounded bg-emerald-500/10 border border-emerald-500/30">2</div>
                    <div class="p-1 rounded bg-emerald-500/10 border border-emerald-500/30">1</div>
                  </div>
                </div>

                <div>
                  <div class="text-muted font-bold text-[9px] uppercase">2. Shared Category Index (3 entries total):</div>
                  <div class="p-1.5 rounded bg-card-subtle border border-line text-ink text-[10px] space-y-0.5 mt-0.5">
                    <div>0 → "North America"</div>
                    <div>1 → "Europe"</div>
                    <div>2 → "Asia Pacific"</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Savings Summary Callout -->
            <div class="rounded-md border border-line bg-card-subtle p-2.5 text-xs font-mono text-muted space-y-1">
              <div class="text-emerald-700 dark:text-emerald-400 font-bold text-[11px] flex items-center justify-between">
                <span>Memory Compression Ratio:</span>
                <span>{{ memoryStats.savingsPct }}% SAVINGS</span>
              </div>
              <p class="text-[11px]">
                On {{ simulatedRowCount.toLocaleString() }} rows, memory drops from <strong>{{ memoryStats.objectMb }} MB</strong> down to <strong>{{ memoryStats.categoryMb }} MB</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Invariant Action Strip -->
      <div class="mt-6 pt-3 border-t border-line flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="setDtype(currentDtype === 'object' ? 'category' : 'object')"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-blue text-white text-xs font-mono font-medium hover:bg-brand-blue/90 shadow-2xs cursor-pointer"
          >
            <Sparkles class="w-3.5 h-3.5" />
            <span>Switch to {{ currentDtype === 'object' ? 'Categorical (Optimize)' : 'Object (Bloated)' }}</span>
          </button>

          <button
            type="button"
            @click="setDtype('object'); selectedRowIdx = null"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card text-xs font-mono text-muted hover:text-ink hover:bg-card-subtle shadow-2xs cursor-pointer"
            title="Reset"
          >
            <RotateCcw class="w-3.5 h-3.5" />
          </button>
        </div>

        <div class="text-xs font-mono text-muted">
          <span>Card Ratio: </span>
          <strong class="text-ink">Low Cardinality = Maximum Compaction</strong>
        </div>
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active Memory Optimization Command:</span>
        <span class="text-emerald-600 dark:text-emerald-400 font-semibold">{{ currentDtype === 'category' ? 'Categorical Dtype' : 'Unoptimized Object Dtype' }}</span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ activeCodeSnippet }}</code></pre>
    </div>
  </div>
</template>

