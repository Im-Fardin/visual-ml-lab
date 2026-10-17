<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Table,
  ArrowRight,
  RotateCcw,
  StepForward,
  Play,
  Layers,
  Sparkles,
  Calculator,
  Plus
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Data Models -----------------------------------------------------------
interface Transaction {
  id: number
  date: string
  region: 'East' | 'West'
  product: 'Laptop' | 'Phone'
  sales: number
}

const transactions: Transaction[] = [
  { id: 1, date: '2024-01-01', region: 'East', product: 'Laptop', sales: 1200 },
  { id: 2, date: '2024-01-02', region: 'West', product: 'Phone', sales: 600 },
  { id: 3, date: '2024-01-03', region: 'East', product: 'Phone', sales: 700 },
  { id: 4, date: '2024-01-04', region: 'West', product: 'Laptop', sales: 1500 },
  { id: 5, date: '2024-01-05', region: 'East', product: 'Laptop', sales: 800 },
  { id: 6, date: '2024-01-06', region: 'West', product: 'Phone', sales: 650 },
  { id: 7, date: '2024-01-07', region: 'East', product: 'Phone', sales: 750 },
  { id: 8, date: '2024-01-08', region: 'West', product: 'Laptop', sales: 1300 }
]

const regions: ('East' | 'West')[] = ['East', 'West']
const products: ('Laptop' | 'Phone')[] = ['Laptop', 'Phone']

// --- State -----------------------------------------------------------------
type AggFunc = 'mean' | 'sum'
const aggFunc = ref<AggFunc>('mean')
const showMargins = ref(false)

// Pipeline phase: 0 = Idle long table, 1 = Coordinate projection, 2 = Binning records, 3 = Aggregated matrix
const currentStep = ref(0)
const isPlaying = ref(false)
let playTimer: ReturnType<typeof setInterval> | null = null

// Selected cell for interactive drill-down
const selectedIntersection = ref<{ region: string; product: string } | null>(null)

// Computed bins for each (region, product) cell
const cellBins = computed(() => {
  const bins: Record<string, Transaction[]> = {}
  regions.forEach(r => {
    products.forEach(p => {
      const key = `${r}_${p}`
      bins[key] = transactions.filter(t => t.region === r && t.product === p)
    })
  })
  return bins
})

// Aggregated values
const aggregatedMatrix = computed(() => {
  const result: Record<string, Record<string, number>> = {
    East: {},
    West: {}
  }

  regions.forEach(r => {
    products.forEach(p => {
      const items = cellBins.value[`${r}_${p}`]
      const sum = items.reduce((acc, curr) => acc + curr.sales, 0)
      result[r][p] = aggFunc.value === 'sum' ? sum : sum / items.length
    })
  })

  return result
})

// Margin totals (All row & All column)
const marginCalculations = computed(() => {
  // Row margins (across products for each region)
  const rowMargins: Record<string, number> = {}
  regions.forEach(r => {
    const rItems = transactions.filter(t => t.region === r)
    const sum = rItems.reduce((acc, curr) => acc + curr.sales, 0)
    rowMargins[r] = aggFunc.value === 'sum' ? sum : sum / rItems.length
  })

  // Col margins (across regions for each product)
  const colMargins: Record<string, number> = {}
  products.forEach(p => {
    const pItems = transactions.filter(t => t.product === p)
    const sum = pItems.reduce((acc, curr) => acc + curr.sales, 0)
    colMargins[p] = aggFunc.value === 'sum' ? sum : sum / pItems.length
  })

  // Grand total
  const allSum = transactions.reduce((acc, curr) => acc + curr.sales, 0)
  const grandTotal = aggFunc.value === 'sum' ? allSum : allSum / transactions.length

  return { rowMargins, colMargins, grandTotal }
})

