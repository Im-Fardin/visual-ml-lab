<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Layers,
  Split,
  Filter,
  Calculator,
  ArrowRight,
  Sparkles,
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
interface SaleItem {
  id: number
  store: 'Store_A' | 'Store_B' | 'Store_C'
  product: string
  sales: number
}

const transactions: SaleItem[] = [
  { id: 0, store: 'Store_A', product: 'Laptop', sales: 800 },
  { id: 1, store: 'Store_A', product: 'Mouse', sales: 50 },
  { id: 2, store: 'Store_A', product: 'Keyboard', sales: 150 },
  { id: 3, store: 'Store_B', product: 'Monitor', sales: 300 },
  { id: 4, store: 'Store_B', product: 'Cable', sales: 20 },
  { id: 5, store: 'Store_C', product: 'Server', sales: 1200 },
  { id: 6, store: 'Store_C', product: 'Storage', sales: 900 }
]

type GroupOperation = 'agg' | 'transform' | 'filter'
const activeOp = ref<GroupOperation>('agg')

// Phase: 0 = Unified Table, 1 = Split Buckets, 2 = Evaluated Output
const currentPhase = ref(2)

// Compute group stats
const groupStats = computed(() => {
  const stores = ['Store_A', 'Store_B', 'Store_C'] as const
  return stores.map(store => {
    const items = transactions.filter(t => t.store === store)
    const sum = items.reduce((acc, t) => acc + t.sales, 0)
    const mean = Number((sum / items.length).toFixed(1))
    const meetsFilter = sum >= 1000
    return {
      store,
      count: items.length,
      sum,
      mean,
      meetsFilter,
      items
    }
  })
})

// Output computation
const outputData = computed(() => {
  if (activeOp.value === 'agg') {
    // 3 rows: group summaries
    return {
      type: 'agg',
      shape: '(3, 1)',
      desc: 'Each store collapses into a scalar mean. Store becomes the new Index.',
      rows: groupStats.value.map(g => ({
        index: g.store,
        val: g.mean
      }))
    }
  } else if (activeOp.value === 'transform') {
    // N -> N rows: group stat broadcasted back
    return {
      type: 'transform',
      shape: `(${transactions.length}, 4)`,
      desc: 'Broadcasts group mean back to the original rows without altering row shape.',
      rows: transactions.map(t => {
        const g = groupStats.value.find(x => x.store === t.store)!
        return {
          id: t.id,
          store: t.store,
          product: t.product,
          sales: t.sales,
          broadcastMean: g.mean
        }
      })
    }
  } else {
    // Filter: excludes Store_B
    const filtered = transactions.filter(t => {
      const g = groupStats.value.find(x => x.store === t.store)!
      return g.meetsFilter
    })
    return {
      type: 'filter',
      shape: `(${filtered.length}, 3)`,
      desc: 'Store_B total ($320 < $1000) dropped completely; Store_A and Store_C retained.',
      rows: filtered
    }
  }
})

const activeCodeSnippet = computed(() => {
  if (activeOp.value === 'agg') {
    return `# 1. GroupBy Aggregation: Reductive Collapse (N -> K)
import pandas as pd

# Groups collapse into single summary per store
summary = df.groupby('store')['sales'].mean()
print(summary)`
  } else if (activeOp.value === 'transform') {
    return `# 2. GroupBy Transform: Broadcast Group Stat to Original Shape (N -> N)
import pandas as pd

# Returns Series aligned with original DataFrame index
df['store_avg'] = df.groupby('store')['sales'].transform('mean')
print(df)`
  } else {
    return `# 3. GroupBy Filter: Conditional Group Exclusion
import pandas as pd

# Keeps only stores where total revenue >= $1,000
filtered_df = df.groupby('store').filter(lambda g: g['sales'].sum() >= 1000)
print(filtered_df)`
  }
})

const emitInspection = () => {
  emit('inspect', {
    title: `df.groupby('store').${activeOp.value}()`,
    details: {
      'Operation': activeOp.value.toUpperCase(),
      'Output Shape': outputData.value.shape,
      'Behavior': outputData.value.desc,
      'Store_A (sum=$1000)': 'mean=$333.3 (Kept)',
      'Store_B (sum=$320)': activeOp.value === 'filter' ? 'mean=$160.0 (DROPPED by filter < $1000)' : 'mean=$160.0',
      'Store_C (sum=$2100)': 'mean=$1050.0 (Kept)'
    }
  })
}

const setOp = (op: GroupOperation) => {
  activeOp.value = op
  emitInspection()
}

