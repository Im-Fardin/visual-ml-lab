<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Layers,
  ArrowDown,
  ArrowUp,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  Table
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- State -----------------------------------------------------------------
// Mode:
// 'original': 2-level columns [Year, Metric], 1-level rows [Company]
// 'stacked': 1-level columns [Year], 2-level rows [Company, Metric]
// 'unstacked': 3-level columns [Company, Year, Metric] or unstacked company
type MultiIndexView = 'original' | 'stacked' | 'unstacked'
const activeView = ref<MultiIndexView>('original')

// Interactive highlighting
const hoveredLevel = ref<'year' | 'metric' | 'company' | null>(null)
const selectedCell = ref<string | null>(null)

// Raw data dictionary
const data = {
  Company_A: {
    '2023': { Revenue: 100, Profit: 25 },
    '2024': { Revenue: 120, Profit: 32 }
  },
  Company_B: {
    '2023': { Revenue: 200, Profit: 45 },
    '2024': { Revenue: 240, Profit: 55 }
  }
}

const companies = ['Company_A', 'Company_B']
const years = ['2023', '2024']
const metrics = ['Revenue', 'Profit']

// Inspection Telemetry
const emitInspection = () => {
  const details: Record<string, any> = {
    'Active State': activeView.value === 'original'
      ? 'Original MultiIndex Columns: df (Level 0: Year, Level 1: Metric)'
      : activeView.value === 'stacked'
      ? "df.stack(level=-1) — Metric pivoted from Column to Row Index"
      : "df.unstack(level=0) — Company pivoted from Row to Column Index",
    'Column Levels': activeView.value === 'original' ? "2 levels: ['Year', 'Metric']" : activeView.value === 'stacked' ? "1 level: ['Year']" : "3 levels: ['Company', 'Year', 'Metric']",
    'Row Index Levels': activeView.value === 'original' ? "1 level: ['Company']" : activeView.value === 'stacked' ? "2 levels: ['Company', 'Metric']" : "0 levels (RangeIndex)",
    'Pivoting Rule': "stack() drops column dimensionality and increases row hierarchy; unstack() drops row hierarchy and widens column headers."
  }

  if (selectedCell.value) {
    details['Selected Intersection'] = selectedCell.value
  }

  emit('inspect', {
    title: activeView.value === 'original'
      ? 'MultiIndex Anatomy: 2-Level Column Hierarchy'
      : activeView.value === 'stacked'
      ? 'df.stack(): Column -> Row Rotation'
      : 'df.unstack(): Row -> Column Rotation',
    details
  })
}

