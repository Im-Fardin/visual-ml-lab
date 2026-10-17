<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Calendar,
  Clock,
  ArrowRight,
  RotateCcw,
  Play,
  StepForward,
  TrendingUp,
  Filter,
  Layers,
  Sparkles
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Data Models -----------------------------------------------------------
interface Reading {
  date: string
  power_kw: number
  temp_c: number
}

const rawReadings: Reading[] = [
  { date: '2024-01-01', power_kw: 42.5, temp_c: 12.0 },
  { date: '2024-01-02', power_kw: 48.0, temp_c: 14.5 },
  { date: '2024-01-03', power_kw: 39.2, temp_c: 11.2 },
  { date: '2024-01-04', power_kw: 55.8, temp_c: 16.0 },
  { date: '2024-01-05', power_kw: 62.1, temp_c: 18.3 },
  { date: '2024-01-06', power_kw: 51.4, temp_c: 15.1 },
  { date: '2024-01-07', power_kw: 46.7, temp_c: 13.8 }
]

// --- State -----------------------------------------------------------------
type ResampleMode = 'downsample' | 'upsample'
const mode = ref<ResampleMode>('downsample')

// Downsampling settings
type DownsampleFreq = '3D' | 'W-SUN'
const downsampleFreq = ref<DownsampleFreq>('3D')
type AggMethod = 'mean' | 'sum' | 'max'
const aggMethod = ref<AggMethod>('mean')

// Upsampling settings
type FillMethod = 'none' | 'ffill' | 'bfill' | 'interpolate'
const fillMethod = ref<FillMethod>('ffill')

// Animation phase: 0 = Original, 1 = Binned/Expanded, 2 = Aggregated/Filled
const currentStep = ref(0)
const isPlaying = ref(false)
let playTimer: ReturnType<typeof setInterval> | null = null

// Selected row for inspection
const selectedRow = ref<string | null>(null)

// --- Computeds -------------------------------------------------------------
interface ResampledRow {
  date: string
  power_kw: number | null
  temp_c: number | null
  sourceDates?: string[]
  isSynthesized?: boolean
}

// Downsampling computation
const downsampledData = computed<ResampledRow[]>(() => {
  if (downsampleFreq.value === '3D') {
    const bins = [
      {
        date: '2024-01-01',
        items: rawReadings.slice(0, 3) // Jan 1, 2, 3
      },
      {
        date: '2024-01-04',
        items: rawReadings.slice(3, 6) // Jan 4, 5, 6
      },
      {
        date: '2024-01-07',
        items: rawReadings.slice(6, 7) // Jan 7
      }
    ]

    return bins.map(b => {
      const pValues = b.items.map(i => i.power_kw)
      const tValues = b.items.map(i => i.temp_c)

      let pVal = 0
      let tVal = 0

      if (aggMethod.value === 'mean') {
        pVal = Number((pValues.reduce((a, b) => a + b, 0) / pValues.length).toFixed(1))
        tVal = Number((tValues.reduce((a, b) => a + b, 0) / tValues.length).toFixed(1))
      } else if (aggMethod.value === 'sum') {
        pVal = Number(pValues.reduce((a, b) => a + b, 0).toFixed(1))
        tVal = Number(tValues.reduce((a, b) => a + b, 0).toFixed(1))
      } else if (aggMethod.value === 'max') {
        pVal = Math.max(...pValues)
        tVal = Math.max(...tValues)
      }

      return {
        date: b.date,
        power_kw: currentStep.value >= 2 ? pVal : null,
        temp_c: currentStep.value >= 2 ? tVal : null,
        sourceDates: b.items.map(i => i.date)
      }
    })
  } else {
    // W-SUN: Group all days up to Sunday (Jan 7 is Sunday)
    const pValues = rawReadings.map(i => i.power_kw)
    const tValues = rawReadings.map(i => i.temp_c)

    let pVal = 0
    let tVal = 0

    if (aggMethod.value === 'mean') {
      pVal = Number((pValues.reduce((a, b) => a + b, 0) / pValues.length).toFixed(1))
      tVal = Number((tValues.reduce((a, b) => a + b, 0) / tValues.length).toFixed(1))
    } else if (aggMethod.value === 'sum') {
      pVal = Number(pValues.reduce((a, b) => a + b, 0).toFixed(1))
      tVal = Number(tValues.reduce((a, b) => a + b, 0).toFixed(1))
    } else {
      pVal = Math.max(...pValues)
      tVal = Math.max(...tValues)
    }

    return [
      {
        date: '2024-01-07 (W-SUN)',
        power_kw: currentStep.value >= 2 ? pVal : null,
        temp_c: currentStep.value >= 2 ? tVal : null,
        sourceDates: rawReadings.map(i => i.date)
      }
    ]
  }
})

