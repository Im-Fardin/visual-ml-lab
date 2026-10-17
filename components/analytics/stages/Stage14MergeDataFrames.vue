<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  GitMerge,
  ArrowRight,
  Database,
  Layers,
  Sparkles,
  Info,
  CheckCircle2
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Data Models -----------------------------------------------------------
interface Customer {
  cust_id: number
  name: string
  city: string
}

interface Order {
  order_id: string
  cust_id: number
  amount: number
}

const customers: Customer[] = [
  { cust_id: 101, name: 'Alice', city: 'NYC' },
  { cust_id: 102, name: 'Bob', city: 'London' },
  { cust_id: 103, name: 'Charlie', city: 'Tokyo' },
  { cust_id: 104, name: 'Diana', city: 'Paris' }
]

const orders: Order[] = [
  { order_id: 'ORD_1', cust_id: 102, amount: 250 },
  { order_id: 'ORD_2', cust_id: 103, amount: 600 },
  { order_id: 'ORD_3', cust_id: 105, amount: 150 },
  { order_id: 'ORD_4', cust_id: 106, amount: 420 }
]

type JoinType = 'inner' | 'left' | 'right' | 'outer'
const activeJoin = ref<JoinType>('inner')

// Compute merged rows
interface MergedRow {
  cust_id: number
  name: string | null
  city: string | null
  order_id: string | null
  amount: number | null
  matchType: 'both' | 'left_only' | 'right_only'
}

const mergedRows = computed<MergedRow[]>(() => {
  const result: MergedRow[] = []

  if (activeJoin.value === 'inner') {
    customers.forEach(c => {
      const match = orders.find(o => o.cust_id === c.cust_id)
      if (match) {
        result.push({
          cust_id: c.cust_id,
          name: c.name,
          city: c.city,
          order_id: match.order_id,
          amount: match.amount,
          matchType: 'both'
        })
      }
    })
  } else if (activeJoin.value === 'left') {
    customers.forEach(c => {
      const match = orders.find(o => o.cust_id === c.cust_id)
      result.push({
        cust_id: c.cust_id,
        name: c.name,
        city: c.city,
        order_id: match ? match.order_id : null,
        amount: match ? match.amount : null,
        matchType: match ? 'both' : 'left_only'
      })
    })
  } else if (activeJoin.value === 'right') {
    orders.forEach(o => {
      const match = customers.find(c => c.cust_id === o.cust_id)
      result.push({
        cust_id: o.cust_id,
        name: match ? match.name : null,
        city: match ? match.city : null,
        order_id: o.order_id,
        amount: o.amount,
        matchType: match ? 'both' : 'right_only'
      })
    })
  } else {
    // Outer Join: union of all keys
    const allKeys = Array.from(new Set([...customers.map(c => c.cust_id), ...orders.map(o => o.cust_id)])).sort((a, b) => a - b)
    allKeys.forEach(k => {
      const c = customers.find(x => x.cust_id === k)
      const o = orders.find(x => x.cust_id === k)
      result.push({
        cust_id: k,
        name: c ? c.name : null,
        city: c ? c.city : null,
        order_id: o ? o.order_id : null,
        amount: o ? o.amount : null,
        matchType: c && o ? 'both' : c ? 'left_only' : 'right_only'
      })
    })
  }

  return result
})

const activeCodeSnippet = computed(() => {
  return `# Relational Merge with how='${activeJoin.value}'
import pandas as pd

# Merge on common key 'cust_id'
merged_df = pd.merge(df_customers, df_orders, on='cust_id', how='${activeJoin.value}')
print(merged_df)`
})

const emitInspection = () => {
  emit('inspect', {
    title: `pd.merge(..., how='${activeJoin.value}')`,
    details: {
      'Join Strategy': `${activeJoin.value.toUpperCase()} JOIN`,
      'Common Key': 'cust_id',
      'Matching Keys': '102 (Bob), 103 (Charlie)',
      'Left Only Keys': '101 (Alice), 104 (Diana)',
      'Right Only Keys': '105, 106',
      'Result Rows': mergedRows.value.length,
      'Relational Invariant': activeJoin.value === 'inner' ? 'Intersection (A ∩ B) • Unmatched rows discarded' : activeJoin.value === 'left' ? 'Preserve 100% of left table • Missing orders padded with NaN' : activeJoin.value === 'right' ? 'Preserve 100% of right table • Missing customers padded with NaN' : 'Full Union (A ∪ B) • All records retained with NaNs'
    }
  })
}

const setJoin = (j: JoinType) => {
  activeJoin.value = j
  emitInspection()
}

