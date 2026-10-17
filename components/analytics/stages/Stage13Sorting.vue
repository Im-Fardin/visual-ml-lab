<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Film,
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
interface MovieRecord {
  origIdx: number
  title: string
  year: number
  rating: number
  box_office: number
}

// Initial shuffled dataset
const baseMovies: MovieRecord[] = [
  { origIdx: 3, title: 'Inception', year: 2010, rating: 8.8, box_office: 836 },
  { origIdx: 0, title: 'Interstellar', year: 2014, rating: 8.7, box_office: 773 },
  { origIdx: 4, title: 'The Dark Knight', year: 2008, rating: 9.0, box_office: 1006 },
  { origIdx: 1, title: 'Oppenheimer', year: 2023, rating: 8.9, box_office: 957 },
  { origIdx: 2, title: 'Memento', year: 2000, rating: 8.4, box_office: 40 }
]

// --- State -----------------------------------------------------------------
type SortTarget = 'none' | 'rating' | 'year' | 'box_office' | 'index' | 'multi'
const sortTarget = ref<SortTarget>('none')
const isAscending = ref(false) // Default descending for ratings / revenue

const activeCodeSnippet = computed(() => {
  if (sortTarget.value === 'index') {
    return `# Sort strictly by the row index labels
df_sorted = df.sort_index(ascending=${isAscending.value ? 'True' : 'False'})
print(df_sorted)`
  } else if (sortTarget.value === 'multi') {
    return `# Multi-column Hierarchical Sort: Year (Ascending), then Rating (Descending)
df_sorted = df.sort_values(by=['year', 'rating'], ascending=[True, False])
print(df_sorted)`
  } else if (sortTarget.value === 'none') {
    return `# Original Unsorted DataFrame (Shuffled Index [3, 0, 4, 1, 2])
print(df)`
  } else {
    return `# Sort by column '${sortTarget.value}'
df_sorted = df.sort_values(by='${sortTarget.value}', ascending=${isAscending.value ? 'True' : 'False'})
print(df_sorted)`
  }
})

// Computed Sorted Rows
const sortedRows = computed<MovieRecord[]>(() => {
  const list = [...baseMovies]

  if (sortTarget.value === 'none') {
    return list
  }

  if (sortTarget.value === 'index') {
    return list.sort((a, b) => isAscending.value ? a.origIdx - b.origIdx : b.origIdx - a.origIdx)
  }

  if (sortTarget.value === 'multi') {
    // year asc, then rating desc
    return list.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      return b.rating - a.rating
    })
  }

  const key = sortTarget.value as 'rating' | 'year' | 'box_office'
  return list.sort((a, b) => {
    return isAscending.value ? a[key] - b[key] : b[key] - a[key]
  })
})

const emitInspection = () => {
  emit('inspect', {
    title: sortTarget.value === 'index' ? 'df.sort_index()' : `df.sort_values(by='${sortTarget.value}')`,
    details: {
      'Sort Target': sortTarget.value,
      'Order': isAscending.value ? 'Ascending (Low -> High)' : 'Descending (High -> Low)',
      'Current Index Order': `[${sortedRows.value.map(r => r.origIdx).join(', ')}]`,
      'Index Invariant': sortTarget.value === 'index' ? 'Index reordered sequentially (0..4)' : 'Indices remain bound to their respective rows as data moves'
    }
  })
}

const setSort = (target: SortTarget) => {
  if (sortTarget.value === target && target !== 'multi' && target !== 'none') {
    isAscending.value = !isAscending.value
  } else {
    sortTarget.value = target
  }
  emitInspection()
}

const resetSort = () => {
  sortTarget.value = 'none'
  isAscending.value = false
  emitInspection()
}

