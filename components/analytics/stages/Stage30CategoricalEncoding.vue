<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Layers,
  ArrowRight,
  Sparkles,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Database,
  Grid,
  Info,
  Compass,
  Code2,
  Check
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Data Models -----------------------------------------------------------
interface StudentRecord {
  id: number
  name: string
  education: 'HighSchool' | 'Bachelor' | 'Master' | 'PhD'
  city: 'Tehran' | 'Shiraz' | 'Isfahan'
}

// 5 rows as specified by the prompt
const sourceRows: StudentRecord[] = [
  { id: 0, name: 'Candidate 0', education: 'HighSchool', city: 'Tehran' },
  { id: 1, name: 'Candidate 1', education: 'Bachelor', city: 'Shiraz' },
  { id: 2, name: 'Candidate 2', education: 'Master', city: 'Isfahan' },
  { id: 3, name: 'Candidate 3', education: 'Bachelor', city: 'Tehran' },
  { id: 4, name: 'Candidate 4', education: 'PhD', city: 'Shiraz' }
]

// --- State -----------------------------------------------------------------
type EncodingMode = 'ordinal_education' | 'onehot_city'
const encodingMode = ref<EncodingMode>('onehot_city')

// Dummy variable trap toggle for OneHot (drop='first')
const dropFirst = ref<boolean>(false)

// Selected row for inspection
const selectedRowId = ref<number | null>(null)

// --- Computeds -------------------------------------------------------------
const ordinalMap: Record<string, number> = {
  HighSchool: 0,
  Bachelor: 1,
  Master: 2,
  PhD: 3
}

// Sparsity calculation
const sparsityStats = computed(() => {
  if (encodingMode.value === 'ordinal_education') {
    const totalCells = 5
    // 0 is encoded as 0 (HighSchool)
    const zeroCells = sourceRows.filter(r => r.education === 'HighSchool').length
    const pct = ((zeroCells / totalCells) * 100).toFixed(1)
    return {
      totalCells,
      zeroCells,
      sparsityPct: `${pct}%`,
      matrixShape: '(5, 1)',
      redundancy: 'None (Monotonic scalar rank)'
    }
  } else {
    const colCount = dropFirst.value ? 2 : 3
    const totalCells = 5 * colCount
    let zeroCells = 0

    sourceRows.forEach(r => {
      if (dropFirst.value) {
        // Active columns: Shiraz, Tehran. Baseline Isfahan is [0, 0]
        if (r.city === 'Isfahan') zeroCells += 2
        else zeroCells += 1 // One 1, one 0
      } else {
        // Columns: Isfahan, Shiraz, Tehran. Exactly 2 zeros per row
        zeroCells += 2
      }
    })

    const pct = ((zeroCells / totalCells) * 100).toFixed(1)
    return {
      totalCells,
      zeroCells,
      sparsityPct: `${pct}%`,
      matrixShape: `(5, ${colCount})`,
      sourceShape: '(5, 1)',
      redundancy: dropFirst.value ? 'Zero Multicollinearity (Full Rank Design Matrix)' : '1 Redundant Degree of Freedom (Multicollinear with Intercept)'
    }
  }
})

// One-Hot Encoded Rows
const oneHotRows = computed(() => {
  return sourceRows.map(r => {
    const isfahan = r.city === 'Isfahan' ? 1 : 0
    const shiraz = r.city === 'Shiraz' ? 1 : 0
    const tehran = r.city === 'Tehran' ? 1 : 0

    return {
      ...r,
      city_Isfahan: isfahan,
      city_Shiraz: shiraz,
      city_Tehran: tehran
    }
  })
})