onMounted(() => emitInspection())
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <!-- Top Action Toolbar -->
    <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
      <!-- Join Type Selector -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">how:</span>
        <button
          type="button"
          @click="setJoin('inner')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeJoin === 'inner' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          'inner' (Intersection)
        </button>
        <button
          type="button"
          @click="setJoin('left')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeJoin === 'left' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          'left' (All Customers)
        </button>
        <button
          type="button"
          @click="setJoin('right')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeJoin === 'right' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          'right' (All Orders)
        </button>
        <button
          type="button"
          @click="setJoin('outer')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="activeJoin === 'outer' ? 'bg-purple-600 text-white font-bold border-purple-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          'outer' (Full Union)
        </button>
      </div>

      <!-- Quick Metrics Badge -->
      <div class="flex items-center gap-2 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <GitMerge class="w-3.5 h-3.5 text-brand-blue" />
        <span class="font-bold text-ink">Output: {{ mergedRows.length }} rows</span>
      </div>
    </div>

    <!-- Main Living Table Arena -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <div class="flex flex-col gap-5">
        <!-- TOP ROW: Two Source Tables Side-by-Side -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Left Table: Customers -->
          <div class="rounded-md border border-line bg-card p-3 flex flex-col gap-1.5">
            <div class="text-xs font-mono font-bold text-brand-blue border-b border-line pb-1 flex items-center justify-between">
              <span>df_customers (Left)</span>
              <span class="text-[10px] text-muted">Key: cust_id</span>
            </div>
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-16 text-center font-bold text-brand-blue">cust_id</th>
                  <th class="text-left font-bold text-ink">name</th>
                  <th class="text-left font-bold text-ink">city</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="c in customers"
                  :key="c.cust_id"
                  :class="[c.cust_id === 102 || c.cust_id === 103 ? 'bg-emerald-500/10 font-medium' : '']"
                >
                  <td class="font-mono text-center font-bold text-brand-blue py-1">{{ c.cust_id }}</td>
                  <td class="font-mono text-ink py-1">{{ c.name }}</td>
                  <td class="font-mono text-muted py-1">{{ c.city }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Right Table: Orders -->
          <div class="rounded-md border border-line bg-card p-3 flex flex-col gap-1.5">
            <div class="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 border-b border-line pb-1 flex items-center justify-between">
              <span>df_orders (Right)</span>
              <span class="text-[10px] text-muted">Key: cust_id</span>
            </div>
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-16 text-center font-bold text-emerald-600 dark:text-emerald-400">cust_id</th>
                  <th class="text-left font-bold text-ink">order_id</th>
                  <th class="text-right font-bold text-ink">amount</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="o in orders"
                  :key="o.order_id"
                  :class="[o.cust_id === 102 || o.cust_id === 103 ? 'bg-emerald-500/10 font-medium' : '']"
                >
                  <td class="font-mono text-center font-bold text-emerald-600 dark:text-emerald-400 py-1">{{ o.cust_id }}</td>
                  <td class="font-mono text-ink py-1">{{ o.order_id }}</td>
                  <td class="font-mono text-right font-bold text-ink py-1">\${{ o.amount }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- BOTTOM ROW: Merged Result Table -->
        <div class="rounded-md border border-line bg-card p-3 flex flex-col gap-2">
          <div class="text-xs font-mono font-bold text-ink border-b border-line pb-1.5 flex items-center justify-between">
            <span class="flex items-center gap-1.5">
              <Sparkles class="w-4 h-4 text-brand-blue" />
              <span>pd.merge(how='{{ activeJoin }}'): {{ mergedRows.length }} Records</span>
            </span>
            <span class="text-[10px] text-muted font-normal">
              Shared Keys (102, 103) in green • Missing fields filled with NaN
            </span>
          </div>

          <div class="overflow-x-auto w-full">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-16 text-center font-bold text-brand-blue">cust_id</th>
                  <th class="text-left font-bold text-ink">name</th>
                  <th class="text-left font-bold text-ink">city</th>
                  <th class="text-left font-bold text-ink">order_id</th>
                  <th class="text-right font-bold text-ink">amount</th>
                  <th class="text-center font-bold text-muted text-[10px]">Origin</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in mergedRows"
                  :key="idx"
                  class="transition-colors hover:bg-card-subtle"
                  :class="row.matchType === 'both' ? 'bg-emerald-500/5' : 'bg-amber-500/5'"
                >
                  <td class="font-mono text-center font-bold text-brand-blue py-1.5">{{ row.cust_id }}</td>
                  <td class="font-mono text-ink">
                    <span v-if="row.name">{{ row.name }}</span>
                    <span v-else class="nan font-mono text-xs">NaN</span>
                  </td>
                  <td class="font-mono text-muted">
                    <span v-if="row.city">{{ row.city }}</span>
                    <span v-else class="nan font-mono text-xs">NaN</span>
                  </td>
                  <td class="font-mono text-ink font-semibold">
                    <span v-if="row.order_id">{{ row.order_id }}</span>
                    <span v-else class="nan font-mono text-xs">NaN</span>
                  </td>
                  <td class="font-mono text-right font-bold text-ink">
                    <span v-if="row.amount">\${{ row.amount }}</span>
                    <span v-else class="nan font-mono text-xs">NaN</span>
                  </td>
                  <td class="text-center font-mono text-[10px]">
                    <span
                      class="px-1.5 py-0.2 rounded font-bold"
                      :class="row.matchType === 'both' ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300' : 'bg-amber-500/20 text-amber-800 dark:text-amber-300'"
                    >
                      {{ row.matchType === 'both' ? 'Match' : (row.matchType === 'left_only' ? 'Left Only' : 'Right Only') }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Bottom Hint Strip -->
      <div class="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs font-mono text-muted">
        <span>Relational Invariant:</span>
        <strong class="text-ink">Inner join guarantees zero NaNs • Outer joins preserve all records with NaN padding</strong>
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active Relational Merge Command:</span>
        <span class="text-brand-blue font-semibold">pd.merge(how='{{ activeJoin }}')</span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ activeCodeSnippet }}</code></pre>
    </div>
  </div>
</template>