// Upsampling computation (from Daily to 12-Hour intervals for first 3 days)
const upsampledData = computed<ResampledRow[]>(() => {
  // Subset to 3 days to keep visualization clear & clean: Jan 1, Jan 2, Jan 3
  const baseSubset = rawReadings.slice(0, 3)
  const timestamps = [
    { dt: '2024-01-01 00:00', orig: baseSubset[0] },
    { dt: '2024-01-01 12:00', orig: null },
    { dt: '2024-01-02 00:00', orig: baseSubset[1] },
    { dt: '2024-01-02 12:00', orig: null },
    { dt: '2024-01-03 00:00', orig: baseSubset[2] },
    { dt: '2024-01-03 12:00', orig: null }
  ]

  return timestamps.map((slot, idx) => {
    if (slot.orig) {
      return {
        date: slot.dt,
        power_kw: slot.orig.power_kw,
        temp_c: slot.orig.temp_c,
        isSynthesized: false
      }
    }

    // Synthesized slot
    if (currentStep.value < 2 || fillMethod.value === 'none') {
      return {
        date: slot.dt,
        power_kw: null,
        temp_c: null,
        isSynthesized: true
      }
    }

    if (fillMethod.value === 'ffill') {
      // Forward fill from previous row
      const prev = timestamps[idx - 1].orig!
      return {
        date: slot.dt,
        power_kw: prev.power_kw,
        temp_c: prev.temp_c,
        isSynthesized: true
      }
    }

    if (fillMethod.value === 'bfill') {
      // Backfill from next row if available
      const next = timestamps[idx + 1]?.orig
      return {
        date: slot.dt,
        power_kw: next ? next.power_kw : null,
        temp_c: next ? next.temp_c : null,
        isSynthesized: true
      }
    }

    if (fillMethod.value === 'interpolate') {
      // Linear interpolation between idx-1 and idx+1
      const prev = timestamps[idx - 1].orig!
      const next = timestamps[idx + 1]?.orig
      if (next) {
        return {
          date: slot.dt,
          power_kw: Number(((prev.power_kw + next.power_kw) / 2).toFixed(1)),
          temp_c: Number(((prev.temp_c + next.temp_c) / 2).toFixed(1)),
          isSynthesized: true
        }
      }
      return {
        date: slot.dt,
        power_kw: prev.power_kw,
        temp_c: prev.temp_c,
        isSynthesized: true
      }
    }

    return {
      date: slot.dt,
      power_kw: null,
      temp_c: null,
      isSynthesized: true
    }
  })
})

// Current active code representation
const activeCodeSnippet = computed(() => {
  if (mode.value === 'downsample') {
    return `# Resampling: Downsampling from Daily ('D') to '${downsampleFreq.value}'
df_resampled = df.resample('${downsampleFreq.value}').${aggMethod.value}()`
  } else {
    if (fillMethod.value === 'none') {
      return `# Upsampling from Daily to 12-Hour ('12H') without filling (creates NaNs)
df_resampled = df.resample('12h').asfreq()`
    } else {
      return `# Upsampling from Daily to 12-Hour ('12H') with ${fillMethod.value}()
df_resampled = df.resample('12h').${fillMethod.value}()`
    }
  }
})

// --- Methods ---------------------------------------------------------------
const emitInspection = () => {
  if (mode.value === 'downsample') {
    emit('inspect', {
      title: `df.resample('${downsampleFreq.value}').${aggMethod.value}()`,
      details: {
        'Index Dtype': 'DatetimeIndex (freq="D")',
        'Target Frequency': downsampleFreq.value,
        'Aggregation Method': aggMethod.value,
        'Original Rows': rawReadings.length,
        'Resampled Rows': downsampledData.value.length,
        'Binning Step': currentStep.value === 0 ? 'Source TimeSeries' : currentStep.value === 1 ? 'Interval Partitioning' : 'Aggregation Computed',
        'Selected Date': selectedRow.value || 'None'
      }
    })
  } else {
    emit('inspect', {
      title: `df.resample('12h').${fillMethod.value}()`,
      details: {
        'Index Dtype': 'DatetimeIndex (freq="D")',
        'Target Frequency': '12h (Half-Day)',
        'Fill Strategy': fillMethod.value,
        'Original Rows (Subset)': 3,
        'Expanded Rows': upsampledData.value.length,
        'Synthetic Slots Added': 3,
        'Current Phase': currentStep.value === 0 ? 'Original Daily Index' : currentStep.value === 1 ? 'Frequency Grid Expansion' : 'Values Propagated'
      }
    })
  }
}

