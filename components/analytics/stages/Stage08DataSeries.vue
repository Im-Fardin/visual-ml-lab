<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  Layers,
  Split,
  Play,
  RotateCcw,
  StepForward,
  Plus,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Equal,
  Info
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// Sub-mode: 'anatomy' vs 'alignment'
type SubView = 'anatomy' | 'alignment'
const currentSubView = ref<SubView>('alignment')

// --- ANATOMY STATE ---
type IndexType = 'semantic' | 'range' | 'alpha'
const activeIndexType = ref<IndexType>('semantic')
const isExploded = ref(false)

const rawValues = [120, 245, 85, 310]
const memoryOffsets = ['0x7f9a12c0', '0x7f9a12c8', '0x7f9a12d0', '0x7f9a12d8']
const showMemory = ref(false)

const indexSets: Record<IndexType, { name: string; labels: (string | number)[]; desc: string }> = {
  semantic: { name: 'Semantic String Index', labels: ['Mon', 'Tue', 'Wed', 'Thu'], desc: 'Weekday labels' },
  range: { name: 'RangeIndex', labels: [0, 1, 2, 3], desc: 'Default integer sequence (0..N-1)' },
  alpha: { name: 'Letter Index', labels: ['row_a', 'row_b', 'row_c', 'row_d'], desc: 'Explicit string identifiers' }
}

const currentIndex = computed(() => indexSets[activeIndexType.value])
const combinedRows = computed(() =>
  currentIndex.value.labels.map((lbl, i) => ({ label: lbl, value: rawValues[i] }))
)

// --- ALIGNMENT STATE ---
interface FruitItem {
  key: string
  val: number
}

const seriesA: FruitItem[] = [
  { key: 'apples', val: 3 },
  { key: 'oranges', val: 5 },
  { key: 'bananas', val: 2 }
]

const seriesB: FruitItem[] = [
  { key: 'oranges', val: 4 },
  { key: 'bananas', val: 6 },
  { key: 'grapes', val: 7 }
]

const unionKeys = ['apples', 'bananas', 'grapes', 'oranges']
const currentStep = ref(0) // 0: Init, 1: Union Index, 2: Trace Matches, 3: Execute Addition
const isPlaying = ref(false)
const useFillValue = ref(false)
const selectedFruit = ref<string | null>(null)
let playTimer: ReturnType<typeof setInterval> | null = null

const alignmentResults = computed(() => {
  return unionKeys.map((key) => {
    const itemA = seriesA.find((i) => i.key === key)
    const itemB = seriesB.find((i) => i.key === key)

    const valA = itemA ? itemA.val : null
    const valB = itemB ? itemB.val : null

    let finalVal: number | string = 'NaN'
    let isNaN = false

    if (useFillValue.value) {
      const effA = valA ?? 0
      const effB = valB ?? 0
      finalVal = effA + effB
      isNaN = false
    } else {
      if (valA !== null && valB !== null) {
        finalVal = valA + valB
        isNaN = false
      } else {
        finalVal = 'NaN'
        isNaN = true
      }
    }

    return {
      key,
      valA,
      valB,
      finalVal,
      isNaN,
      isMatch: valA !== null && valB !== null
    }
  })
})

const activeCodeSnippet = computed(() => {
  if (currentSubView.value === 'anatomy') {
    return `# Series Anatomy: Index Rail + Values Spine
import pandas as pd
import numpy as np

s = pd.Series([120, 245, 85, 310], index=['Mon', 'Tue', 'Wed', 'Thu'], dtype='int64')

print("Underlying ndarray:", s.values) # np.array([120, 245,  85, 310])
print("Index Rail:", s.index)           # Index(['Mon', 'Tue', 'Wed', 'Thu'])
print("Memory buffer:", s.nbytes)      # 32 bytes (4 * 8 bytes)`
  } else {
    if (useFillValue.value) {
      return `# Alignment with fill_value=0
import pandas as pd

s1 = pd.Series({'apples': 3, 'oranges': 5, 'bananas': 2})
s2 = pd.Series({'oranges': 4, 'bananas': 6, 'grapes': 7})

result = s1.add(s2, fill_value=0)
print(result)`
    } else {
      return `# Automatic Index Alignment & NaN Propagation
import pandas as pd

s1 = pd.Series({'apples': 3, 'oranges': 5, 'bananas': 2})
s2 = pd.Series({'oranges': 4, 'bananas': 6, 'grapes': 7})

# Unmatched keys ('apples', 'grapes') propagate NaN; upcasts dtype to float64
result = s1 + s2
print(result)`
    }
  }
})

