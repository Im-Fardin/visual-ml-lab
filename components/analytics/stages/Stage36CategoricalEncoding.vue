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
  Code2
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Data Models -----------------------------------------------------------
interface CustomerRecord {
  id: number
  client: string
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
  city: 'London' | 'Paris' | 'Tokyo'
}

const sourceRows: CustomerRecord[] = [
  { id: 0, client: 'Acme Corp', tier: 'Bronze', city: 'Paris' },
  { id: 1, client: 'Globex Ltd', tier: 'Silver', city: 'Tokyo' },
  { id: 2, client: 'Initech', tier: 'Gold', city: 'London' },
  { id: 3, client: 'Umbrella Inc', tier: 'Silver', city: 'Paris' },
  { id: 4, client: 'Stark Ind', tier: 'Platinum', city: 'Tokyo' }
]

// --- State -----------------------------------------------------------------
type EncodingMode = 'ordinal_tier' | 'onehot_city'
const encodingMode = ref<EncodingMode>('onehot_city')

// Dummy variable trap toggle for OneHot
const dropFirst = ref<boolean>(false)

// Selected row for inspection
const selectedRowId = ref<number | null>(null)

// --- Computeds -------------------------------------------------------------
const ordinalMap: Record<string, number> = {
  Bronze: 0,
  Silver: 1,
  Gold: 2,
  Platinum: 3
}

// Sparsity calculation
const sparsityStats = computed(() => {
  if (encodingMode.value === 'ordinal_tier') {
    return {
      totalCells: 5,
      zeroCells: sourceRows.filter(r => r.tier === 'Bronze').length, // 0 is encoded as 0
      sparsityPct: '20.0%',
      matrixShape: '(5, 1)',
      redundancy: 'None (Monotonic scalar)'
    }
  } else {
    const colCount = dropFirst.value ? 2 : 3
    const totalCells = 5 * colCount
    // Each row has exactly one '1' (or 0 ones if dropped baseline London is present)
    let zeroCells = 0
    sourceRows.forEach(r => {
      if (dropFirst.value) {
        // columns: Paris, Tokyo. London is [0, 0]
        if (r.city === 'London') zeroCells += 2
        else zeroCells += 1
      } else {
        // columns: London, Paris, Tokyo. Exactly 2 zeros per row
        zeroCells += 2
      }
    })

    const pct = ((zeroCells / totalCells) * 100).toFixed(1)
    return {
      totalCells,
      zeroCells,
      sparsityPct: `${pct}%`,
      matrixShape: `(5, ${colCount})`,
      redundancy: dropFirst.value ? 'Zero Multicollinearity (Full Rank)' : '1 Redundant Degree of Freedom (Collinear with intercept)'
    }
  }
})

const activeCodeSnippet = computed(() => {
  if (encodingMode.value === 'ordinal_tier') {
    return `# 1. Ordinal Encoding: For data with intrinsic mathematical hierarchy
from sklearn.preprocessing import OrdinalEncoder

tier_categories = [['Bronze', 'Silver', 'Gold', 'Platinum']]
encoder = OrdinalEncoder(categories=tier_categories)
df['tier_encoded'] = encoder.fit_transform(df[['tier']])
# Bronze -> 0, Silver -> 1, Gold -> 2, Platinum -> 3
# Note: Platinum (3) > Gold (2) is mathematically valid and preserved.`
  } else if (!dropFirst.value) {
    return `# 2. One-Hot Encoding (drop=None): Expands K categories to K columns
from sklearn.preprocessing import OneHotEncoder

encoder = OneHotEncoder(sparse_output=False, drop=None)
city_encoded = encoder.fit_transform(df[['city']])
# Creates 3 orthogonal binary vectors: London, Paris, Tokyo
# Shape: (5, 3) | Warning: Prone to Dummy Variable Trap in linear regression!`
  } else {
    return `# 3. One-Hot Encoding (drop='first'): Resolves Dummy Variable Trap
from sklearn.preprocessing import OneHotEncoder

encoder = OneHotEncoder(sparse_output=False, drop='first')
city_encoded = encoder.fit_transform(df[['city']])
# Drops 'city_London' baseline column!
# city_London = 1 - (city_Paris + city_Tokyo)
# Prevents singular matrix invertibility errors in OLS (X^T X)^-1`
  }
})

