<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  Play,
  RotateCcw,
  StepForward,
  Plus,
  ArrowRight,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  Equal
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// Data Models
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

// Union Keys sorted alphabetically
const unionKeys = ['apples', 'bananas', 'grapes', 'oranges']

// State
const currentStep = ref(0) // 0: Init, 1: Union Index, 2: Trace Matches, 3: Execute Addition
const isPlaying = ref(false)
const useFillValue = ref(false)
const selectedFruit = ref<string | null>(null)
let playTimer: ReturnType<typeof setInterval> | null = null

// Calculation for each union key
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
      isShared: valA !== null && valB !== null
    }
  })
})

// Control actions
const setStep = (step: number) => {
  currentStep.value = Math.max(0, Math.min(3, step))
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
    }, 1400)
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

const toggleFill = () => {
  useFillValue.value = !useFillValue.value
  emitInspection()
}

const selectFruit = (key: string) => {
  selectedFruit.value = selectedFruit.value === key ? null : key
  emitInspection()
}

// Telemetry
const emitInspection = () => {
  const stepLabels = [
    'Initial Separate Series (Disjoint Indexes)',
    'Step 1: Construct Union Index Frame',
    'Step 2: Trace Matching Index Keys',
    'Step 3: Execute Vectorized Addition'
  ]

  const details: Record<string, any> = {
    'Operation': useFillValue.value ? 's1.add(s2, fill_value=0)' : 's1 + s2',
    'Pipeline Step': `[${currentStep.value}/3] ${stepLabels[currentStep.value]}`,
    'Series A Index': `[${seriesA.map(i => `'${i.key}'`).join(', ')}]`,
    'Series B Index': `[${seriesB.map(i => `'${i.key}'`).join(', ')}]`,
    'Union Index': `[${unionKeys.map(k => `'${k}'`).join(', ')}]`,
    'Missing Key Policy': useFillValue.value
      ? 'fill_value=0 substitutes 0 for missing operands (Preserves clean float/int)'
      : 'Default arithmetic propagates NaN if either operand is absent'
  }

  if (selectedFruit.value) {
    const item = alignmentResults.value.find(i => i.key === selectedFruit.value)
    if (item) {
      details['Selected Fruit'] = item.key
      details['Operand A'] = item.valA !== null ? `${item.valA}` : '(Missing / None)'
      details['Operand B'] = item.valB !== null ? `${item.valB}` : '(Missing / None)'
      details['Aligned Result'] = item.isNaN ? 'NaN (Unmatched Index)' : `${item.finalVal}`
    }
  }

  emit('inspect', {
    title: `Series Alignment: ${useFillValue.value ? 's1.add(s2, fill_value=0)' : 's1 + s2'}`,
    details
  })
}

onMounted(() => {
  emitInspection()
})

onBeforeUnmount(() => {
  if (playTimer) clearInterval(playTimer)
})
</script>