// Mode switches
const setView = (v: MultiIndexView) => {
  activeView.value = v
  selectedCell.value = null
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
      <!-- Operation Triggers -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <button
          type="button"
          @click="setView('original')"
          class="px-3 py-1.5 rounded-md border transition-all text-xs font-medium shadow-2xs cursor-pointer"
          :class="activeView === 'original' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <span>Baseline: MultiIndex Columns</span>
        </button>

        <button
          type="button"
          @click="setView('stacked')"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-all text-xs font-bold shadow-2xs cursor-pointer"
          :class="activeView === 'stacked' ? 'bg-brand-amber text-slate-950 font-bold border-amber-500 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <ArrowDown class="w-3.5 h-3.5" />
          <span>df.stack() (Cols → Rows)</span>
        </button>

        <button
          type="button"
          @click="setView('unstacked')"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-all text-xs font-bold shadow-2xs cursor-pointer"
          :class="activeView === 'unstacked' ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <ArrowUp class="w-3.5 h-3.5" />
          <span>df.unstack() (Rows → Cols)</span>
        </button>
      </div>

      <!-- Active Syntax Pill -->
      <div class="bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <code class="text-brand-blue font-bold">
          {{ activeView === 'original' ? 'df' : activeView === 'stacked' ? 'df.stack(level=-1)' : 'df.unstack(level=0)' }}
        </code>
      </div>
    </div>

    <!-- Main Workspace Container -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-6 shadow-xs min-h-[380px] flex flex-col justify-between items-center select-none">
      <!-- 1. BASELINE: TWO-LEVEL HIERARCHICAL COLUMN INDEX -->
      <div v-if="activeView === 'original'" class="flex flex-col items-center gap-4 animate-fade-in w-full">
        <div class="flex items-center gap-2 text-xs font-mono bg-card px-3 py-1.5 rounded-full border border-line shadow-2xs">
          <span class="text-muted">Column Index:</span>
          <span class="text-blue-600 dark:text-blue-400 font-bold">Level 0: Year</span>
          <span class="text-line">/</span>
          <span class="text-cyan-600 dark:text-cyan-400 font-bold">Level 1: Metric</span>
        </div>

        <div class="overflow-x-auto max-w-full">
          <table class="dataframe">
            <thead>
              <!-- Level 0 Column Headers: Year -->
              <tr>
                <th rowspan="2" class="bg-card-subtle text-muted text-[10px] text-left align-bottom pr-3">
                  <span class="font-bold text-amber-700 dark:text-amber-400">Company</span>
                </th>
                <th
                  v-for="y in years"
                  :key="'hdr-y-' + y"
                  colspan="2"
                  class="text-center font-bold border-b border-line bg-blue-500/10 text-blue-700 dark:text-blue-300"
                >
                  {{ y }}
                </th>
              </tr>
              <!-- Level 1 Column Headers: Metric -->
              <tr>
                <template v-for="y in years" :key="'subhdr-y-' + y">
                  <th
                    v-for="m in metrics"
                    :key="'subhdr-' + y + '-' + m"
                    class="text-center font-semibold text-xs px-4 bg-card-subtle text-cyan-800 dark:text-cyan-300"
                  >
                    {{ m }}
                  </th>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr v-for="c in companies" :key="'orig-row-' + c" class="hover:bg-card-subtle">
                <!-- Company Row Index -->
                <th class="text-left font-bold text-amber-700 dark:text-amber-400 bg-card">
                  {{ c }}
                </th>
                <!-- Data Cells -->
                <template v-for="y in years" :key="'cell-grp-' + c + '-' + y">
                  <td
                    v-for="m in metrics"
                    :key="'cell-' + c + '-' + y + '-' + m"
                    @click="selectedCell = `${c} | ${y} | ${m} = $${data[c][y][m]}M`; emitInspection()"
                    class="cursor-pointer text-right font-mono text-xs px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    :class="selectedCell?.startsWith(`${c} | ${y} | ${m}`) ? 'ring-2 ring-brand-blue bg-blue-100 dark:bg-blue-900/60 font-bold' : ''"
                  >
                    ${{ data[c][y][m] }}M
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="dataframe-footer text-xs font-mono text-muted flex items-center justify-between w-full max-w-lg px-2">
          <span>2 rows × 4 columns</span>
          <span class="text-[11px]">MultiIndex Columns: 2 levels</span>
        </div>
      </div>

      <!-- 2. STACKED VIEW: METRIC PIVOTED TO ROW LEVEL -->
      <div v-else-if="activeView === 'stacked'" class="flex flex-col items-center gap-4 animate-fade-in w-full">
        <div class="flex items-center gap-2 text-xs font-mono bg-card px-3 py-1.5 rounded-full border border-line shadow-2xs">
          <ArrowDown class="w-3.5 h-3.5 text-amber-600" />
          <span class="text-muted">Result of df.stack():</span>
          <span class="text-amber-700 dark:text-amber-400 font-bold">'Metric' rotated into secondary row index</span>
        </div>

        <div class="overflow-x-auto max-w-full">
          <table class="dataframe">
            <thead>
              <tr>
                <!-- Two-level row index headers -->
                <th class="bg-card-subtle text-amber-700 dark:text-amber-400 font-bold text-xs text-left">Company</th>
                <th class="bg-amber-500/15 text-amber-800 dark:text-amber-300 font-bold text-xs text-left">Metric (Stacked)</th>
                <!-- Single-level column headers (Year) -->
                <th v-for="y in years" :key="'stacked-col-' + y" class="text-center font-bold px-5 bg-blue-500/10 text-blue-700 dark:text-blue-300">
                  {{ y }}
                </th>
              </tr>
            </thead>
            <tbody>
              <template v-for="c in companies" :key="'stacked-grp-' + c">
                <tr v-for="(m, mIdx) in metrics" :key="'stacked-row-' + c + '-' + m" class="hover:bg-card-subtle">
                  <!-- Outer Row Index: Company (rowspan=2) -->
                  <th
                    v-if="mIdx === 0"
                    rowspan="2"
                    class="text-left font-bold text-amber-700 dark:text-amber-400 bg-card align-top border-b-2 border-line"
                  >
                    {{ c }}
                  </th>
                  <!-- Inner Row Index: Metric -->
                  <th class="text-left font-semibold text-xs text-cyan-800 dark:text-cyan-300 bg-card-subtle border-b border-line">
                    {{ m }}
                  </th>
                  <!-- Value Cells across Years -->
                  <td
                    v-for="y in years"
                    :key="'stacked-val-' + c + '-' + m + '-' + y"
                    @click="selectedCell = `${c} | ${m} | ${y} = $${data[c][y][m]}M`; emitInspection()"
                    class="cursor-pointer text-right font-mono text-xs px-5 py-2 hover:bg-blue-50 dark:hover:bg-blue-950/40"
                    :class="selectedCell?.startsWith(`${c} | ${m} | ${y}`) ? 'ring-2 ring-brand-blue bg-blue-100 dark:bg-blue-900/60 font-bold' : ''"
                  >
                    ${{ data[c][y][m] }}M
                  </td>
                </tr>
              </template>
            </tbody>
          </table>
        </div>

        <div class="dataframe-footer text-xs font-mono text-muted flex items-center justify-between w-full max-w-lg px-2">
          <span>4 rows × 2 columns</span>
          <span class="text-[11px] text-amber-600 dark:text-amber-400 font-bold">MultiIndex Rows: 2 levels (Company, Metric)</span>
        </div>
      </div>

      <!-- 3. UNSTACKED VIEW: COMPANY PIVOTED TO COLUMN LEVEL -->
      <div v-else class="flex flex-col items-center gap-4 animate-fade-in w-full">
        <div class="flex items-center gap-2 text-xs font-mono bg-card px-3 py-1.5 rounded-full border border-line shadow-2xs">
          <ArrowUp class="w-3.5 h-3.5 text-emerald-600" />
          <span class="text-muted">Result of df.unstack():</span>
          <span class="text-emerald-600 dark:text-emerald-400 font-bold">'Company' rotated into top column level</span>
        </div>

        <div class="overflow-x-auto max-w-full">
          <table class="dataframe">
            <thead>
              <tr>
                <th v-for="c in companies" :key="'unstack-c-' + c" colspan="4" class="text-center font-bold bg-amber-500/15 text-amber-800 dark:text-amber-300 border-x border-line">
                  {{ c }}
                </th>
              </tr>
              <tr>
                <template v-for="c in companies" :key="'unstack-sub-c-' + c">
                  <th v-for="y in years" :key="'unstack-y-' + c + '-' + y" colspan="2" class="text-center font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border-x border-line text-xs">
                    {{ y }}
                  </th>
                </template>
              </tr>
              <tr>
                <template v-for="c in companies" :key="'unstack-sub-c2-' + c">
                  <template v-for="y in years" :key="'unstack-y2-' + c + '-' + y">
                    <th v-for="m in metrics" :key="'unstack-m-' + c + '-' + y + '-' + m" class="text-center font-normal text-[11px] px-2 bg-card-subtle text-muted">
                      {{ m[0] }}
                    </th>
                  </template>
                </template>
              </tr>
            </thead>
            <tbody>
              <tr>
                <template v-for="c in companies" :key="'unstack-data-c-' + c">
                  <template v-for="y in years" :key="'unstack-data-y-' + c + '-' + y">
                    <td v-for="m in metrics" :key="'unstack-data-m-' + c + '-' + y + '-' + m" class="text-right font-mono text-xs px-2 py-2">
                      ${{ data[c][y][m] }}M
                    </td>
                  </template>
                </template>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="dataframe-footer text-xs font-mono text-muted flex items-center justify-between w-full max-w-2xl px-2">
          <span>1 row × 8 columns</span>
          <span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">MultiIndex Columns: 3 levels (Company, Year, Metric)</span>
        </div>
      </div>

      <!-- Bottom Architectural Invariant Footer -->
      <div class="mt-4 pt-3 border-t border-line/60 flex items-center justify-between gap-3 text-xs font-mono flex-wrap w-full">
        <div class="flex items-center gap-2 text-muted">
          <span class="w-2 h-2 rounded-full" :class="activeView === 'original' ? 'bg-brand-blue' : activeView === 'stacked' ? 'bg-amber-500' : 'bg-emerald-500'" />
          <span class="text-ink font-semibold">Hierarchy Rotation Law:</span>
          <span>{{ activeView === 'original' ? "stack() and unstack() are exact mathematical inverses: df.stack().unstack() restores original shape." : activeView === 'stacked' ? "stack(level=-1) moves the innermost column index into the innermost row index level." : "unstack(level=0) moves a row index level into the highest column hierarchy." }}</span>
        </div>
      </div>
    </div>

    <!-- Educational HUD Footer Bar -->
    <div class="rounded-lg border border-line bg-card p-3 shadow-2xs font-mono text-xs flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 text-muted">
        <Sparkles class="w-4 h-4 text-brand-blue shrink-0" />
        <span>Reshaping Mechanics:</span>
        <span class="text-ink font-semibold">
          MultiIndex coordinates allow representing N-dimensional tensors in 2D tabular layout without loss of relational fidelity.
        </span>
      </div>

      <div v-if="selectedCell" class="text-ink font-bold bg-card-subtle px-2 py-0.5 rounded border border-line">
        {{ selectedCell }}
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