const activeCodeSnippet = computed(() => {
  if (encodingMode.value === 'ordinal_education') {
    return `# 1. Ordinal Encoding: For data with an intrinsic mathematical hierarchy
from sklearn.preprocessing import OrdinalEncoder

edu_categories = [['HighSchool', 'Bachelor', 'Master', 'PhD']]
encoder = OrdinalEncoder(categories=edu_categories)
df['education_encoded'] = encoder.fit_transform(df[['education']])

# HighSchool -> 0, Bachelor -> 1, Master -> 2, PhD -> 3
# Valid because PhD (3) > Master (2) > Bachelor (1) > HighSchool (0) preserves order.`
  } else if (!dropFirst.value) {
    return `# 2. One-Hot Encoding (drop=None): Expands K categories to K columns
from sklearn.preprocessing import OneHotEncoder

encoder = OneHotEncoder(sparse_output=False, drop=None)
city_encoded = encoder.fit_transform(df[['city']])

# Creates 3 orthogonal binary vectors: city_Isfahan, city_Shiraz, city_Tehran
# Shape: (5, 3)
# Warning: In linear models with an intercept β0, columns sum to 1 -> Multicollinear!`
  } else {
    return `# 3. One-Hot Encoding (drop='first'): Resolves The Dummy Variable Trap
from sklearn.preprocessing import OneHotEncoder

encoder = OneHotEncoder(sparse_output=False, drop='first')
city_encoded = encoder.fit_transform(df[['city']])

# Drops baseline column 'city_Isfahan'!
# Isfahan is implicitly represented as [0, 0] (Shiraz=0, Tehran=0)
# Guarantees full column rank in design matrix (X^T X)^(-1)`
  }
})

// --- Methods ---------------------------------------------------------------
const emitInspection = () => {
  emit('inspect', {
    title: encodingMode.value === 'ordinal_education'
      ? 'OrdinalEncoder: Ordered Hierarchy'
      : `OneHotEncoder(drop=${dropFirst.value ? "'first'" : 'None'})`,
    details: {
      'Target Feature': encodingMode.value === 'ordinal_education' ? 'education (Ordinal)' : 'city (Nominal)',
      'Encoding Pattern': encodingMode.value === 'ordinal_education'
        ? 'Discrete Rank Ladder [0, 1, 2, 3]'
        : 'Orthogonal Binary Vector Basis',
      'Transformed Matrix': encodingMode.value === 'ordinal_education' ? '(5, 1)' : (dropFirst.value ? '(5, 2)' : '(5, 3)'),
      'Matrix Sparsity': sparsityStats.value.sparsityPct,
      'Dummy Variable Trap': encodingMode.value === 'onehot_city'
        ? (dropFirst.value ? 'Resolved (drop="first", Full Rank)' : 'Active (Multicollinear with Intercept)')
        : 'N/A',
      'Selected Record': selectedRowId.value !== null
        ? `Row #${selectedRowId.value} (${sourceRows[selectedRowId.value].name}: edu=${sourceRows[selectedRowId.value].education}, city=${sourceRows[selectedRowId.value].city})`
        : 'None (Click row to inspect)'
    }
  })
}

const selectRow = (id: number) => {
  selectedRowId.value = id
  emitInspection()
}