// Inspection telemetry
const emitInspection = () => {
  const stepTitles = [
    'Long Transaction Log (Input)',
    'Project (Index, Columns) Coordinates',
    'Bin Multi-Record Intersections',
    `Execute ${aggFunc.value.toUpperCase()} Reduction`
  ]

  const details: Record<string, any> = {
    'Pivot Table Call': `df.pivot_table(index='region', columns='product', values='sales', aggfunc='${aggFunc.value}', margins=${showMargins.value})`,
    'Transformation Phase': `[${currentStep.value}/3] ${stepTitles[currentStep.value]}`,
    'Dimensional Shift': `(8 rows × 4 cols) Long → (2 rows × 2 cols) Wide Matrix`,
    'Row Index': "['East', 'West'] (from region)",
    'Column Rail': "['Laptop', 'Phone'] (from product)",
    'Aggfunc': aggFunc.value === 'mean' ? 'np.mean (Average ticket size)' : 'np.sum (Total revenue)',
    'Margins Strategy': showMargins.value ? 'Enabled: Adds "All" marginal subtotals & grand total' : 'Disabled'
  }

  if (selectedIntersection.value) {
    const { region, product } = selectedIntersection.value
    const items = cellBins.value[`${region}_${product}`]
    details['Selected Cell'] = `[${region}, ${product}]`
    details['Matching Transactions'] = items.map(t => `$${t.sales}`).join(' + ')
    details['Cell Value'] = aggFunc.value === 'sum'
      ? `$${aggregatedMatrix.value[region][product]}`
      : `$${aggregatedMatrix.value[region][product].toFixed(2)}`
  }

  emit('inspect', {
    title: `Pivot Table: ${stepTitles[currentStep.value]}`,
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
  selectedIntersection.value = null
  emitInspection()
}

const selectCell = (region: string, product: string) => {
  selectedIntersection.value = { region, product }
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
      <!-- Aggregation Function Selector -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">aggfunc:</span>
        <button
          type="button"
          @click="aggFunc = 'mean'; emitInspection()"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="aggFunc === 'mean' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          'mean' (Average)
        </button>
        <button
          type="button"
          @click="aggFunc = 'sum'; emitInspection()"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="aggFunc === 'sum' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          'sum' (Total)
        </button>

        <span class="text-line mx-1">|</span>

        <!-- Margins Toggle -->
        <button
          type="button"
          @click="showMargins = !showMargins; emitInspection()"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="showMargins ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500 font-bold' : 'bg-card border-line text-muted hover:text-ink'"
          title="Toggle margins=True (Subtotals & Grand Total)"
        >
          <Calculator class="w-3.5 h-3.5" />
          <span>margins={{ showMargins }}</span>
        </button>
      </div>

      <!-- Step Indicator Badge -->
      <div class="flex items-center gap-1.5 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <span class="w-2 h-2 rounded-full" :class="currentStep === 3 ? 'bg-emerald-500' : 'bg-brand-blue'" />
        <span class="font-bold text-ink">Phase {{ currentStep }}/3:</span>
        <span class="text-muted">{{ currentStep === 0 ? 'Source Log' : currentStep === 1 ? 'Coordinates' : currentStep === 2 ? 'Binning' : 'Aggregated' }}</span>
      </div>
    </div>

    <!-- Main Reshaping Arena -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <div class="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        <!-- LEFT BAY: Long Transaction Log -->
        <div class="flex flex-col gap-2 w-full">
          <div class="flex items-center justify-between text-xs font-mono border-b border-line pb-1.5">
            <div class="flex items-center gap-1.5 font-bold text-ink">
              <Table class="w-3.5 h-3.5 text-brand-blue" />
              <span>Input: Long Format (8 rows × 4 cols)</span>
            </div>
            <span class="text-[10px] text-muted">df[['date', 'region', 'product', 'sales']]</span>
          </div>

          <div class="overflow-x-auto max-w-full">
            <table class="dataframe">
              <thead>
                <tr>
                  <th class="bg-card-subtle text-muted text-[10px]">#</th>
                  <th>date</th>
                  <th :class="currentStep >= 1 ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 font-bold' : ''">
                    region (index)
                  </th>
                  <th :class="currentStep >= 1 ? 'bg-blue-500/20 text-blue-800 dark:text-blue-300 font-bold' : ''">
                    product (cols)
                  </th>
                  <th :class="currentStep >= 2 ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold' : ''">
                    sales (values)
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="t in transactions"
                  :key="'tx-' + t.id"
                  class="transition-colors"
                  :class="[
                    selectedIntersection && selectedIntersection.region === t.region && selectedIntersection.product === t.product
                      ? 'bg-blue-100 dark:bg-blue-900/40 font-bold'
                      : ''
                  ]"
                >
                  <th class="text-muted text-[10px]">{{ t.id }}</th>
                  <td class="font-mono text-xs">{{ t.date }}</td>
                  <td class="font-mono text-xs font-semibold" :class="t.region === 'East' ? 'text-amber-700 dark:text-amber-400' : 'text-purple-700 dark:text-purple-400'">
                    {{ t.region }}
                  </td>
                  <td class="font-mono text-xs font-semibold" :class="t.product === 'Laptop' ? 'text-blue-600 dark:text-blue-400' : 'text-cyan-600 dark:text-cyan-400'">
                    {{ t.product }}
                  </td>
                  <td class="text-right font-mono text-xs font-bold text-ink">
                    ${{ t.sales }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div class="text-[10px] font-mono text-muted">
            Each observation is a single transaction row.
          </div>
        </div>

        <!-- RIGHT BAY: Pivoted 2D Matrix -->
        <div class="flex flex-col gap-2 w-full">
          <div class="flex items-center justify-between text-xs font-mono border-b border-line pb-1.5">
            <div class="flex items-center gap-1.5 font-bold text-ink">
              <Layers class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Output: Pivoted 2D Matrix (Wide Format)</span>
            </div>
            <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
              aggfunc='{{ aggFunc }}'
            </span>
          </div>

          <!-- The Pivot DataFrame -->
          <div class="overflow-x-auto max-w-full">
            <table class="dataframe">
              <thead>
                <!-- Top Header: Columns Coordinate Rail (product) -->
                <tr>
                  <th class="bg-card-subtle text-muted text-[10px] text-left pr-3">
                    <span class="text-amber-700 dark:text-amber-400 font-bold">region \ product</span>
                  </th>
                  <th
                    v-for="p in products"
                    :key="'p-hdr-' + p"
                    class="text-center font-bold px-4"
                    :class="currentStep >= 1 ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300' : 'opacity-40'"
                  >
                    {{ p }}
                  </th>
                  <!-- Margins 'All' Column Header -->
                  <th
                    v-if="showMargins && currentStep >= 3"
                    class="bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold px-4 text-center border-l-2 border-amber-500"
                  >
                    All
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="r in regions"
                  :key="'p-row-' + r"
                >
                  <!-- Row Index: (region) -->
                  <th
                    class="text-left font-bold"
                    :class="currentStep >= 1 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400' : 'opacity-40 text-muted'"
                  >
                    {{ r }}
                  </th>

                  <!-- Intersections -->
                  <td
                    v-for="p in products"
                    :key="'cell-' + r + '-' + p"
                    @click="selectCell(r, p)"
                    class="cursor-pointer font-mono text-xs text-right px-4 py-2 transition-all select-none"
                    :class="[
                      selectedIntersection?.region === r && selectedIntersection?.product === p
                        ? 'ring-2 ring-brand-blue bg-blue-100 dark:bg-blue-900/60 font-bold'
                        : currentStep < 2
                        ? 'opacity-30 italic text-muted text-center'
                        : currentStep === 2
                        ? 'bg-emerald-500/10'
                        : 'hover:bg-card-subtle font-semibold text-ink'
                    ]"
                  >
                    <!-- Phase 0-1: Empty placeholder -->
                    <span v-if="currentStep < 2">--</span>

                    <!-- Phase 2: Binning multi-records -->
                    <div v-else-if="currentStep === 2" class="flex flex-col items-end gap-0.5">
                      <span class="text-[10px] text-muted">
                        {{ cellBins[`${r}_${p}`].map(t => `$${t.sales}`).join(' + ') }}
                      </span>
                      <span class="text-[9px] px-1 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold">
                        {{ cellBins[`${r}_${p}`].length }} items
                      </span>
                    </div>

                    <!-- Phase 3: Aggregated Value -->
                    <span v-else class="font-bold text-brand-blue">
                      ${{ aggFunc === 'sum' ? aggregatedMatrix[r][p] : aggregatedMatrix[r][p].toFixed(2) }}
                    </span>
                  </td>

                  <!-- Margins 'All' Column Value for Row -->
                  <td
                    v-if="showMargins && currentStep >= 3"
                    class="text-right font-mono text-xs font-bold border-l-2 border-amber-500 px-4 bg-amber-500/5 text-amber-800 dark:text-amber-300"
                  >
                    ${{ aggFunc === 'sum' ? marginCalculations.rowMargins[r] : marginCalculations.rowMargins[r].toFixed(2) }}
                  </td>
                </tr>

                <!-- Margins 'All' Row at Bottom -->
                <tr
                  v-if="showMargins && currentStep >= 3"
                  class="border-t-2 border-amber-500 bg-amber-500/10 font-bold"
                >
                  <th class="text-left font-bold text-amber-800 dark:text-amber-300">
                    All
                  </th>
                  <td
                    v-for="p in products"
                    :key="'margin-col-' + p"
                    class="text-right font-mono text-xs text-amber-800 dark:text-amber-300 font-bold px-4 py-2"
                  >
                    ${{ aggFunc === 'sum' ? marginCalculations.colMargins[p] : marginCalculations.colMargins[p].toFixed(2) }}
                  </td>
                  <!-- Grand Total Intersection -->
                  <td class="text-right font-mono text-xs text-amber-900 dark:text-amber-200 font-black border-l-2 border-amber-500 px-4 py-2 bg-amber-500/20">
                    ${{ aggFunc === 'sum' ? marginCalculations.grandTotal : marginCalculations.grandTotal.toFixed(2) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Metadata Footer -->
          <div class="dataframe-footer text-xs font-mono text-muted flex items-center justify-between w-full px-1">
            <span>{{ currentStep >= 3 ? (showMargins ? '3 rows × 3 cols (margins)' : '2 rows × 2 cols') : 'Projecting...' }}</span>
            <span class="text-[11px]">Values: sales • Index: region • Columns: product</span>
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
            {{ s === 0 ? 'Init' : 'Step ' + s }}
          </button>
        </div>

        <!-- Playback Buttons -->
        <div class="flex items-center gap-1.5 font-mono text-xs">
          <button
            type="button"
            @click="resetSimulation"
            class="p-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-muted hover:text-ink transition-colors cursor-pointer"
            title="Reset simulation"
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
            <span>{{ isPlaying ? 'Pause' : 'Play Pivot' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Educational HUD Footer Bar -->
    <div class="rounded-lg border border-line bg-card p-3 shadow-2xs font-mono text-xs flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 text-muted">
        <Sparkles class="w-4 h-4 text-brand-blue shrink-0" />
        <span>Pivot Table Invariant:</span>
        <span class="text-ink font-semibold">
          {{ currentStep === 0
            ? "Long datasets repeat categories along columns. pivot_table groups them into a tidy 2D cross-tabulation."
            : currentStep === 1
            ? "Unique values of 'region' become the row index; unique values of 'product' become the column rail."
            : currentStep === 2
            ? "Multiple matching rows fall into the same (r, c) cell bucket before reduction."
            : "aggfunc reduces each bucket into a single scalar value. margins=True computes row/column marginal totals."
          }}
        </span>
      </div>

      <div v-if="selectedIntersection" class="text-ink font-bold bg-card-subtle px-2 py-0.5 rounded border border-line">
        Bucket [{{ selectedIntersection.region }}, {{ selectedIntersection.product }}]: {{ cellBins[`${selectedIntersection.region}_${selectedIntersection.product}`].length }} records
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