const setStep = (s: number) => {
  currentStep.value = Math.max(0, Math.min(2, s))
  emitInspection()
}

const nextStep = () => {
  if (currentStep.value < 2) {
    setStep(currentStep.value + 1)
  } else {
    setStep(0)
  }
}

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) {
    if (currentStep.value >= 2) currentStep.value = 0
    playTimer = setInterval(() => {
      if (currentStep.value < 2) {
        currentStep.value++
        emitInspection()
      } else {
        isPlaying.value = false
        if (playTimer) clearInterval(playTimer)
      }
    }, 1300)
  } else if (playTimer) {
    clearInterval(playTimer)
  }
}

const resetSimulation = () => {
  isPlaying.value = false
  if (playTimer) clearInterval(playTimer)
  currentStep.value = 0
  selectedRow.value = null
  emitInspection()
}

const selectDate = (d: string) => {
  selectedRow.value = d
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
      <!-- Mode Toggle: Downsample vs Upsample -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">Operation:</span>
        <button
          type="button"
          @click="mode = 'downsample'; resetSimulation()"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="mode === 'downsample' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          Downsample (Aggregation)
        </button>
        <button
          type="button"
          @click="mode = 'upsample'; resetSimulation()"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="mode === 'upsample' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          Upsample (Expansion & Fill)
        </button>

        <span class="text-line mx-1">|</span>

        <!-- Downsample Options -->
        <template v-if="mode === 'downsample'">
          <span class="text-muted">freq:</span>
          <button
            type="button"
            @click="downsampleFreq = '3D'; resetSimulation()"
            class="px-2 py-0.5 rounded border text-[11px]"
            :class="downsampleFreq === '3D' ? 'bg-brand-blue/15 text-brand-blue font-bold border-brand-blue/40' : 'bg-card border-line text-muted'"
          >
            '3D'
          </button>
          <button
            type="button"
            @click="downsampleFreq = 'W-SUN'; resetSimulation()"
            class="px-2 py-0.5 rounded border text-[11px]"
            :class="downsampleFreq === 'W-SUN' ? 'bg-brand-blue/15 text-brand-blue font-bold border-brand-blue/40' : 'bg-card border-line text-muted'"
          >
            'W-SUN'
          </button>

          <span class="text-muted ml-1">agg:</span>
          <button
            type="button"
            @click="aggMethod = 'mean'; emitInspection()"
            class="px-2 py-0.5 rounded border text-[11px]"
            :class="aggMethod === 'mean' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border-emerald-500/40' : 'bg-card border-line text-muted'"
          >
            mean()
          </button>
          <button
            type="button"
            @click="aggMethod = 'sum'; emitInspection()"
            class="px-2 py-0.5 rounded border text-[11px]"
            :class="aggMethod === 'sum' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border-emerald-500/40' : 'bg-card border-line text-muted'"
          >
            sum()
          </button>
          <button
            type="button"
            @click="aggMethod = 'max'; emitInspection()"
            class="px-2 py-0.5 rounded border text-[11px]"
            :class="aggMethod === 'max' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border-emerald-500/40' : 'bg-card border-line text-muted'"
          >
            max()
          </button>
        </template>

        <!-- Upsample Options -->
        <template v-else>
          <span class="text-muted">fill:</span>
          <button
            type="button"
            @click="fillMethod = 'ffill'; emitInspection()"
            class="px-2 py-0.5 rounded border text-[11px]"
            :class="fillMethod === 'ffill' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border-emerald-500/40' : 'bg-card border-line text-muted'"
          >
            ffill()
          </button>
          <button
            type="button"
            @click="fillMethod = 'bfill'; emitInspection()"
            class="px-2 py-0.5 rounded border text-[11px]"
            :class="fillMethod === 'bfill' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border-emerald-500/40' : 'bg-card border-line text-muted'"
          >
            bfill()
          </button>
          <button
            type="button"
            @click="fillMethod = 'interpolate'; emitInspection()"
            class="px-2 py-0.5 rounded border text-[11px]"
            :class="fillMethod === 'interpolate' ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold border-emerald-500/40' : 'bg-card border-line text-muted'"
          >
            interpolate()
          </button>
          <button
            type="button"
            @click="fillMethod = 'none'; emitInspection()"
            class="px-2 py-0.5 rounded border text-[11px]"
            :class="fillMethod === 'none' ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold border-amber-500/40' : 'bg-card border-line text-muted'"
          >
            asfreq() [NaN]
          </button>
        </template>
      </div>

      <!-- Step Indicator Badge -->
      <div class="flex items-center gap-1.5 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <span class="w-2 h-2 rounded-full" :class="currentStep === 2 ? 'bg-emerald-500' : 'bg-brand-blue'" />
        <span class="font-bold text-ink">Phase {{ currentStep }}/2:</span>
        <span class="text-muted">
          {{ currentStep === 0 ? 'Daily Baseline' : currentStep === 1 ? (mode === 'downsample' ? 'Interval Bins' : 'Expanded Grid') : (mode === 'downsample' ? 'Aggregated' : 'Values Populated') }}
        </span>
      </div>
    </div>

    <!-- Main Resampling Arena -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <!-- LEFT BAY: Source Daily Series -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1.5">
            <span class="flex items-center gap-1.5">
              <Calendar class="w-4 h-4 text-brand-blue" />
              Source: df (Daily 'D')
            </span>
            <span class="text-[11px] font-normal text-muted">
              DatetimeIndex • len={{ mode === 'downsample' ? rawReadings.length : 3 }}
            </span>
          </div>

          <div class="overflow-x-auto w-full">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-12 text-center text-muted">#</th>
                  <th class="text-left font-bold text-ink">timestamp</th>
                  <th class="text-right font-bold text-ink">power_kw</th>
                  <th class="text-right font-bold text-ink">temp_c</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in (mode === 'downsample' ? rawReadings : rawReadings.slice(0, 3))"
                  :key="row.date"
                  @click="selectDate(row.date)"
                  class="cursor-pointer transition-colors"
                  :class="[
                    selectedRow === row.date ? 'bg-brand-blue/10 font-medium' : 'hover:bg-card-subtle',
                    currentStep >= 1 && mode === 'downsample' ? 'border-l-2 border-brand-blue/70' : ''
                  ]"
                >
                  <td class="text-center text-muted font-mono text-[11px]">{{ idx }}</td>
                  <td class="font-mono text-ink font-semibold flex items-center gap-1.5 py-1.5">
                    <Clock class="w-3 h-3 text-muted" />
                    {{ row.date }}
                  </td>
                  <td class="font-mono text-right text-brand-blue font-bold">{{ row.power_kw.toFixed(1) }}</td>
                  <td class="font-mono text-right text-emerald-600 dark:text-emerald-400">{{ row.temp_c.toFixed(1) }}°</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Metadata Tag -->
          <div class="p-2.5 rounded border border-line bg-card-subtle text-[11px] font-mono text-muted flex items-center justify-between">
            <span>Freq: <strong class="text-ink">Day ('D')</strong></span>
            <span>Index: <strong class="text-ink">DatetimeIndex</strong></span>
            <span>Memory: <strong class="text-ink">64-bit int ns</strong></span>
          </div>
        </div>

        <!-- RIGHT BAY: Resampled Target Series -->
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1.5">
            <span class="flex items-center gap-1.5">
              <Sparkles class="w-4 h-4 text-emerald-500" />
              Target: df_resampled
            </span>
            <span class="text-[11px] font-normal text-muted">
              {{ mode === 'downsample' ? `freq="${downsampleFreq}" • agg="${aggMethod}"` : `freq="12h" • fill="${fillMethod}"` }}
            </span>
          </div>

          <!-- DOWNSAMPLE TABLE -->
          <div v-if="mode === 'downsample'" class="overflow-x-auto w-full">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-12 text-center text-muted">#</th>
                  <th class="text-left font-bold text-ink">timestamp</th>
                  <th class="text-right font-bold text-ink">power_kw</th>
                  <th class="text-right font-bold text-ink">temp_c</th>
                  <th class="text-center font-bold text-muted text-[10px]">Bin Source</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in downsampledData"
                  :key="row.date"
                  @click="selectDate(row.date)"
                  class="cursor-pointer transition-colors"
                  :class="selectedRow === row.date ? 'bg-emerald-500/10 font-medium' : 'hover:bg-card-subtle'"
                >
                  <td class="text-center text-muted font-mono text-[11px]">{{ idx }}</td>
                  <td class="font-mono text-ink font-semibold flex items-center gap-1.5 py-1.5">
                    <Calendar class="w-3 h-3 text-emerald-500" />
                    {{ row.date }}
                  </td>
                  <td class="font-mono text-right font-bold">
                    <span v-if="row.power_kw !== null" class="text-brand-blue">{{ row.power_kw }}</span>
                    <span v-else class="nan font-mono text-xs">...</span>
                  </td>
                  <td class="font-mono text-right font-semibold">
                    <span v-if="row.temp_c !== null" class="text-emerald-600 dark:text-emerald-400">{{ row.temp_c }}°</span>
                    <span v-else class="nan font-mono text-xs">...</span>
                  </td>
                  <td class="text-center font-mono text-[10px] text-muted">
                    {{ row.sourceDates ? `[${row.sourceDates.length} days]` : '' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- UPSAMPLE TABLE -->
          <div v-else class="overflow-x-auto w-full">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-12 text-center text-muted">#</th>
                  <th class="text-left font-bold text-ink">timestamp (12h)</th>
                  <th class="text-right font-bold text-ink">power_kw</th>
                  <th class="text-right font-bold text-ink">temp_c</th>
                  <th class="text-center font-bold text-muted text-[10px]">Origin</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in upsampledData"
                  :key="row.date"
                  class="transition-colors"
                  :class="row.isSynthesized ? 'bg-amber-500/5' : ''"
                >
                  <td class="text-center text-muted font-mono text-[11px]">{{ idx }}</td>
                  <td class="font-mono text-ink font-semibold flex items-center gap-1.5 py-1.5">
                    <Clock class="w-3 h-3" :class="row.isSynthesized ? 'text-amber-500' : 'text-brand-blue'" />
                    {{ row.date }}
                  </td>
                  <td class="font-mono text-right font-bold">
                    <span v-if="row.power_kw !== null" :class="row.isSynthesized ? 'text-amber-600 dark:text-amber-400' : 'text-brand-blue'">
                      {{ row.power_kw }}
                    </span>
                    <span v-else class="nan font-mono text-xs">NaN</span>
                  </td>
                  <td class="font-mono text-right font-semibold">
                    <span v-if="row.temp_c !== null" :class="row.isSynthesized ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'">
                      {{ row.temp_c }}°
                    </span>
                    <span v-else class="nan font-mono text-xs">NaN</span>
                  </td>
                  <td class="text-center font-mono text-[10px]">
                    <span
                      v-if="row.isSynthesized"
                      class="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold bg-amber-500/20 text-amber-700 dark:text-amber-300"
                    >
                      {{ fillMethod === 'none' ? 'Gap (NaN)' : fillMethod }}
                    </span>
                    <span v-else class="text-muted text-[10px]">Real</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Target Metadata Info Banner -->
          <div class="p-2.5 rounded border border-line bg-card-subtle text-[11px] font-mono text-muted flex items-center justify-between">
            <span v-if="mode === 'downsample'">
              Reduction: <strong class="text-emerald-600 dark:text-emerald-400">{{ rawReadings.length }} rows → {{ downsampledData.length }} rows</strong>
            </span>
            <span v-else>
              Expansion: <strong class="text-amber-600 dark:text-amber-400">3 rows → 6 rows (2x density)</strong>
            </span>
            <span>Index: <strong class="text-ink">DatetimeIndex</strong></span>
          </div>
        </div>
      </div>

      <!-- Bottom Interactive Stepper & Playback Controls -->
      <div class="mt-6 pt-3 border-t border-line flex items-center justify-between flex-wrap gap-3">
        <!-- Controls -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="togglePlay"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-blue text-white text-xs font-mono font-medium hover:bg-brand-blue/90 shadow-2xs cursor-pointer"
          >
            <Play class="w-3.5 h-3.5 fill-current" v-if="!isPlaying" />
            <span v-else class="w-3.5 h-3.5 flex items-center justify-center font-bold">||</span>
            <span>{{ isPlaying ? 'Pause' : 'Animate Resample' }}</span>
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
            title="Reset simulation"
          >
            <RotateCcw class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Stepper Phase Buttons -->
        <div class="flex items-center gap-1">
          <button
            v-for="s in [0, 1, 2]"
            :key="s"
            type="button"
            @click="setStep(s)"
            class="px-2.5 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer"
            :class="currentStep === s ? 'bg-brand-blue text-white border-brand-blue font-bold shadow-2xs' : 'bg-card border-line text-muted hover:text-ink'"
          >
            {{ s === 0 ? '1. Baseline' : s === 1 ? (mode === 'downsample' ? '2. Partition' : '2. Grid') : (mode === 'downsample' ? '3. Aggregate' : '3. Fill') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active Resample Invariant:</span>
        <span class="text-emerald-600 dark:text-emerald-400 font-semibold">Zero Temporal Leakage</span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ activeCodeSnippet }}</code></pre>
    </div>
  </div>
</template>

