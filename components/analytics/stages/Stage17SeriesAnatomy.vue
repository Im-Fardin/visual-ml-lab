<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'
import { Layers, Split, Tag } from 'lucide-vue-next'

const props = defineProps<{ topic: AnalyticsTopic }>()
const emit = defineEmits<{ (e: 'inspect', payload: { title: string; details: Record<string, any> }): void }>()

// --- State ----------------------------------------------------------
type IndexType = 'range' | 'semantic' | 'alpha'
const activeIndexType = ref<IndexType>('semantic')
const isExploded = ref(false) // true => show separate index/value tables

// Data values (int64 Series: Sales quantities)
const rawValues = [120, 245, 85, 310]
const memoryOffsets = ['0x7f9a12c0', '0x7f9a12c8', '0x7f9a12d0', '0x7f9a12d8']
const showMemory = ref(false)

const indexSets: Record<IndexType, { name: string; labels: (string | number)[]; desc: string }> = {
  range: { name: 'RangeIndex', labels: [0, 1, 2, 3], desc: 'Default integer sequence' },
  semantic: { name: 'Semantic String Index', labels: ['Mon', 'Tue', 'Wed', 'Thu'], desc: 'Weekday labels' },
  alpha: { name: 'Letter Index', labels: ['row_a', 'row_b', 'row_c', 'row_d'], desc: 'Explicit string identifiers' },
}

const currentIndex = computed(() => indexSets[activeIndexType.value])

// Combined rows for unified view
const combinedRows = computed(() =>
  currentIndex.value.labels.map((lbl, i) => ({ label: lbl, value: rawValues[i] }))
)

// Inspection payload – reused for both views
const emitInspection = () => {
  const lbls = currentIndex.value.labels
  const details: Record<string, any> = {
    'Series Shape': '(4,)',
    'Data Type (dtype)': 'int64 (8 bytes/integer, contiguous C‑array)',
    Architecture: isExploded.value
      ? 'EXPLODED: Index detached from underlying ndarray'
      : 'BOUND: pd.Series = Index rail + Values spine',
    'Index Object': `pd.Index(name="${currentIndex.value.name}", labels=[${lbls
      .map((l) => (typeof l === 'string' ? `'${l}'` : l))
      .join(', ')}])`,
    'Values Buffer': `np.array([${rawValues.join(', ')}], dtype=int64)`,
  }
  emit('inspect', { title: `Series Anatomy – ${isExploded.value ? 'Exploded' : 'Unified'}`, details })
}

onMounted(() => emitInspection())
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <!-- Controls ---------------------------------------------------- -->
    <div class="flex items-center justify-between gap-2">
      <button
        @click="isExploded = false; emitInspection()"
        class="px-3 py-1 rounded transition-colors text-sm"
        :class="!isExploded ? 'bg-brand-blue text-white font-bold' : 'bg-card text-muted hover:bg-card-subtle'"
      >
        <Layers class="inline w-4 h-4 mr-1" /> Unified Series
      </button>
      <button
        @click="isExploded = true; emitInspection()"
        class="px-3 py-1 rounded transition-colors text-sm"
        :class="isExploded ? 'bg-brand-amber text-slate-900 font-bold' : 'bg-card text-muted hover:bg-card-subtle'"
      >
        <Split class="inline w-4 h-4 mr-1" /> Explode Anatomy
      </button>
      <div class="flex items-center gap-1">
        <Tag class="w-4 h-4" /> Index Type:
        <button
          v-for="(cfg, key) in indexSets"
          :key="key"
          @click="activeIndexType = key as IndexType; emitInspection()"
          class="px-2 py-0.5 rounded text-xs"
          :class="activeIndexType === key ? 'bg-amber-500/20 text-amber-700 font-bold' : 'text-muted hover:text-ink'"
        >{{ cfg.name.split(' ')[0] }}</button>
      </div>
      <button
        @click="showMemory = !showMemory; emitInspection()"
        class="px-2 py-0.5 rounded text-xs border"
        :class="showMemory ? 'bg-brand-blue/15 border-brand-blue text-brand-blue font-bold' : 'border-line bg-card text-muted hover:text-ink'"
      >
        {{ showMemory ? 'RAM Pointers' : 'Inspect RAM' }}
      </button>
    </div>

    <!-- Table(s) ---------------------------------------------------- -->
    <div class="flex flex-col gap-4">
      <transition-group name="fade" tag="div" class="flex" :class="isExploded ? 'space-x-8' : ''">
        <!-- Unified view -->
        <div v-if="!isExploded" key="unified" class="overflow-x-auto">
          <table class="dataframe">
            <thead>
              <tr><th></th><th>value</th></tr>
            </thead>
            <tbody>
              <tr v-for="(row, idx) in combinedRows" :key="idx" class="cursor-pointer" @click="emit('inspect', { title: 'Cell Clicked', details: { row: idx, label: row.label, value: row.value } })">
                <th>{{ typeof row.label === 'string' ? `'${row.label}'` : row.label }}</th>
                <td class="text-right">{{ row.value }}</td>
              </tr>
            </tbody>
          </table>
        </div>

<div v-else key="exploded" class="flex space-x-8">
  <!-- Index table -->
  <div class="overflow-x-auto">
    <table class="dataframe">
      <thead>
        <tr><th>Index</th></tr>
      </thead>
      <tbody>
        <tr v-for="(lbl, idx) in currentIndex.labels" :key="'i'+idx">
          <th>{{ typeof lbl === 'string' ? `'${lbl}'` : lbl }}</th>
        </tr>
      </tbody>
    </table>
  </div>
  <!-- Values table -->
  <div class="overflow-x-auto">
    <table class="dataframe">
      <thead>
        <tr><th>value</th></tr>
      </thead>
      <tbody>
        <tr v-for="(val, idx) in rawValues" :key="'v'+idx" :class="showMemory ? '' : ''">
          <td class="text-right">{{ val }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</div>
      </transition-group>
    </div>

    <!-- Footer ------------------------------------------------------ -->
    <div class="dataframe-footer text-sm text-muted">
      Name: sales, dtype: int64, Length: 4
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