onMounted(() => emitInspection())
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <!-- Top Action Toolbar -->
    <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
      <!-- Operation Switcher -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">Operation:</span>
        <button
          type="button"
          @click="setOp('agg')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeOp === 'agg' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <Calculator class="w-3.5 h-3.5" />
          <span>.agg('mean') [N → K]</span>
        </button>

        <button
          type="button"
          @click="setOp('transform')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeOp === 'transform' ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <Layers class="w-3.5 h-3.5" />
          <span>.transform('mean') [N → N]</span>
        </button>

        <button
          type="button"
          @click="setOp('filter')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeOp === 'filter' ? 'bg-purple-600 text-white font-bold border-purple-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <Filter class="w-3.5 h-3.5" />
          <span>.filter(sum >= 1000)</span>
        </button>
      </div>

      <!-- Result Shape Badge -->
      <div class="flex items-center gap-2 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <span class="font-bold text-ink">Shape: {{ outputData.shape }}</span>
      </div>
    </div>

    <!-- Main Living Table Arena -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- LEFT 5 COLS: Split Buckets View -->
        <div class="lg:col-span-5 flex flex-col gap-2">
          <div class="text-xs font-mono font-bold text-ink border-b border-line pb-1.5 flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <Split class="w-4 h-4 text-brand-blue" />
              <span>Split Stage: Group Buckets</span>
            </span>
            <span class="text-[10px] text-muted">by='store'</span>
          </div>

          <!-- 3 Store Buckets -->
          <div class="flex flex-col gap-2.5">
            <div
              v-for="g in groupStats"
              :key="g.store"
              class="rounded-md border p-2 flex flex-col gap-1 transition-all"
              :class="[
                activeOp === 'filter' && !g.meetsFilter
                  ? 'bg-rose-500/10 border-rose-500/30 opacity-60'
                  : 'bg-card border-line'
              ]"
            >
              <div class="flex items-center justify-between text-xs font-mono">
                <span class="font-bold text-ink">{{ g.store }} ({{ g.count }} items)</span>
                <span class="text-[10px] font-bold" :class="activeOp === 'filter' && !g.meetsFilter ? 'text-rose-600 dark:text-rose-400' : 'text-brand-blue'">
                  sum=\${{ g.sum }} • μ=\${{ g.mean }}
                </span>
              </div>
              <div class="text-[11px] font-mono text-muted flex items-center gap-1 flex-wrap">
                <span v-for="item in g.items" :key="item.id" class="px-1.5 py-0.2 rounded bg-card-subtle border border-line">
                  {{ item.product }}: \${{ item.sales }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- RIGHT 7 COLS: Combined Output Table -->
        <div class="lg:col-span-7 flex flex-col gap-2">
          <div class="text-xs font-mono font-bold text-ink border-b border-line pb-1.5 flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <Sparkles class="w-4 h-4 text-emerald-500" />
              <span>Combined Output: {{ outputData.shape }}</span>
            </span>
            <span class="text-[10px] text-muted font-normal">{{ outputData.desc }}</span>
          </div>

          <!-- AGG OUTPUT TABLE -->
          <div v-if="activeOp === 'agg'" class="overflow-x-auto w-full">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-24 text-left font-bold text-brand-blue">store (Index)</th>
                  <th class="text-right font-bold text-emerald-600 dark:text-emerald-400">mean(sales)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in (outputData.rows as any[])" :key="row.index" class="hover:bg-card-subtle">
                  <td class="font-mono font-bold text-brand-blue py-2">{{ row.index }}</td>
                  <td class="font-mono text-right font-bold text-emerald-600 dark:text-emerald-400 py-2">\${{ row.val }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- TRANSFORM OUTPUT TABLE -->
          <div v-else-if="activeOp === 'transform'" class="overflow-x-auto w-full">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-8 text-center text-muted">#</th>
                  <th class="text-left font-bold text-ink">store</th>
                  <th class="text-left font-bold text-ink">product</th>
                  <th class="text-right font-bold text-ink">sales</th>
                  <th class="text-right font-bold text-emerald-600 dark:text-emerald-400">store_avg</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in (outputData.rows as any[])" :key="row.id" class="hover:bg-card-subtle">
                  <td class="text-center font-mono text-[11px] text-muted">{{ row.id }}</td>
                  <td class="font-mono text-ink font-semibold py-1.5">{{ row.store }}</td>
                  <td class="font-mono text-muted">{{ row.product }}</td>
                  <td class="font-mono text-right font-bold text-ink">\${{ row.sales }}</td>
                  <td class="font-mono text-right font-bold text-emerald-600 dark:text-emerald-400">\${{ row.broadcastMean }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- FILTER OUTPUT TABLE -->
          <div v-else class="overflow-x-auto w-full">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-8 text-center text-muted">#</th>
                  <th class="text-left font-bold text-ink">store</th>
                  <th class="text-left font-bold text-ink">product</th>
                  <th class="text-right font-bold text-ink">sales</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in (outputData.rows as any[])" :key="row.id" class="hover:bg-card-subtle">
                  <td class="text-center font-mono text-[11px] text-muted">{{ row.id }}</td>
                  <td class="font-mono text-ink font-semibold py-1.5">{{ row.store }}</td>
                  <td class="font-mono text-muted">{{ row.product }}</td>
                  <td class="font-mono text-right font-bold text-ink">\${{ row.sales }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Bottom Hint Strip -->
      <div class="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs font-mono text-muted">
        <span>Crucial Distinction:</span>
        <strong class="text-ink">agg() reduces rows (N → K) • transform() preserves row shape (N → N) • filter() drops entire groups</strong>
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active GroupBy Pattern:</span>
        <span class="text-brand-blue font-semibold">df.groupby().{{ activeOp }}()</span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ activeCodeSnippet }}</code></pre>
    </div>
  </div>
</template>