onMounted(() => emitInspection())
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <!-- Top Action Toolbar -->
    <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
      <!-- Sort Controls -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">Sort By:</span>
        <button
          type="button"
          @click="setSort('rating')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="sortTarget === 'rating' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <span>rating</span>
          <ArrowUp v-if="sortTarget === 'rating' && isAscending" class="w-3 h-3" />
          <ArrowDown v-else-if="sortTarget === 'rating' && !isAscending" class="w-3 h-3" />
        </button>

        <button
          type="button"
          @click="setSort('box_office')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="sortTarget === 'box_office' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <span>box_office</span>
          <ArrowUp v-if="sortTarget === 'box_office' && isAscending" class="w-3 h-3" />
          <ArrowDown v-else-if="sortTarget === 'box_office' && !isAscending" class="w-3 h-3" />
        </button>

        <button
          type="button"
          @click="setSort('year')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="sortTarget === 'year' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <span>year</span>
          <ArrowUp v-if="sortTarget === 'year' && isAscending" class="w-3 h-3" />
          <ArrowDown v-else-if="sortTarget === 'year' && !isAscending" class="w-3 h-3" />
        </button>

        <span class="text-line mx-1">|</span>

        <button
          type="button"
          @click="setSort('index')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="sortTarget === 'index' ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <span>sort_index()</span>
          <ArrowUp v-if="sortTarget === 'index' && isAscending" class="w-3 h-3" />
          <ArrowDown v-else-if="sortTarget === 'index' && !isAscending" class="w-3 h-3" />
        </button>

        <button
          type="button"
          @click="setSort('multi')"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="sortTarget === 'multi' ? 'bg-purple-600 text-white font-bold border-purple-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <span>by=['year', 'rating']</span>
        </button>
      </div>

      <!-- Quick Reset Button -->
      <button
        type="button"
        @click="resetSort"
        class="flex items-center gap-1 px-2.5 py-1 rounded-md border border-line bg-card text-xs font-mono text-muted hover:text-ink shadow-2xs cursor-pointer"
      >
        <RotateCcw class="w-3 h-3" />
        <span>Reset Shuffled</span>
      </button>
    </div>

    <!-- Main Living Table Arena -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <div class="flex flex-col gap-3">
        <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1.5">
          <span class="flex items-center gap-1.5">
            <Film class="w-4 h-4 text-brand-blue" />
            <span>Nolan Filmography: df</span>
          </span>
          <span class="text-[10px] text-muted">
            {{ sortTarget === 'none' ? 'Shuffled Index Order [3, 0, 4, 1, 2]' : `Sorted by ${sortTarget} (${isAscending ? 'Ascending' : 'Descending'})` }}
          </span>
        </div>

        <!-- Table with animated reordering -->
        <div class="overflow-x-auto w-full">
          <table class="dataframe w-full text-xs">
            <thead>
              <tr>
                <th
                  class="w-16 text-center font-bold transition-colors cursor-pointer"
                  :class="sortTarget === 'index' ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold' : 'text-muted'"
                  @click="setSort('index')"
                >
                  Index
                </th>
                <th class="text-left font-bold text-ink">title</th>
                <th
                  class="text-right font-bold transition-colors cursor-pointer"
                  :class="sortTarget === 'year' || sortTarget === 'multi' ? 'bg-brand-blue/20 text-brand-blue font-bold' : 'text-ink'"
                  @click="setSort('year')"
                >
                  year
                </th>
                <th
                  class="text-right font-bold transition-colors cursor-pointer"
                  :class="sortTarget === 'rating' || sortTarget === 'multi' ? 'bg-brand-blue/20 text-brand-blue font-bold' : 'text-ink'"
                  @click="setSort('rating')"
                >
                  rating (IMDb)
                </th>
                <th
                  class="text-right font-bold transition-colors cursor-pointer"
                  :class="sortTarget === 'box_office' ? 'bg-brand-blue/20 text-brand-blue font-bold' : 'text-ink'"
                  @click="setSort('box_office')"
                >
                  box_office (\$M)
                </th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in sortedRows"
                :key="row.origIdx"
                class="hover:bg-card-subtle transition-all duration-300"
              >
                <!-- Row Index Label (moves with data) -->
                <td
                  class="text-center font-mono font-bold py-2 border-r border-line"
                  :class="sortTarget === 'index' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-brand-blue bg-card-subtle'"
                >
                  #{{ row.origIdx }}
                </td>

                <td class="font-mono text-ink font-semibold py-2">{{ row.title }}</td>
                <td class="font-mono text-right py-2 text-muted">{{ row.year }}</td>
                <td
                  class="font-mono text-right py-2 font-bold"
                  :class="sortTarget === 'rating' ? 'text-brand-blue bg-brand-blue/10' : 'text-ink'"
                >
                  {{ row.rating.toFixed(1) }} ★
                </td>
                <td
                  class="font-mono text-right py-2 font-bold"
                  :class="sortTarget === 'box_office' ? 'text-brand-blue bg-brand-blue/10' : 'text-emerald-600 dark:text-emerald-400'"
                >
                  \${{ row.box_office }}M
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Educational Invariant Callout -->
        <div class="p-3 rounded-md border border-line bg-card-subtle font-mono text-xs flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <Info class="w-4 h-4 text-brand-blue shrink-0" />
            <span class="text-muted">Sorting Invariant:</span>
            <strong class="text-ink">When sorting by column values, the original index labels stay glued to their row records!</strong>
          </div>
          <span class="text-muted text-[11px]">Use <code>reset_index(drop=True)</code> if you want sequential 0..N integers.</span>
        </div>
      </div>

      <div class="mt-4 pt-3 border-t border-line flex items-center justify-between text-xs font-mono text-muted">
        <span>Method distinction:</span>
        <strong class="text-ink">df.sort_values() sorts by cell contents • df.sort_index() restores row index order</strong>
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active Sorting Command:</span>
        <span class="text-brand-blue font-semibold">{{ sortTarget === 'index' ? 'Index Alignment' : 'Column Value Sort' }}</span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ activeCodeSnippet }}</code></pre>
    </div>
  </div>
</template>