// --- Methods ---------------------------------------------------------------
const emitInspection = () => {
  emit('inspect', {
    title: encodingMode.value === 'ordinal_tier' ? 'OrdinalEncoder: Ordered Hierarchy' : `OneHotEncoder(drop=${dropFirst.value ? "'first'" : 'None'})`,
    details: {
      'Target Feature': encodingMode.value === 'ordinal_tier' ? 'tier (Ordinal)' : 'city (Nominal)',
      'Encoding Pattern': encodingMode.value === 'ordinal_tier' ? 'Discrete Rank Ladder [0, 1, 2, 3]' : 'Orthogonal Binary Vector Basis',
      'Matrix Dimension': sparsityStats.value.matrixShape,
      'Matrix Sparsity': sparsityStats.value.sparsityPct,
      'Dummy Variable Trap': encodingMode.value === 'onehot_city' ? (dropFirst.value ? 'Resolved (drop="first")' : 'Active (Multicollinear with intercept)') : 'N/A',
      'Selected Record': selectedRowId.value !== null ? `Row #${selectedRowId.value} (${sourceRows[selectedRowId.value].client})` : 'None'
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
      <!-- Encoding Method Switcher -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">Strategy:</span>
        <button
          type="button"
          @click="setMode('ordinal_tier')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="encodingMode === 'ordinal_tier' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          OrdinalEncoder ('tier')
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
          title="Toggle drop='first' to prevent multicollinearity"
        >
          <AlertTriangle class="w-3.5 h-3.5" :class="dropFirst ? 'text-amber-600' : 'text-muted'" />
          <span>drop='first' (Trap Fix)</span>
        </button>
      </div>

      <!-- Sparsity & Dimensions Badge -->
      <div class="flex items-center gap-2 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <Grid class="w-3.5 h-3.5 text-brand-blue" />
        <span class="font-bold text-ink">Matrix:</span>
        <span class="font-mono text-brand-blue font-bold">{{ sparsityStats.matrixShape }}</span>
        <span class="text-muted text-[11px]">• Sparsity: {{ sparsityStats.sparsityPct }}</span>
      </div>
    </div>

    <!-- Main Dual-View Studio Arena -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- LEFT 6 COLS: Authentic Jupyter DataFrame Table -->
        <div class="lg:col-span-6 flex flex-col gap-3">
          <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1.5">
            <span class="flex items-center gap-1.5">
              <Database class="w-4 h-4 text-brand-blue" />
              <span>Transformed Preprocessing DataFrame</span>
            </span>
            <span class="text-[11px] font-normal text-muted">
              {{ encodingMode === 'ordinal_tier' ? "1 Column (int8 ranks)" : (dropFirst ? "2 Columns (K-1 One-Hot)" : "3 Columns (K One-Hot)") }}
            </span>
          </div>

          <!-- Tabular Table -->
          <div class="overflow-x-auto w-full">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-8 text-center text-muted">#</th>
                  <th class="text-left font-bold text-ink">client</th>

                  <!-- ORDINAL VIEW HEADERS -->
                  <template v-if="encodingMode === 'ordinal_tier'">
                    <th class="text-left font-bold text-muted">raw_tier</th>
                    <th class="text-right font-bold text-brand-blue">tier_rank</th>
                  </template>

                  <!-- ONE-HOT VIEW HEADERS -->
                  <template v-else>
                    <th class="text-left font-bold text-muted">raw_city</th>

                    <!-- Baseline Column (Dropped if dropFirst=true) -->
                    <th
                      class="text-center font-bold transition-all"
                      :class="dropFirst ? 'opacity-30 line-through text-muted bg-amber-500/10' : 'text-emerald-600 dark:text-emerald-400 font-bold'"
                    >
                      city_London
                    </th>
                    <th class="text-center font-bold text-emerald-600 dark:text-emerald-400">city_Paris</th>
                    <th class="text-center font-bold text-emerald-600 dark:text-emerald-400">city_Tokyo</th>
                  </template>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in sourceRows"
                  :key="row.id"
                  @click="selectRow(row.id)"
                  class="cursor-pointer transition-colors"
                  :class="selectedRowId === row.id ? 'bg-brand-blue/15 font-bold' : 'hover:bg-card-subtle'"
                >
                  <td class="text-center font-mono text-[11px] text-muted">{{ row.id }}</td>
                  <td class="font-mono text-ink py-1 font-semibold">{{ row.client }}</td>

                  <!-- ORDINAL COLUMNS -->
                  <template v-if="encodingMode === 'ordinal_tier'">
                    <td class="font-mono text-muted">{{ row.tier }}</td>
                    <td class="font-mono text-right font-bold text-brand-blue">
                      <span class="px-2 py-0.5 rounded bg-brand-blue/15 text-brand-blue font-bold">
                        {{ ordinalMap[row.tier] }}
                      </span>
                    </td>
                  </template>

                  <!-- ONE-HOT COLUMNS -->
                  <template v-else>
                    <td class="font-mono text-muted">{{ row.city }}</td>

                    <!-- city_London -->
                    <td
                      class="text-center font-mono py-1 transition-opacity"
                      :class="dropFirst ? 'opacity-30 line-through' : ''"
                    >
                      <span
                        class="px-1.5 py-0.5 rounded text-[10px] font-bold"
                        :class="row.city === 'London' ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300' : 'text-muted'"
                      >
                        {{ row.city === 'London' ? 1 : 0 }}
                      </span>
                    </td>

                    <!-- city_Paris -->
                    <td class="text-center font-mono py-1">
                      <span
                        class="px-1.5 py-0.5 rounded text-[10px] font-bold"
                        :class="row.city === 'Paris' ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300' : 'text-muted'"
                      >
                        {{ row.city === 'Paris' ? 1 : 0 }}
                      </span>
                    </td>

                    <!-- city_Tokyo -->
                    <td class="text-center font-mono py-1">
                      <span
                        class="px-1.5 py-0.5 rounded text-[10px] font-bold"
                        :class="row.city === 'Tokyo' ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300' : 'text-muted'"
                      >
                        {{ row.city === 'Tokyo' ? 1 : 0 }}
                      </span>
                    </td>
                  </template>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Bottom Summary Indicator -->
          <div class="p-2.5 rounded border border-line bg-card-subtle text-[11px] font-mono text-muted flex items-center justify-between">
            <span>Encoding: <strong class="text-ink">{{ encodingMode === 'ordinal_tier' ? 'Ordinal Rank' : (dropFirst ? "One-Hot (K-1 Columns)" : "One-Hot (K Columns)") }}</strong></span>
            <span>Multicollinearity: <strong :class="dropFirst || encodingMode === 'ordinal_tier' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'">{{ dropFirst || encodingMode === 'ordinal_tier' ? 'None (Full Rank)' : 'Singular / Trap Active' }}</strong></span>
          </div>
        </div>

        <!-- RIGHT 6 COLS: Vector Space & Orthogonal Basis Geometry -->
        <div class="lg:col-span-6 flex flex-col gap-3">
          <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1.5">
            <span class="flex items-center gap-1.5">
              <Compass class="w-4 h-4 text-emerald-500" />
              <span>Geometric Vector Representation</span>
            </span>
            <span class="text-[11px] font-normal text-muted">
              {{ encodingMode === 'ordinal_tier' ? '1D Scalar Continuum' : '3D Orthogonal Basis Vectors' }}
            </span>
          </div>

          <!-- ORDINAL VIEW: Scalar Rank Ladder -->
          <div v-if="encodingMode === 'ordinal_tier'" class="flex flex-col gap-3">
            <div class="rounded-md border border-brand-blue/30 bg-brand-blue/10 p-3 flex flex-col gap-2">
              <div class="text-xs font-mono font-bold text-ink flex items-center gap-1.5">
                <CheckCircle2 class="w-3.5 h-3.5 text-brand-blue" />
                <span>The Mathematical Meaning of Ordinal Ranks</span>
              </div>
              <p class="text-[11px] font-mono text-muted leading-relaxed">
                Ordinal encoding transforms strings into discrete scalar values: <code>Bronze (0) &lt; Silver (1) &lt; Gold (2) &lt; Platinum (3)</code>.
                This allows machine learning models (decision trees, linear models) to exploit the <strong>monotonic relationship</strong>.
              </p>
            </div>

            <!-- 1D Scalar Rank Ladder Visualizer -->
            <div class="rounded-md border border-line bg-card p-4 flex flex-col gap-3">
              <div class="text-[11px] font-mono font-bold text-ink">1D Scalar Ladder:</div>
              <div class="grid grid-cols-4 gap-2 text-center font-mono">
                <div class="p-2 rounded bg-card-subtle border border-line">
                  <div class="text-xs font-bold text-ink">Bronze</div>
                  <div class="text-sm font-bold text-brand-blue mt-1">0</div>
                  <div class="text-[10px] text-muted mt-0.5">Base Rank</div>
                </div>
                <div class="p-2 rounded bg-card-subtle border border-line">
                  <div class="text-xs font-bold text-ink">Silver</div>
                  <div class="text-sm font-bold text-brand-blue mt-1">1</div>
                  <div class="text-[10px] text-muted mt-0.5">+1 Step</div>
                </div>
                <div class="p-2 rounded bg-card-subtle border border-line">
                  <div class="text-xs font-bold text-ink">Gold</div>
                  <div class="text-sm font-bold text-brand-blue mt-1">2</div>
                  <div class="text-[10px] text-muted mt-0.5">+2 Steps</div>
                </div>
                <div class="p-2 rounded bg-card-subtle border border-line">
                  <div class="text-xs font-bold text-ink">Platinum</div>
                  <div class="text-sm font-bold text-brand-blue mt-1">3</div>
                  <div class="text-[10px] text-muted mt-0.5">+3 Steps</div>
                </div>
              </div>

              <!-- Warning Callout on Arbitrary Distance -->
              <div class="p-2 rounded bg-amber-500/10 border border-amber-500/30 text-xs font-mono text-amber-900 dark:text-amber-200">
                <strong>Crucial Caveat:</strong> Ordinal encoding implies equal spacing: $(1 - 0) = (2 - 1) = (3 - 2) = 1$. If Gold is actually worth 5x more than Silver, the encoder creates an imperfect linear approximation.
              </div>
            </div>
          </div>

          <!-- ONE-HOT VIEW: Orthogonal Basis Vector Geometry & Dummy Trap -->
          <div v-else class="flex flex-col gap-3">
            <!-- Dummy Variable Trap Alert when dropFirst = false -->
            <div
              v-if="!dropFirst"
              class="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 flex flex-col gap-1.5 text-xs font-mono text-amber-900 dark:text-amber-200"
            >
              <div class="font-bold flex items-center gap-1.5">
                <AlertTriangle class="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>The Dummy Variable Trap (Perfect Multicollinearity)</span>
              </div>
              <p class="text-[11px] leading-relaxed">
                Because every client has exactly one city, the 3 columns sum to 1:
                <code>city_London + city_Paris + city_Tokyo = 1</code>.
                In any linear regression with a constant intercept $w_0$, the columns are linearly dependent, causing the design matrix $X^T X$ to be <strong>singular and non-invertible</strong>!
              </p>
            </div>

            <!-- Fixed Trap Alert when dropFirst = true -->
            <div
              v-else
              class="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 flex flex-col gap-1.5 text-xs font-mono text-emerald-900 dark:text-emerald-200"
            >
              <div class="font-bold flex items-center gap-1.5">
                <CheckCircle2 class="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Baseline Dropped: System is Full Rank</span>
              </div>
              <p class="text-[11px] leading-relaxed">
                By dropping <code>city_London</code>, London becomes the implicit reference baseline ($[0, 0]$).
                The equation $\text{city\_London} = 1 - (\text{city\_Paris} + \text{city\_Tokyo})$ allows the model's intercept $w_0$ to absorb London's baseline effect cleanly.
              </p>
            </div>

            <!-- Orthogonal 3D Basis Geometry SVG -->
            <div class="rounded-md border border-line bg-card p-3 flex flex-col items-center">
              <svg viewBox="0 0 320 160" class="w-full max-w-[300px] h-auto overflow-visible select-none">
                <!-- Origin (0,0,0) -->
                <!-- X axis: London (e1) -->
                <line x1="160" y1="120" x2="260" y2="120" stroke="#f59e0b" stroke-width="2.5" />
                <polygon points="260,116 268,120 260,124" fill="#f59e0b" />
                <text x="272" y="124" class="text-[10px] font-mono font-bold fill-current text-amber-600 dark:text-amber-400">
                  London [1,0,0]
                </text>

                <!-- Y axis: Paris (e2) -->
                <line x1="160" y1="120" x2="160" y2="30" stroke="#10b981" stroke-width="2.5" />
                <polygon points="156,30 160,22 164,30" fill="#10b981" />
                <text x="160" y="16" text-anchor="middle" class="text-[10px] font-mono font-bold fill-current text-emerald-600 dark:text-emerald-400">
                  Paris [0,1,0]
                </text>

                <!-- Z axis: Tokyo (e3) -->
                <line x1="160" y1="120" x2="80" y2="155" stroke="#3b82f6" stroke-width="2.5" />
                <polygon points="80,150 72,158 84,158" fill="#3b82f6" />
                <text x="50" y="158" class="text-[10px] font-mono font-bold fill-current text-brand-blue">
                  Tokyo [0,0,1]
                </text>

                <!-- Right-angle markers showing 90-degree orthogonality -->
                <rect x="160" y="105" width="15" height="15" fill="none" stroke="currentColor" class="text-muted/50" />
                <circle cx="160" cy="120" r="3.5" fill="#1e293b" />
              </svg>

              <!-- Invariant metric strip -->
              <div class="mt-1 pt-1.5 border-t border-line/60 w-full flex items-center justify-between text-[10px] font-mono text-muted">
                <span>Angle: <strong>θ = 90° (Orthogonal)</strong></span>
                <span>Dot Product: <strong>v₁ · v₂ = 0</strong></span>
                <span>Euclidean Dist: <strong>√2 ≈ 1.414</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Interactive Invariant & Summary Strip -->
      <div class="mt-6 pt-3 border-t border-line flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="setMode(encodingMode === 'ordinal_tier' ? 'onehot_city' : 'ordinal_tier')"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-blue text-white text-xs font-mono font-medium hover:bg-brand-blue/90 shadow-2xs cursor-pointer"
          >
            <Sparkles class="w-3.5 h-3.5" />
            <span>Switch to {{ encodingMode === 'ordinal_tier' ? "OneHotEncoder ('city')" : "OrdinalEncoder ('tier')" }}</span>
          </button>

          <button
            v-if="encodingMode === 'onehot_city'"
            type="button"
            @click="dropFirst = !dropFirst; emitInspection()"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card text-xs font-mono text-ink hover:bg-card-subtle shadow-2xs cursor-pointer"
          >
            <span>Toggle drop='first' ({{ dropFirst }})</span>
          </button>
        </div>

        <div class="text-xs font-mono text-muted">
          <span>Encoding Rule: </span>
          <strong class="text-ink">Never use Ordinal on nominal data (Paris &lt; Tokyo is false)</strong>
        </div>
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active Scikit-Learn Preprocessing Pipeline:</span>
        <span class="text-brand-blue font-semibold">sklearn.preprocessing.{{ encodingMode === 'ordinal_tier' ? 'OrdinalEncoder' : 'OneHotEncoder' }}</span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ activeCodeSnippet }}</code></pre>
    </div>
  </div>
</template>