// Inspection telemetry
const emitInspection = () => {
  if (currentSubView.value === 'anatomy') {
    emit('inspect', {
      title: `pd.Series Anatomy (${isExploded.value ? 'Exploded Components' : 'Unified Series'})`,
      details: {
        'Series Shape': '(4,)',
        'Data Type (dtype)': 'int64 (8 bytes/item)',
        'Index Type': currentIndex.value.name,
        'Architecture': isExploded.value ? 'EXPLODED: Index detached from underlying ndarray' : 'BOUND: pd.Series = Index rail + Values spine',
        'Values Buffer': `np.array([${rawValues.join(', ')}])`
      }
    })
  } else {
    emit('inspect', {
      title: useFillValue.value ? 's1.add(s2, fill_value=0)' : 's1 + s2 (Automatic Label Alignment)',
      details: {
        'Operation': 'Union of index labels',
        'Union Keys': unionKeys.join(', '),
        'Matching Keys': 'oranges, bananas',
        'Disjoint Keys': 'apples (s1 only), grapes (s2 only)',
        'NaN Behavior': useFillValue.value ? 'fill_value=0 replaces missing keys' : 'NaN propagation with float64 upcast',
        'Current Phase': currentStep.value === 0 ? 'Initial Series' : currentStep.value === 1 ? 'Union Index' : currentStep.value === 2 ? 'Key Matching' : 'Final Sum'
      }
    })
  }
}

// Stepper
const setStep = (s: number) => {
  currentStep.value = Math.max(0, Math.min(3, s))
  emitInspection()
}

const nextStep = () => {
  if (currentStep.value < 3) setStep(currentStep.value + 1)
  else setStep(0)
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
  selectedFruit.value = null
  emitInspection()
}

