<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Layers,
  ArrowDown,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
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
const df1 = [
  { idx: 0, A: 'A0', B: 'B0' },
  { idx: 1, A: 'A1', B: 'B1' }
]

const df2 = [
  { idx: 0, B: 'B2', C: 'C2' },
  { idx: 1, B: 'B3', C: 'C3' }
]

// --- State -----------------------------------------------------------------
type ConcatAxis = 0 | 1
const activeAxis = ref<ConcatAxis>(0)
const ignoreIndex = ref<boolean>(false)

// Concat result computation
const concatResults = computed(() => {
  if (activeAxis.value === 0) {
    // Vertical Stacking (axis=0)
    // Columns are union: A, B, C
    const rows: { displayIdx: number | string; A: string | null; B: string; C: string | null; isDuplicate: boolean; origin: string }[] = []

    df1.forEach((r, i) => {
      rows.push({
        displayIdx: ignoreIndex.value ? i : r.idx,
        A: r.A,
        B: r.B,
        C: null,
        isDuplicate: !ignoreIndex.value,
        origin: 'df1'
      })
    })

    df2.forEach((r, i) => {
      rows.push({
        displayIdx: ignoreIndex.value ? (df1.length + i) : r.idx,
        A: null,
        B: r.B,
        C: r.C,
        isDuplicate: !ignoreIndex.value,
        origin: 'df2'
      })
    })

    return {
      columns: ['A', 'B', 'C'],
      rows,
      shape: `(${rows.length}, 3)`
    }
  } else {
    // Horizontal Stacking (axis=1)
    // Matches by index (rows 0 and 1)
    const rows = [0, 1].map(i => {
      return {
        displayIdx: i,
        A: df1[i].A,
        B_df1: df1[i].B,
        B_df2: df2[i].B,
        C: df2[i].C,
        isDuplicate: false,
        origin: 'both'
      }
    })

    return {
      columns: ['A', 'B (df1)', 'B (df2)', 'C'],
      rows,
      shape: `(${rows.length}, 4)`
    }
  }
})

const activeCodeSnippet = computed(() => {
  const ignStr = ignoreIndex.value ? ', ignore_index=True' : ''
  return `# Concatenating DataFrames along axis=${activeAxis.value}
import pandas as pd

df1 = pd.DataFrame({'A': ['A0', 'A1'], 'B': ['B0', 'B1']}, index=[0, 1])
df2 = pd.DataFrame({'B': ['B2', 'B3'], 'C': ['C2', 'C3']}, index=[0, 1])

# axis=${activeAxis.value} ${activeAxis.value === 0 ? '(vertical stack)' : '(horizontal glue)'}
result = pd.concat([df1, df2], axis=${activeAxis.value}${ignStr})
print(result)`
})

const emitInspection = () => {
  emit('inspect', {
    title: `pd.concat(..., axis=${activeAxis.value}${ignoreIndex.value ? ', ignore_index=True' : ''})`,
    details: {
      'Axis': activeAxis.value === 0 ? 'axis=0 (Vertical Rows Stack)' : 'axis=1 (Horizontal Columns Glue)',
      'ignore_index': ignoreIndex.value,
      'Index Collision': activeAxis.value === 0 && !ignoreIndex.value ? 'Duplicate Index Labels [0, 1, 0, 1]' : 'Clean Unique Index',
      'Result Shape': concatResults.value.shape,
      'Mismatched Columns': 'Disjoint columns (A in df1, C in df2) padded with NaN'
    }
  })
}

const setAxis = (ax: ConcatAxis) => {
  activeAxis.value = ax
  emitInspection()
}