<template>
  <div class="flex flex-col gap-2.5 w-full">
    <!-- Viewport Container with clean responsive flow layout -->
    <div
      class="relative w-full min-h-[380px] rounded-lg border border-line bg-stage shadow-xs flex flex-col justify-between p-4 select-none"
    >
      <!-- Top Action Bar: Operation Formula & Step Progression -->
      <div class="flex items-center justify-between gap-2 flex-wrap z-20 pb-3 border-b border-line/50">
        <!-- Operation Formula Pill -->
        <div class="flex items-center gap-2 bg-card px-3 py-1.5 rounded-md border border-line shadow-2xs font-mono text-xs">
          <span class="w-2 h-2 rounded-full" :class="useFillValue ? 'bg-brand-green' : 'bg-brand-blue'" />
          <span class="font-bold text-ink">
            {{ useFillValue ? 's1.add(s2, fill_value=0)' : 'result = s1 + s2' }}
          </span>
          <span class="text-muted text-[11px] hidden sm:inline">|</span>
          <span class="text-[11px] font-semibold" :class="useFillValue ? 'text-brand-green' : 'text-amber-600 dark:text-amber-400'">
            {{ useFillValue ? 'NaN Suppressed' : 'Outer Join (Union)' }}
          </span>
        </div>

        <!-- fill_value=0 Toggle Switch -->
        <button
          type="button"
          @click="toggleFill"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono text-xs transition-all shadow-2xs cursor-pointer"
          :class="useFillValue ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold ring-2 ring-emerald-400/20' : 'bg-card border-line text-muted hover:text-ink hover:bg-card-subtle'"
          title="Substitute missing values with 0 before arithmetic"
        >
          <ShieldCheck class="w-3.5 h-3.5 text-emerald-500" />
          <span>fill_value=0</span>
        </button>
      </div>

      <!-- Center Stage: Responsive Flow-Based Equation Grid -->
      <div class="my-4 relative z-10 w-full overflow-x-auto py-2">
        <div class="flex flex-col lg:flex-row items-center justify-center gap-6 min-h-[280px] w-full">
          <!-- Bay 1: Series A Table -->
          <div class="flex flex-col items-center shrink-0">
            <div class="text-xs font-mono font-bold text-brand-blue mb-1.5">s1 (Series A)</div>
            <table class="dataframe">
              <thead>
                <tr class="h-9">
                  <th class="px-3">key</th>
                  <th class="px-3">value</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in seriesA"
                  :key="'a-'+item.key"
                  @click="selectFruit(item.key)"
                  :class="selectedFruit===item.key ? 'bg-blue-50 dark:bg-blue-950/60 font-bold ring-1 ring-blue-400' : ''"
                  class="cursor-pointer h-9 transition-colors"
                >
                  <th class="px-3 text-left font-bold text-ink">{{ item.key }}</th>
                  <td class="px-3 text-right text-brand-blue font-semibold">{{ item.val }}</td>
                </tr>
              </tbody>
            </table>
            <div class="text-[10px] font-mono text-muted text-center pt-1.5">
              Length: 3 | dtype: int64 (No 'grapes')
            </div>
          </div>

          <!-- Operator (+) -->
          <div class="flex flex-col items-center justify-center shrink-0 py-2 lg:py-0">
            <div class="w-8 h-8 rounded-full bg-card border border-line shadow-xs flex items-center justify-center text-ink font-bold text-sm">
              <Plus class="w-4 h-4 text-brand-blue" />
            </div>
          </div>

          <!-- Bay 2: Series B Table -->
          <div class="flex flex-col items-center shrink-0">
            <div class="text-xs font-mono font-bold text-purple-600 dark:text-purple-400 mb-1.5">s2 (Series B)</div>
            <table class="dataframe">
              <thead>
                <tr class="h-9">
                  <th class="px-3">key</th>
                  <th class="px-3">value</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="item in seriesB"
                  :key="'b-'+item.key"
                  @click="selectFruit(item.key)"
                  :class="selectedFruit===item.key ? 'bg-purple-50 dark:bg-purple-950/60 font-bold ring-1 ring-purple-400' : ''"
                  class="cursor-pointer h-9 transition-colors"
                >
                  <th class="px-3 text-left font-bold text-ink">{{ item.key }}</th>
                  <td class="px-3 text-right text-purple-600 dark:text-purple-400 font-semibold">{{ item.val }}</td>
                </tr>
              </tbody>
            </table>
            <div class="text-[10px] font-mono text-muted text-center pt-1.5">
              Length: 3 | dtype: int64 (No 'apples')
            </div>
          </div>

          <!-- Operator (=) -->
          <div class="flex flex-col items-center justify-center shrink-0 py-2 lg:py-0">
            <div class="w-8 h-8 rounded-full bg-card border border-line shadow-xs flex items-center justify-center text-ink font-bold text-sm">
              <Equal class="w-4 h-4 text-emerald-500" />
            </div>
          </div>

          <!-- Bay 3: Result Table -->
          <div class="flex flex-col items-center shrink-0">
            <div class="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mb-1.5">
              {{ useFillValue ? 's1.add(s2, fill_value=0)' : 'Result (s1 + s2)' }}
            </div>
            <table class="dataframe">
              <thead>
                <tr class="h-9">
                  <th class="px-3">key</th>
                  <th class="px-3">value</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="res in alignmentResults"
                  :key="'res-'+res.key"
                  @click="selectFruit(res.key)"
                  :class="[
                    selectedFruit===res.key ? 'ring-2 ring-emerald-400 font-bold' : '',
                    currentStep<1 ? 'bg-card/40 opacity-40' : currentStep<3 ? 'bg-card' : res.isNaN ? 'bg-red-500/10 text-red-900 dark:text-red-300' : 'bg-emerald-500/10 text-emerald-950 dark:text-emerald-100'
                  ]"
                  class="cursor-pointer h-9 transition-colors"
                >
                  <th class="px-3 text-left font-bold">{{ res.key }}</th>
                  <td class="px-3 text-right" v-if="currentStep>=3">
                    <span v-if="res.isNaN" class="nan text-red-600 dark:text-red-400 font-bold">NaN</span>
                    <span v-else class="text-emerald-600 dark:text-emerald-400 font-bold">{{ res.finalVal }}.0</span>
                  </td>
                  <td v-else class="px-3 text-center text-muted italic text-xs">--</td>
                </tr>
              </tbody>
            </table>
            <div class="text-[10px] font-mono text-muted text-center pt-1.5">
              Length: 4 | dtype: {{ useFillValue ? 'float64' : 'float64 / NaN' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Step-by-Step Playback Controller -->
      <div class="flex items-center justify-between gap-2 pt-2 border-t border-line/60 flex-wrap z-20">
        <!-- Step Indicators -->
        <div class="flex items-center gap-1 font-mono text-xs">
          <button
            v-for="s in [0, 1, 2, 3]"
            :key="s"
            type="button"
            @click="setStep(s)"
            class="px-2 py-0.5 rounded text-[11px] font-medium transition-all"
            :class="currentStep === s ? 'bg-brand-blue text-white font-bold shadow-2xs' : 'text-muted hover:text-ink bg-card border border-line'"
          >
            {{ s === 0 ? 'Init' : 'Step ' + s }}
          </button>
        </div>

        <!-- Playback Trigger Buttons -->
        <div class="flex items-center gap-1.5 font-mono text-xs">
          <button
            type="button"
            @click="resetSimulation"
            class="p-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-muted hover:text-ink transition-colors"
            title="Reset alignment equation"
          >
            <RotateCcw class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            @click="nextStep"
            class="px-2.5 py-1 rounded-md border border-line bg-card hover:bg-card-subtle text-ink font-semibold flex items-center gap-1.5 transition-colors text-[11px]"
          >
            <StepForward class="w-3.5 h-3.5" />
            <span>Step</span>
          </button>
          <button
            type="button"
            @click="togglePlay"
            class="px-3 py-1 rounded-md font-bold flex items-center gap-1.5 transition-all text-[11px]"
            :class="isPlaying ? 'bg-brand-amber text-slate-950 shadow-xs' : 'bg-brand-blue text-white shadow-xs'"
          >
            <Play class="w-3.5 h-3.5" :class="{ 'animate-pulse': isPlaying }" />
            <span>{{ isPlaying ? 'Pause' : 'Play Flow' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Interactive Instructional HUD -->
    <div class="rounded-lg border border-line bg-card p-3 shadow-2xs font-mono text-xs flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 text-muted">
        <span class="w-1.5 h-1.5 rounded-full" :class="useFillValue ? 'bg-emerald-500' : 'bg-amber-500'" />
        <span>Core Invariant:</span>
        <span class="text-ink font-semibold">Pandas never aligns by positional row offset; it always aligns by exact Index Label.</span>
      </div>
      <div v-if="selectedFruit" class="text-ink font-bold bg-card-subtle px-2 py-0.5 rounded border border-line">
        Key '{{ selectedFruit }}': {{ alignmentResults.find(i => i.key === selectedFruit)?.isNaN ? 'Propagates NaN (Missing Operand)' : 'Matches operands & Sums' }}
      </div>
    </div>
  </div>
</template>