const setMode = (m: EncodingMode) => {
  encodingMode.value = m
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
      <!-- Strategy Selector -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">Strategy:</span>
        <button
          type="button"
          @click="setMode('ordinal_education')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="encodingMode === 'ordinal_education' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          OrdinalEncoder ('education')
        </button>
        <button
          type="button"
          @click="setMode('onehot_city'); dropFirst = false; emitInspection()"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="encodingMode === 'onehot_city' && !dropFirst ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          OneHotEncoder ('city', drop=None)
        </button>

        <span class="text-line mx-1">|</span>

        <!-- Dummy Variable Trap Toggle -->
        <button
          type="button"
          @click="encodingMode = 'onehot_city'; dropFirst = !dropFirst; emitInspection()"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="encodingMode === 'onehot_city' && dropFirst ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500 font-bold' : 'bg-card border-line text-muted hover:text-ink'"
          title="Toggle drop='first' to eliminate multicollinearity"
        >
          <AlertTriangle class="w-3.5 h-3.5" :class="dropFirst ? 'text-amber-600' : 'text-muted'" />
          <span>The Dummy Variable Trap (drop='first')</span>
        </button>
      </div>

      <!-- Matrix Shape & Sparsity Pills -->
      <div class="flex items-center gap-2 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <Grid class="w-3.5 h-3.5 text-brand-blue" />
        <span class="font-bold text-ink">Shape:</span>
        <span class="font-mono text-brand-blue font-bold">{{ sparsityStats.matrixShape }}</span>
        <span class="text-line">|</span>
        <span class="text-muted text-[11px]">Sparsity:</span>
        <span class="font-mono text-amber-600 dark:text-amber-400 font-semibold">{{ sparsityStats.sparsityPct }}</span>
      </div>
    </div>

    <!-- Dual-View Split: Left Source Table + Right Transformed Vector Table -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-3 items-start">
      <!-- Left Panel: Raw Source Table (5 cols on lg) -->
      <div class="lg:col-span-5 flex flex-col gap-2">
        <div class="rounded-lg border border-line bg-card shadow-xs overflow-hidden">
          <div class="px-3 py-2 border-b border-line bg-card-subtle flex items-center justify-between text-xs font-mono">
            <span class="font-bold text-ink flex items-center gap-1.5">
              <Database class="w-3.5 h-3.5 text-brand-blue" />
              df[['education', 'city']] (Source)
            </span>
            <span class="text-[11px] text-muted">5 rows × 2 cols</span>
          </div>

          <div class="overflow-x-auto">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr class="border-b border-line text-muted font-mono text-[11px] text-left">
                  <th class="py-1.5 px-3 font-semibold w-10 text-center">#</th>
                  <th
                    class="py-1.5 px-3 font-semibold transition-colors"
                    :class="encodingMode === 'ordinal_education' ? 'text-brand-blue font-bold bg-brand-blue/5' : ''"
                  >
                    education (Ordinal)
                  </th>
                  <th
                    class="py-1.5 px-3 font-semibold transition-colors"
                    :class="encodingMode === 'onehot_city' ? 'text-emerald-600 font-bold bg-emerald-500/5' : ''"
                  >
                    city (Nominal)
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-line/60 font-mono">
                <tr
                  v-for="row in sourceRows"
                  :key="row.id"
                  @click="selectRow(row.id)"
                  class="cursor-pointer transition-colors"
                  :class="selectedRowId === row.id ? 'bg-brand-blue/10 dark:bg-brand-blue/20 font-bold' : 'hover:bg-card-subtle'"
                >
                  <td class="py-1 px-3 text-center text-muted text-[11px]">{{ row.id }}</td>
                  <td
                    class="py-1 px-3 text-ink"
                    :class="encodingMode === 'ordinal_education' ? 'bg-brand-blue/5 font-semibold text-brand-blue' : ''"
                  >
                    {{ row.education }}
                  </td>
                  <td
                    class="py-1 px-3 text-ink"
                    :class="encodingMode === 'onehot_city' ? 'bg-emerald-500/5 font-semibold text-emerald-700 dark:text-emerald-300' : ''"
                  >
                    {{ row.city }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="px-3 py-1.5 border-t border-line bg-card-subtle text-[10px] font-mono text-muted flex items-center justify-between">
            <span>education: 4 ranks</span>
            <span>city: 3 classes (Isfahan, Shiraz, Tehran)</span>
          </div>
        </div>

        <!-- Strategy Description Annotation Card -->
        <div class="rounded-lg border border-line bg-card p-3 shadow-xs font-mono text-xs space-y-2">
          <div class="flex items-center gap-1.5 font-bold text-ink border-b border-line/60 pb-1.5">
            <Info class="w-3.5 h-3.5 text-brand-blue" />
            <span>Mathematical Invariant Rule</span>
          </div>

          <div v-if="encodingMode === 'ordinal_education'" class="space-y-1 text-[11px] leading-relaxed text-muted">
            <p class="text-ink font-semibold">
              ✓ <span class="text-brand-blue">Valid:</span> An inherent mathematical hierarchy exists across degrees:
            </p>
            <div class="flex items-center gap-1.5 text-[10px] bg-card-subtle p-2 rounded border border-line/40">
              <span class="px-1.5 py-0.5 rounded bg-line text-ink">HighSchool (0)</span>
              <span>&lt;</span>
              <span class="px-1.5 py-0.5 rounded bg-line text-ink">Bachelor (1)</span>
              <span>&lt;</span>
              <span class="px-1.5 py-0.5 rounded bg-line text-ink">Master (2)</span>
              <span>&lt;</span>
              <span class="px-1.5 py-0.5 rounded bg-line text-ink">PhD (3)</span>
            </div>
            <p class="text-[10px] text-muted">
              Numerical distance conveys meaningful educational progression without adding dimensions.
            </p>
          </div>

          <div v-else class="space-y-1 text-[11px] leading-relaxed text-muted">
            <p class="text-ink font-semibold">
              ⚠ <span class="text-amber-600 dark:text-amber-400">Nominal Variable:</span>
              Cities have no natural mathematical ordering.
            </p>
            <p class="text-[10px]">
              Assigning integers (Tehran=0, Shiraz=1, Isfahan=2) would falsely imply that <span class="font-bold text-ink">Isfahan = Shiraz × 2</span> or that Shiraz is closer to Tehran than Isfahan!
            </p>
            <p class="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold">
              → One-Hot expands cities into mutually orthogonal coordinate basis vectors.
            </p>
          </div>
        </div>
      </div>

      <!-- Right Panel: Transformed Numerical Feature Matrix (7 cols on lg) -->
      <div class="lg:col-span-7 flex flex-col gap-2">
        <div class="rounded-lg border border-line bg-card shadow-xs overflow-hidden">
          <div class="px-3 py-2 border-b border-line bg-card-subtle flex items-center justify-between text-xs font-mono">
            <span class="font-bold text-ink flex items-center gap-1.5">
              <Grid class="w-3.5 h-3.5 text-emerald-600" />
              Transformed Numerical Feature Matrix X
            </span>
            <span class="text-[11px] font-bold text-brand-blue">{{ sparsityStats.matrixShape }}</span>
          </div>

          <!-- 1. Ordinal Mode Output Table -->
          <div v-if="encodingMode === 'ordinal_education'" class="overflow-x-auto">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr class="border-b border-line text-muted font-mono text-[11px] text-left">
                  <th class="py-1.5 px-3 font-semibold w-10 text-center">#</th>
                  <th class="py-1.5 px-3 font-semibold">Source Feature</th>
                  <th class="py-1.5 px-3 font-semibold text-right text-brand-blue">education_encoded (int64)</th>
                  <th class="py-1.5 px-3 font-semibold text-center">Hierarchy Rank</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-line/60 font-mono">
                <tr
                  v-for="row in sourceRows"
                  :key="row.id"
                  @click="selectRow(row.id)"
                  class="cursor-pointer transition-colors"
                  :class="selectedRowId === row.id ? 'bg-brand-blue/10 dark:bg-brand-blue/20 font-bold' : 'hover:bg-card-subtle'"
                >
                  <td class="py-1.5 px-3 text-center text-muted text-[11px]">{{ row.id }}</td>
                  <td class="py-1.5 px-3 text-ink">{{ row.education }}</td>
                  <td class="py-1.5 px-3 text-right font-bold text-brand-blue text-sm">
                    {{ ordinalMap[row.education] }}
                  </td>
                  <td class="py-1.5 px-3 text-center">
                    <span class="px-2 py-0.5 rounded text-[10px] bg-brand-blue/10 text-brand-blue border border-brand-blue/20">
                      Rank {{ ordinalMap[row.education] }} of 3
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 2. One-Hot Mode Output Table -->
          <div v-else class="overflow-x-auto">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr class="border-b border-line text-muted font-mono text-[11px] text-left">
                  <th class="py-1.5 px-3 font-semibold w-10 text-center">#</th>
                  <th class="py-1.5 px-3 font-semibold">City</th>

                  <!-- Baseline Column: Isfahan (faded when drop='first') -->
                  <th
                    class="py-1.5 px-3 font-semibold text-center transition-all duration-300"
                    :class="[
                      dropFirst ? 'opacity-30 line-through bg-card-subtle' : 'text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/10'
                    ]"
                  >
                    city_Isfahan {{ dropFirst ? '(DROPPED)' : '' }}
                  </th>

                  <!-- Shiraz Column -->
                  <th class="py-1.5 px-3 font-semibold text-center text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/10">
                    city_Shiraz
                  </th>

                  <!-- Tehran Column -->
                  <th class="py-1.5 px-3 font-semibold text-center text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/10">
                    city_Tehran
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-line/60 font-mono">
                <tr
                  v-for="row in oneHotRows"
                  :key="row.id"
                  @click="selectRow(row.id)"
                  class="cursor-pointer transition-colors"
                  :class="selectedRowId === row.id ? 'bg-emerald-500/10 font-bold' : 'hover:bg-card-subtle'"
                >
                  <td class="py-1.5 px-3 text-center text-muted text-[11px]">{{ row.id }}</td>
                  <td class="py-1.5 px-3 text-ink">{{ row.city }}</td>

                  <!-- Isfahan Cell -->
                  <td
                    class="py-1.5 px-3 text-center transition-all duration-300"
                    :class="[
                      dropFirst ? 'opacity-20 line-through bg-card-subtle text-muted' : (row.city_Isfahan === 1 ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-sm' : 'text-muted/60')
                    ]"
                  >
                    {{ row.city_Isfahan }}
                  </td>

                  <!-- Shiraz Cell -->
                  <td
                    class="py-1.5 px-3 text-center"
                    :class="row.city_Shiraz === 1 ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-sm' : 'text-muted/60'"
                  >
                    {{ row.city_Shiraz }}
                  </td>

                  <!-- Tehran Cell -->
                  <td
                    class="py-1.5 px-3 text-center"
                    :class="row.city_Tehran === 1 ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-sm' : 'text-muted/60'"
                  >
                    {{ row.city_Tehran }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="px-3 py-1.5 border-t border-line bg-card-subtle text-[10px] font-mono text-muted flex items-center justify-between">
            <span v-if="encodingMode === 'onehot_city'">
              Active Bits: <span class="text-emerald-600 font-bold">1</span> (active category) vs <span class="text-muted">0</span> (inactive)
            </span>
            <span v-else>
              Discrete ladder: 0, 1, 2, 3
            </span>
            <span v-if="dropFirst" class="text-amber-600 dark:text-amber-400 font-bold">
              Baseline 'Isfahan' encoded as [0, 0]!
            </span>
          </div>
        </div>

        <!-- The Dummy Variable Trap Callout Banner -->
        <div
          v-if="encodingMode === 'onehot_city' && !dropFirst"
          class="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 shadow-xs font-mono text-xs space-y-1.5"
        >
          <div class="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
            <AlertTriangle class="w-4 h-4 text-amber-600 shrink-0" />
            <span>The Dummy Variable Trap (Multicollinearity Hazard)</span>
          </div>
          <p class="text-amber-900/90 dark:text-amber-200/90 text-[11px] leading-relaxed">
            Notice that for every row:
            <span class="font-bold underline">city_Isfahan + city_Shiraz + city_Tehran = 1</span>.
            In any linear regression with a bias/intercept term ($\beta_0$), this column sum is an exact linear combination of the intercept column ($1$).
            The design matrix $X$ becomes singular, causing $\det(X^T X) = 0$ (matrix inversion failure)!
          </p>
          <div class="pt-1">
            <button
              type="button"
              @click="dropFirst = true; emitInspection()"
              class="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shadow-2xs transition-colors cursor-pointer"
            >
              <span>Fix with drop='first'</span>
              <ArrowRight class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div
          v-else-if="encodingMode === 'onehot_city' && dropFirst"
          class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 shadow-xs font-mono text-xs space-y-1"
        >
          <div class="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 class="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Dummy Variable Trap Eliminated: K - 1 Columns (Full Rank)</span>
          </div>
          <p class="text-emerald-900/90 dark:text-emerald-200/90 text-[11px] leading-relaxed">
            By dropping the baseline column (<span class="font-semibold">'city_Isfahan'</span>), $K - 1 = 2$ columns represent 3 cities perfectly without multicollinearity.
            When both Shiraz and Tehran are $0$, the model knows with 100% certainty that the sample is Isfahan!
          </p>
        </div>

        <!-- Python Code Implementation Box -->
        <div class="rounded-lg border border-line bg-card p-3 shadow-xs text-xs font-mono space-y-1.5">
          <div class="flex items-center justify-between text-muted text-[10px] uppercase font-bold tracking-wider">
            <span class="flex items-center gap-1">
              <Code2 class="w-3 h-3" />
              Scikit-Learn Execution
            </span>
          </div>
          <pre class="text-[11px] text-ink overflow-x-auto whitespace-pre-wrap">{{ activeCodeSnippet }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dataframe {
  border-collapse: collapse;
}
.dataframe th,
.dataframe td {
  border-bottom: 1px solid var(--color-line, #e5e7eb);
}
</style>