onMounted(() => emitInspection())
onBeforeUnmount(() => {
  if (playTimer) clearInterval(playTimer)
})
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <!-- Top Action Toolbar -->
    <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
      <!-- Sub-view switcher: Anatomy vs Alignment -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">Topic Focus:</span>
        <button
          type="button"
          @click="currentSubView = 'alignment'; resetSimulation()"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="currentSubView === 'alignment' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <span>Automatic Alignment (s1 + s2)</span>
        </button>
        <button
          type="button"
          @click="currentSubView = 'anatomy'; emitInspection()"
          class="flex items-center gap-1 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="currentSubView === 'anatomy' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <span>Series Anatomy (Index + Values)</span>
        </button>

        <!-- Contextual Controls -->
        <template v-if="currentSubView === 'alignment'">
          <span class="text-line mx-1">|</span>
          <button
            type="button"
            @click="useFillValue = !useFillValue; emitInspection()"
            class="px-2.5 py-1 rounded border text-[11px] font-medium transition-all cursor-pointer"
            :class="useFillValue ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border-emerald-500/40' : 'bg-card border-line text-muted'"
          >
            fill_value=0: {{ useFillValue ? 'ON' : 'OFF' }}
          </button>
        </template>
        <template v-else>
          <span class="text-line mx-1">|</span>
          <button
            type="button"
            @click="isExploded = !isExploded; emitInspection()"
            class="px-2.5 py-1 rounded border text-[11px] font-medium transition-all cursor-pointer"
            :class="isExploded ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold border-amber-500/40' : 'bg-card border-line text-muted'"
          >
            {{ isExploded ? 'Bound View' : 'Separate Index & Values' }}
          </button>
        </template>
      </div>

      <!-- Badge Indicator -->
      <div class="flex items-center gap-2 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <span class="w-2 h-2 rounded-full bg-brand-blue" />
        <span class="font-bold text-ink">
          {{ currentSubView === 'alignment' ? `Phase ${currentStep}/3: ${currentStep === 0 ? 'Inputs' : currentStep === 1 ? 'Union' : currentStep === 2 ? 'Matched' : 'Evaluated'}` : (isExploded ? 'Exploded Anatomy' : 'Unified Series') }}
        </span>
      </div>
    </div>

    <!-- Main Living Table Arena -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <!-- 1. ALIGNMENT EQUATION BAY -->
      <div v-if="currentSubView === 'alignment'" class="flex flex-col gap-4">
        <!-- Horizontal Equation Container: s1 + s2 = Result -->
        <div class="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
          <!-- Series A (Cols 3) -->
          <div class="md:col-span-3 flex flex-col gap-1.5 bg-card p-3 rounded-lg border border-line">
            <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1">
              <span>s1 (3 items)</span>
              <span class="text-muted text-[10px]">int64</span>
            </div>
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="text-left font-bold text-muted">fruit</th>
                  <th class="text-right font-bold text-brand-blue">qty</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in seriesA" :key="item.key">
                  <td class="font-mono text-ink font-semibold py-1">{{ item.key }}</td>
                  <td class="font-mono text-right font-bold text-brand-blue">{{ item.val }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Operator: Plus (Col 1) -->
          <div class="md:col-span-1 flex items-center justify-center">
            <div class="w-7 h-7 rounded-full bg-brand-blue/15 text-brand-blue flex items-center justify-center font-bold text-sm">
              +
            </div>
          </div>

          <!-- Series B (Cols 3) -->
          <div class="md:col-span-3 flex flex-col gap-1.5 bg-card p-3 rounded-lg border border-line">
            <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1">
              <span>s2 (3 items)</span>
              <span class="text-muted text-[10px]">int64</span>
            </div>
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="text-left font-bold text-muted">fruit</th>
                  <th class="text-right font-bold text-emerald-600 dark:text-emerald-400">qty</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in seriesB" :key="item.key">
                  <td class="font-mono text-ink font-semibold py-1">{{ item.key }}</td>
                  <td class="font-mono text-right font-bold text-emerald-600 dark:text-emerald-400">{{ item.val }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Operator: Equal (Col 1) -->
          <div class="md:col-span-1 flex items-center justify-center">
            <div class="w-7 h-7 rounded-full bg-muted/20 text-ink flex items-center justify-center font-bold text-sm">
              =
            </div>
          </div>

          <!-- Result Series (Cols 3) -->
          <div class="md:col-span-3 flex flex-col gap-1.5 bg-card p-3 rounded-lg border border-line">
            <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1">
              <span>Result (4 items)</span>
              <span class="text-amber-600 dark:text-amber-400 text-[10px] font-bold">
                {{ useFillValue ? 'int64' : 'float64 (NaN upcast)' }}
              </span>
            </div>
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="text-left font-bold text-muted">fruit</th>
                  <th class="text-right font-bold text-ink">s1 + s2</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in alignmentResults"
                  :key="row.key"
                  class="transition-colors"
                  :class="row.isNaN ? 'bg-amber-500/10' : 'bg-emerald-500/5'"
                >
                  <td class="font-mono text-ink font-semibold py-1">{{ row.key }}</td>
                  <td class="font-mono text-right font-bold">
                    <span v-if="currentStep >= 3">
                      <span v-if="row.isNaN" class="nan text-amber-700 dark:text-amber-400 font-mono">NaN</span>
                      <span v-else class="text-emerald-600 dark:text-emerald-400">{{ row.finalVal }}</span>
                    </span>
                    <span v-else-if="currentStep === 2" class="text-muted text-[11px]">
                      {{ row.valA !== null ? row.valA : (useFillValue ? '0' : 'NaN') }} + {{ row.valB !== null ? row.valB : (useFillValue ? '0' : 'NaN') }}
                    </span>
                    <span v-else class="text-muted">...</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Explanatory Invariant Strip -->
        <div class="p-3 rounded-md border border-line bg-card-subtle font-mono text-xs flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <Info class="w-4 h-4 text-brand-blue shrink-0" />
            <span class="text-muted">Alignment Rule:</span>
            <strong class="text-ink">Pandas aligns by label, NOT row index position! Missing keys propagate NaN.</strong>
          </div>
          <span class="text-emerald-600 dark:text-emerald-400 font-bold">
            {{ useFillValue ? 'Cleaned: fill_value=0 eliminates NaNs' : 'NaN forces float64 type promotion' }}
          </span>
        </div>
      </div>

      <!-- 2. ANATOMY BAY -->
      <div v-else class="flex flex-col gap-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          <!-- Left: Combined or Exploded Index -->
          <div class="flex flex-col gap-2">
            <div class="text-xs font-mono font-bold text-ink border-b border-line pb-1 flex items-center justify-between">
              <span>{{ isExploded ? '1. Index Rail (pd.Index)' : 'Combined pd.Series' }}</span>
              <span class="text-[10px] text-muted">{{ currentIndex.desc }}</span>
            </div>

            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="text-left font-bold text-muted">Index Label</th>
                  <th v-if="!isExploded" class="text-right font-bold text-brand-blue">Value</th>
                  <th v-if="showMemory" class="text-right font-bold text-muted text-[10px]">Memory Address</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, idx) in combinedRows" :key="idx" class="hover:bg-card-subtle">
                  <td class="font-mono text-ink font-semibold py-1.5">{{ row.label }}</td>
                  <td v-if="!isExploded" class="font-mono text-right font-bold text-brand-blue">{{ row.value }}</td>
                  <td v-if="showMemory" class="font-mono text-right text-muted text-[10px]">{{ memoryOffsets[idx] }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Right: Values Spine (ndarray) if exploded -->
          <div v-if="isExploded" class="flex flex-col gap-2">
            <div class="text-xs font-mono font-bold text-brand-blue border-b border-line pb-1 flex items-center justify-between">
              <span>2. Values Spine (np.ndarray)</span>
              <span class="text-[10px] text-muted">dtype: int64 (contiguous)</span>
            </div>

            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-12 text-center font-bold text-muted">offset</th>
                  <th class="text-right font-bold text-brand-blue">raw_value</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(v, idx) in rawValues" :key="idx" class="hover:bg-card-subtle">
                  <td class="text-center font-mono text-[11px] text-muted">[{{ idx }}]</td>
                  <td class="font-mono text-right font-bold text-brand-blue py-1.5">{{ v }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Architectural Insight if not exploded -->
          <div v-else class="rounded-md border border-line bg-card p-4 text-xs font-mono text-muted space-y-2">
            <div class="font-bold text-ink flex items-center gap-1.5">
              <Layers class="w-3.5 h-3.5 text-brand-blue" />
              <span>Series Internal Composition</span>
            </div>
            <p class="leading-relaxed">
              A Pandas Series is composed of two orthogonal structures:
              an <strong>Index rail</strong> storing label mappings, and a <strong>NumPy array spine</strong> storing contiguous raw typed bytes in C order.
            </p>
          </div>
        </div>
      </div>

      <!-- Bottom Interactive Controls for Alignment -->
      <div v-if="currentSubView === 'alignment'" class="mt-4 pt-3 border-t border-line flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="togglePlay"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-blue text-white text-xs font-mono font-medium hover:bg-brand-blue/90 shadow-2xs cursor-pointer"
          >
            <Play class="w-3.5 h-3.5 fill-current" v-if="!isPlaying" />
            <span v-else class="w-3.5 h-3.5 flex items-center justify-center font-bold">||</span>
            <span>{{ isPlaying ? 'Pause' : 'Animate Alignment' }}</span>
          </button>

          <button
            type="button"
            @click="nextStep"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card text-xs font-mono text-ink hover:bg-card-subtle shadow-2xs cursor-pointer"
          >
            <StepForward class="w-3.5 h-3.5 text-muted" />
            <span>Step</span>
          </button>

          <button
            type="button"
            @click="resetSimulation"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card text-xs font-mono text-muted hover:text-ink hover:bg-card-subtle shadow-2xs cursor-pointer"
            title="Reset"
          >
            <RotateCcw class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Stepper Buttons -->
        <div class="flex items-center gap-1">
          <button
            v-for="s in [0, 1, 2, 3]"
            :key="s"
            type="button"
            @click="setStep(s)"
            class="px-2.5 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer"
            :class="currentStep === s ? 'bg-brand-blue text-white border-brand-blue font-bold shadow-2xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            {{ s === 0 ? '1. Inputs' : s === 1 ? '2. Union' : s === 2 ? '3. Trace' : '4. Sum' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active Series Command:</span>
        <span class="text-brand-blue font-semibold">{{ currentSubView === 'alignment' ? 'Label-Based Alignment Engine' : 'Values & Index Rail Architecture' }}</span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ activeCodeSnippet }}</code></pre>
    </div>
  </div>
</template>