onMounted(() => emitInspection())
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <!-- Top Action Toolbar -->
    <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
      <!-- Axis Toggle -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">axis:</span>
        <button
          type="button"
          @click="setAxis(0)"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeAxis === 0 ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <ArrowDown class="w-3.5 h-3.5" />
          <span>axis=0 (Vertical Stack)</span>
        </button>

        <button
          type="button"
          @click="setAxis(1)"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeAxis === 1 ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <ArrowRight class="w-3.5 h-3.5" />
          <span>axis=1 (Horizontal Glue)</span>
        </button>

        <span class="text-line mx-1">|</span>

        <!-- ignore_index Toggle -->
        <button
          type="button"
          @click="ignoreIndex = !ignoreIndex; emitInspection()"
          class="px-2.5 py-1 rounded border text-[11px] font-medium transition-all cursor-pointer"
          :class="ignoreIndex ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border-emerald-500/40' : 'bg-card border-line text-muted'"
        >
          ignore_index: {{ ignoreIndex ? 'True (Renumber)' : 'False (Keep Duplicates)' }}
        </button>
      </div>

      <!-- Quick Metrics Badge -->
      <div class="flex items-center gap-2 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <span class="font-bold text-ink">Shape: {{ concatResults.shape }}</span>
      </div>
    </div>

    <!-- Main Living Table Arena -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <div class="flex flex-col gap-5">
        <!-- TOP ROW: Two Input Tables Side-by-Side -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- df1 -->
          <div class="rounded-md border border-line bg-card p-3 flex flex-col gap-1.5">
            <div class="text-xs font-mono font-bold text-brand-blue border-b border-line pb-1 flex items-center justify-between">
              <span>df1: shape (2, 2)</span>
              <span class="text-[10px] text-muted">Columns: ['A', 'B']</span>
            </div>
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-12 text-center text-muted">Index</th>
                  <th class="text-left font-bold text-ink">A</th>
                  <th class="text-left font-bold text-ink">B</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in df1" :key="r.idx">
                  <td class="text-center font-mono font-bold text-brand-blue py-1">{{ r.idx }}</td>
                  <td class="font-mono text-ink py-1">{{ r.A }}</td>
                  <td class="font-mono text-ink py-1">{{ r.B }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- df2 -->
          <div class="rounded-md border border-line bg-card p-3 flex flex-col gap-1.5">
            <div class="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 border-b border-line pb-1 flex items-center justify-between">
              <span>df2: shape (2, 2)</span>
              <span class="text-[10px] text-muted">Columns: ['B', 'C']</span>
            </div>
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-12 text-center text-muted">Index</th>
                  <th class="text-left font-bold text-ink">B</th>
                  <th class="text-left font-bold text-ink">C</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in df2" :key="r.idx">
                  <td class="text-center font-mono font-bold text-emerald-600 dark:text-emerald-400 py-1">{{ r.idx }}</td>
                  <td class="font-mono text-ink py-1">{{ r.B }}</td>
                  <td class="font-mono text-ink py-1">{{ r.C }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- BOTTOM ROW: Concatenated Result Table -->
        <div class="rounded-md border border-line bg-card p-3 flex flex-col gap-2">
          <div class="text-xs font-mono font-bold text-ink border-b border-line pb-1.5 flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <Sparkles class="w-4 h-4 text-brand-blue" />
              <span>pd.concat(axis={{ activeAxis }}): {{ concatResults.shape }}</span>
            </span>
            <span class="text-[10px] text-muted font-normal">
              {{ activeAxis === 0 ? 'Disjoint columns A and C filled with NaN' : 'Columns aligned horizontally by index' }}
            </span>
          </div>

          <!-- Result Table for axis=0 -->
          <div v-if="activeAxis === 0" class="overflow-x-auto w-full">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-16 text-center font-bold" :class="!ignoreIndex ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300' : 'text-muted'">
                    Index
                  </th>
                  <th class="text-left font-bold text-ink">A</th>
                  <th class="text-left font-bold text-ink">B</th>
                  <th class="text-left font-bold text-ink">C</th>
                  <th class="text-center font-bold text-muted text-[10px]">Origin</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in (concatResults.rows as any[])"
                  :key="idx"
                  class="hover:bg-card-subtle"
                >
                  <td
                    class="text-center font-mono font-bold py-1.5 border-r border-line"
                    :class="!ignoreIndex ? 'text-amber-700 dark:text-amber-300 font-bold bg-amber-500/10' : 'text-ink'"
                  >
                    #{{ row.displayIdx }}
                  </td>
                  <td class="font-mono text-ink">
                    <span v-if="row.A">{{ row.A }}</span>
                    <span v-else class="nan font-mono text-xs">NaN</span>
                  </td>
                  <td class="font-mono text-ink font-semibold">{{ row.B }}</td>
                  <td class="font-mono text-ink">
                    <span v-if="row.C">{{ row.C }}</span>
                    <span v-else class="nan font-mono text-xs">NaN</span>
                  </td>
                  <td class="text-center font-mono text-[10px] text-muted">
                    <span class="px-1.5 py-0.2 rounded bg-card-subtle border border-line">{{ row.origin }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Result Table for axis=1 -->
          <div v-else class="overflow-x-auto w-full">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-12 text-center text-muted">Index</th>
                  <th class="text-left font-bold text-brand-blue">A</th>
                  <th class="text-left font-bold text-brand-blue">B</th>
                  <th class="text-left font-bold text-emerald-600 dark:text-emerald-400">B</th>
                  <th class="text-left font-bold text-emerald-600 dark:text-emerald-400">C</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in (concatResults.rows as any[])" :key="row.displayIdx" class="hover:bg-card-subtle">
                  <td class="text-center font-mono font-bold text-ink py-1.5 border-r border-line">#{{ row.displayIdx }}</td>
                  <td class="font-mono text-brand-blue font-semibold">{{ row.A }}</td>
                  <td class="font-mono text-brand-blue font-semibold">{{ row.B_df1 }}</td>
                  <td class="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{{ row.B_df2 }}</td>
                  <td class="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{{ row.C }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Bottom Hint Strip -->
      <div class="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs font-mono text-muted">
        <span>Concatenation Invariant:</span>
        <strong class="text-ink">Vertical stacking does NOT automatically deduplicate indices — use ignore_index=True</strong>
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active Concatenation Command:</span>
        <span class="text-brand-blue font-semibold">pd.concat(axis={{ activeAxis }})</span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ activeCodeSnippet }}</code></pre>
    </div>
  </div>
</template>

