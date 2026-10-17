<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  ShieldCheck,
  ShieldAlert,
  Flame,
  Split,
  Layers,
  ArrowRight,
  Sparkles,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Sliders,
  Cpu
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Data Models -----------------------------------------------------------
interface TransactionRecord {
  id: number
  userId: string
  amount: number
  isFraud: boolean // Target y
}

const fullDataset: TransactionRecord[] = [
  // 7 Legitimate (Blue)
  { id: 0, userId: 'U-101', amount: 45, isFraud: false },
  { id: 1, userId: 'U-102', amount: 120, isFraud: false },
  { id: 2, userId: 'U-103', amount: 80, isFraud: false },
  { id: 3, userId: 'U-104', amount: 210, isFraud: false },
  { id: 4, userId: 'U-105', amount: 65, isFraud: false },
  { id: 5, userId: 'U-106', amount: 140, isFraud: false },
  { id: 6, userId: 'U-107', amount: 95, isFraud: false },
  // 3 Fraudulent (Red) with massive amounts
  { id: 7, userId: 'U-901', amount: 4800, isFraud: true },
  { id: 8, userId: 'U-902', amount: 5200, isFraud: true },
  { id: 9, userId: 'U-903', amount: 3900, isFraud: true }
]

// --- State -----------------------------------------------------------------
type SplitStrategy = 'random_bad' | 'stratified'
const splitStrategy = ref<SplitStrategy>('stratified')

type LeakageMode = 'leakage' | 'firewall'
const leakageMode = ref<LeakageMode>('firewall')

// Selected transaction
const selectedTxId = ref<number | null>(null)

// --- Computeds -------------------------------------------------------------
// Split indices
// Total 10 records: 80% Train (8 records) / 20% Test (2 records)
const partitionIndices = computed(() => {
  if (splitStrategy.value === 'stratified') {
    // Exactly 30% fraud in train and test:
    // Train: 6 Legitimate + 2 Fraud (IDs: 0, 1, 2, 3, 4, 5 and 7, 8)
    // Test: 1 Legitimate + 1 Fraud (IDs: 6 and 9)
    return {
      trainIds: [0, 1, 2, 3, 4, 5, 7, 8],
      testIds: [6, 9]
    }
  } else {
    // Bad random split (unstratified): All 3 frauds end up in train! 0% fraud in test!
    // Train: 5 Legitimate + 3 Fraud (IDs: 0, 1, 2, 3, 4, 7, 8, 9)
    // Test: 2 Legitimate + 0 Fraud (IDs: 5, 6)
    return {
      trainIds: [0, 1, 2, 3, 4, 7, 8, 9],
      testIds: [5, 6]
    }
  }
})

const trainRecords = computed(() => {
  return fullDataset.filter(r => partitionIndices.value.trainIds.includes(r.id))
})

const testRecords = computed(() => {
  return fullDataset.filter(r => partitionIndices.value.testIds.includes(r.id))
})

// Fraud class balance statistics
const classBalanceStats = computed(() => {
  const trainFraudCount = trainRecords.value.filter(r => r.isFraud).length
  const trainFraudPct = ((trainFraudCount / trainRecords.value.length) * 100).toFixed(0)

  const testFraudCount = testRecords.value.filter(r => r.isFraud).length
  const testFraudPct = ((testFraudCount / testRecords.value.length) * 100).toFixed(0)

  return {
    trainFraudCount,
    trainTotal: trainRecords.value.length,
    trainFraudPct,
    testFraudCount,
    testTotal: testRecords.value.length,
    testFraudPct,
    isStratifiedSafe: trainFraudPct === '25' || trainFraudPct === '30' || (trainFraudCount >= 1 && testFraudCount >= 1)
  }
})

// Scaling Parameters under Leakage vs Firewall
const scalerParams = computed(() => {
  if (leakageMode.value === 'leakage') {
    // LEAKAGE SIN: Scaler was fit on the ENTIRE dataset (all 10 rows) before splitting!
    const allAmounts = fullDataset.map(r => r.amount)
    const mean = allAmounts.reduce((a, b) => a + b, 0) / allAmounts.length
    const variance = allAmounts.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / allAmounts.length
    const std = Math.sqrt(variance)

    return {
      fitTarget: 'Entire Dataset (Train + Test Leak)',
      mean: Number(mean.toFixed(1)),
      std: Number(std.toFixed(1)),
      isLeaked: true,
      statusMsg: 'CRITICAL LEAK: Test amounts ($3,900) influenced μ & σ'
    }
  } else {
    // FIREWALL: Scaler was fit ONLY on X_train (8 rows)
    const trainAmounts = trainRecords.value.map(r => r.amount)
    const mean = trainAmounts.reduce((a, b) => a + b, 0) / trainAmounts.length
    const variance = trainAmounts.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / trainAmounts.length
    const std = Math.sqrt(variance)

    return {
      fitTarget: 'X_train Only (Zero Test Knowledge)',
      mean: Number(mean.toFixed(1)),
      std: Number(std.toFixed(1)),
      isLeaked: false,
      statusMsg: 'CLEAN: Statistical Firewall locked test distribution'
    }
  }
})

const activeCodeSnippet = computed(() => {
  if (leakageMode.value === 'leakage') {
    return `# ❌ THE DATA LEAKAGE SIN: Preprocessing BEFORE train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

scaler = StandardScaler()
# FATAL ERROR: fit_transform on entire dataset (includes future test data!)
X_scaled = scaler.fit_transform(X) # μ=${scalerParams.value.mean}, σ=${scalerParams.value.std}

# Test data distribution has now contaminated training features!
X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2)`
  } else {
    const stratArg = splitStrategy.value === 'stratified' ? ', stratify=y' : ''
    return `# ✅ THE STATISTICAL FIREWALL: Split First, Fit ONLY on X_train
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# 1. Partition dataset FIRST with stratification
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2${stratArg}, random_state=42
)

# 2. Fit transformer EXCLUSIVELY on training data
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train) # μ_train=${scalerParams.value.mean}

# 3. Transform test data using frozen training parameters (Never call fit on test!)
X_test_scaled = scaler.transform(X_test)`
  }
})

// --- Methods ---------------------------------------------------------------
const emitInspection = () => {
  emit('inspect', {
    title: leakageMode.value === 'leakage' ? 'DATA LEAKAGE DETECTED' : 'CLEAN STATISTICAL FIREWALL',
    details: {
      'Pipeline Architecture': leakageMode.value === 'leakage' ? 'Fit Scaler BEFORE Split (Violation)' : 'Split First, Fit ONLY on Train (Isolated)',
      'Split Stratification': splitStrategy.value === 'stratified' ? 'stratify=y (Balanced class distribution)' : 'Random (Risk of zero test minority class)',
      'Train Partition': `${partitionIndices.value.trainIds.length} records (${classBalanceStats.value.trainFraudPct}% Fraud)`,
      'Test Partition': `${partitionIndices.value.testIds.length} records (${classBalanceStats.value.testFraudPct}% Fraud)`,
      'Fitted Mean (μ)': `\$${scalerParams.value.mean.toLocaleString()}`,
      'Fitted Std (σ)': `\$${scalerParams.value.std.toLocaleString()}`,
      'Firewall Status': leakageMode.value === 'leakage' ? 'BREACHED (Test stats contaminated train)' : 'ACTIVE (Zero information leakage)'
    }
  })
}

const setStrategy = (st: SplitStrategy) => {
  splitStrategy.value = st
  emitInspection()
}

const setLeakageMode = (m: LeakageMode) => {
  leakageMode.value = m
  emitInspection()
}

const selectTx = (id: number) => {
  selectedTxId.value = id
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
      <!-- Architecture Mode Switcher -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">Pipeline:</span>
        <button
          type="button"
          @click="setLeakageMode('firewall')"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="leakageMode === 'firewall' ? 'bg-emerald-600 text-white font-bold border-emerald-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <ShieldCheck class="w-3.5 h-3.5" />
          <span>Firewall (Split First)</span>
        </button>
        <button
          type="button"
          @click="setLeakageMode('leakage')"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="leakageMode === 'leakage' ? 'bg-rose-600 text-white font-bold border-rose-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          <Flame class="w-3.5 h-3.5" />
          <span>Data Leakage (Fit All)</span>
        </button>

        <span class="text-line mx-1">|</span>

        <!-- Stratification Toggle -->
        <span class="text-muted">Split:</span>
        <button
          type="button"
          @click="setStrategy('stratified')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="splitStrategy === 'stratified' ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          stratify=y (Balanced)
        </button>
        <button
          type="button"
          @click="setStrategy('random_bad')"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="splitStrategy === 'random_bad' ? 'bg-amber-600 text-white font-bold border-amber-600 shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          Random (Unstratified)
        </button>
      </div>

      <!-- Audit Badge -->
      <div
        class="flex items-center gap-2 px-3 py-1 rounded-md border font-mono text-xs shadow-2xs"
        :class="leakageMode === 'leakage' ? 'bg-rose-500/10 border-rose-500/40 text-rose-800 dark:text-rose-300' : 'bg-emerald-500/10 border-emerald-500/40 text-emerald-800 dark:text-emerald-300'"
      >
        <component :is="leakageMode === 'leakage' ? ShieldAlert : ShieldCheck" class="w-3.5 h-3.5" />
        <span class="font-bold">Audit:</span>
        <span>{{ leakageMode === 'leakage' ? 'LEAK DETECTED' : 'CLEAN / FIREWALLED' }}</span>
      </div>
    </div>

    <!-- Main Dual-View Studio Arena -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- LEFT 6 COLS: Train/Test Partitions Table -->
        <div class="lg:col-span-6 flex flex-col gap-3">
          <!-- TRAINING SET TABLE -->
          <div class="flex flex-col gap-1.5">
            <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1">
              <span class="flex items-center gap-1.5 text-brand-blue">
                <Layers class="w-3.5 h-3.5" />
                <span>Training Partition: X_train, y_train (80%)</span>
              </span>
              <span class="text-[11px] font-normal text-muted">
                {{ trainRecords.length }} rows • Fraud: {{ classBalanceStats.trainFraudCount }}/{{ trainRecords.length }} ({{ classBalanceStats.trainFraudPct }}%)
              </span>
            </div>

            <div class="overflow-x-auto w-full">
              <table class="dataframe w-full text-xs">
                <thead>
                  <tr>
                    <th class="w-6 text-center text-muted">#</th>
                    <th class="text-left font-bold text-ink">User</th>
                    <th class="text-right font-bold text-ink">Amount</th>
                    <th class="text-center font-bold text-ink">y (Class)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in trainRecords"
                    :key="row.id"
                    @click="selectTx(row.id)"
                    class="cursor-pointer transition-colors"
                    :class="selectedTxId === row.id ? 'bg-brand-blue/15 font-bold' : 'hover:bg-card-subtle'"
                  >
                    <td class="text-center font-mono text-[11px] text-muted">{{ row.id }}</td>
                    <td class="font-mono text-ink py-0.5">{{ row.userId }}</td>
                    <td class="font-mono text-right font-bold" :class="row.isFraud ? 'text-rose-600 dark:text-rose-400' : 'text-brand-blue'">
                      \${{ row.amount.toLocaleString() }}
                    </td>
                    <td class="text-center font-mono text-[10px]">
                      <span
                        class="px-1.5 py-0.2 rounded font-bold"
                        :class="row.isFraud ? 'bg-rose-500/20 text-rose-800 dark:text-rose-300' : 'bg-brand-blue/15 text-brand-blue'"
                      >
                        {{ row.isFraud ? 'Fraud (1)' : 'Legit (0)' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- TEST SET TABLE WITH FIREWALL HIGHLIGHT -->
          <div class="flex flex-col gap-1.5 pt-2 border-t border-line/60">
            <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1">
              <span class="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <Lock class="w-3.5 h-3.5" />
                <span>Test Partition: X_test, y_test (20%)</span>
              </span>
              <span class="text-[11px] font-normal text-muted">
                {{ testRecords.length }} rows • Fraud: {{ classBalanceStats.testFraudCount }}/{{ testRecords.length }} ({{ classBalanceStats.testFraudPct }}%)
              </span>
            </div>

            <div class="overflow-x-auto w-full">
              <table class="dataframe w-full text-xs">
                <thead>
                  <tr>
                    <th class="w-6 text-center text-muted">#</th>
                    <th class="text-left font-bold text-ink">User</th>
                    <th class="text-right font-bold text-ink">Amount</th>
                    <th class="text-center font-bold text-ink">y (Class)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in testRecords"
                    :key="row.id"
                    @click="selectTx(row.id)"
                    class="cursor-pointer transition-colors"
                    :class="selectedTxId === row.id ? 'bg-amber-500/15 font-bold' : 'hover:bg-card-subtle'"
                  >
                    <td class="text-center font-mono text-[11px] text-muted">{{ row.id }}</td>
                    <td class="font-mono text-ink py-0.5">{{ row.userId }}</td>
                    <td class="font-mono text-right font-bold" :class="row.isFraud ? 'text-rose-600 dark:text-rose-400' : 'text-brand-blue'">
                      \${{ row.amount.toLocaleString() }}
                    </td>
                    <td class="text-center font-mono text-[10px]">
                      <span
                        class="px-1.5 py-0.2 rounded font-bold"
                        :class="row.isFraud ? 'bg-rose-500/20 text-rose-800 dark:text-rose-300' : 'bg-brand-blue/15 text-brand-blue'"
                      >
                        {{ row.isFraud ? 'Fraud (1)' : 'Legit (0)' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- RIGHT 6 COLS: Firewall & Contamination Visualizer -->
        <div class="lg:col-span-6 flex flex-col gap-3">
          <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1.5">
            <span class="flex items-center gap-1.5">
              <Cpu class="w-4 h-4 text-emerald-500" />
              <span>Statistical Boundary Architecture</span>
            </span>
            <span class="text-[11px] font-normal text-muted">Isolation Diagram</span>
          </div>

          <!-- LEAKAGE VIOLATION BANNER -->
          <div
            v-if="leakageMode === 'leakage'"
            class="rounded-md border border-rose-500/40 bg-rose-500/10 p-3 flex flex-col gap-2 text-xs font-mono text-rose-900 dark:text-rose-200"
          >
            <div class="font-bold flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
              <Flame class="w-4 h-4 text-rose-600 shrink-0" />
              <span>Data Leakage Breach: Global Parameters Calculated</span>
            </div>
            <p class="text-[11px] leading-relaxed">
              The scaler computed $\mu = \${{ scalerParams.mean }}$ across <strong>ALL 10 records</strong>.
              Because test record #9 is a massive \$3,900 fraud transaction, its value leaked into the scaling weights.
              The model's cross-validation score will be falsely optimistic, and will crash upon real-world inference!
            </p>
          </div>

          <!-- CLEAN FIREWALL BANNER -->
          <div
            v-else
            class="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 flex flex-col gap-2 text-xs font-mono text-emerald-900 dark:text-emerald-200"
          >
            <div class="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
              <ShieldCheck class="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Statistical Firewall Active: Clean Out-of-Sample Isolation</span>
            </div>
            <p class="text-[11px] leading-relaxed">
              The scaler only observed <code>X_train</code>, computing $\mu_{\text{train}} = \${{ scalerParams.mean }}$.
              The test set remains 100% quarantined behind the firewall until final inference evaluation.
            </p>
          </div>

          <!-- STRATIFICATION ALERT (if random_bad selected) -->
          <div
            v-if="splitStrategy === 'random_bad'"
            class="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 text-xs font-mono text-amber-900 dark:text-amber-200 flex items-start gap-2"
          >
            <AlertTriangle class="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div class="text-[11px] leading-relaxed">
              <strong>Unstratified Random Split Hazard:</strong> By random chance, the test set received <strong>0% Fraud cases</strong>!
              A test set lacking minority fraud labels cannot evaluate model precision or recall.
              Always specify <code>stratify=y</code> on imbalanced targets!
            </div>
          </div>

          <!-- VISUAL FIREWALL PIPELINE DIAGRAM -->
          <div class="rounded-md border border-line bg-card p-3 flex flex-col gap-2">
            <div class="text-[11px] font-mono font-bold text-ink flex items-center justify-between">
              <span>Pipeline Stage Isolation:</span>
              <span class="text-muted text-[10px]">fit() vs transform()</span>
            </div>

            <!-- Pipeline Block Visualizer -->
            <div class="grid grid-cols-2 gap-2 text-center font-mono text-xs">
              <!-- Train Block -->
              <div class="p-2.5 rounded bg-brand-blue/10 border border-brand-blue/30 flex flex-col gap-1">
                <span class="text-brand-blue font-bold text-xs">1. X_train (8 records)</span>
                <span class="text-[10px] text-muted">scaler.fit_transform()</span>
                <span class="text-[11px] font-bold text-ink">μ = \${{ scalerParams.mean }}</span>
                <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-[9px] font-bold mt-1">
                  Learns Weights
                </span>
              </div>

              <!-- Test Block -->
              <div
                class="p-2.5 rounded border flex flex-col gap-1 transition-all"
                :class="leakageMode === 'leakage' ? 'bg-rose-500/10 border-rose-500/40' : 'bg-amber-500/10 border-amber-500/30'"
              >
                <div class="flex items-center justify-center gap-1">
                  <component :is="leakageMode === 'leakage' ? Unlock : Lock" class="w-3.5 h-3.5" :class="leakageMode === 'leakage' ? 'text-rose-600' : 'text-amber-600'" />
                  <span class="font-bold text-xs" :class="leakageMode === 'leakage' ? 'text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'">
                    2. X_test (2 records)
                  </span>
                </div>
                <span class="text-[10px] text-muted">scaler.transform() only</span>
                <span class="text-[11px] font-bold" :class="leakageMode === 'leakage' ? 'text-rose-600 dark:text-rose-400' : 'text-ink'">
                  {{ leakageMode === 'leakage' ? 'Leaked to Train' : 'Frozen Quarantine' }}
                </span>
                <span
                  class="px-1.5 py-0.5 rounded text-[9px] font-bold mt-1"
                  :class="leakageMode === 'leakage' ? 'bg-rose-500/20 text-rose-800 dark:text-rose-300' : 'bg-amber-500/20 text-amber-800 dark:text-amber-300'"
                >
                  {{ leakageMode === 'leakage' ? 'Contaminated' : 'Zero Fit Knowledge' }}
                </span>
              </div>
            </div>

            <!-- Firewall divider strip -->
            <div
              class="p-2 rounded text-[11px] font-mono text-center font-bold border"
              :class="leakageMode === 'leakage' ? 'bg-rose-500/20 text-rose-900 dark:text-rose-200 border-rose-500/40 animate-pulse' : 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-200 border-emerald-500/40'"
            >
              {{ leakageMode === 'leakage' ? '🔥 FIREWALL BROKEN: Test Set Contaminated Scaler Parameters' : '🛡️ STATISTICAL FIREWALL SECURE: No Test Information Leaked' }}
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Interactive Invariant & Summary Strip -->
      <div class="mt-6 pt-3 border-t border-line flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="setLeakageMode(leakageMode === 'firewall' ? 'leakage' : 'firewall')"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-blue text-white text-xs font-mono font-medium hover:bg-brand-blue/90 shadow-2xs cursor-pointer"
          >
            <Sparkles class="w-3.5 h-3.5" />
            <span>Switch to {{ leakageMode === 'firewall' ? 'Data Leakage Mode (Violate)' : 'Firewall Mode (Protect)' }}</span>
          </button>

          <button
            type="button"
            @click="setStrategy(splitStrategy === 'stratified' ? 'random_bad' : 'stratified')"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card text-xs font-mono text-ink hover:bg-card-subtle shadow-2xs cursor-pointer"
          >
            <Split class="w-3.5 h-3.5 text-muted" />
            <span>Toggle Stratification</span>
          </button>
        </div>

        <div class="text-xs font-mono text-muted">
          <span>Cardinal Rule: </span>
          <strong class="text-ink">Never fit() scalers, encoders, or imputers on test data</strong>
        </div>
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active Validation Workflow:</span>
        <span :class="leakageMode === 'firewall' ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'">
          {{ leakageMode === 'firewall' ? 'Statistical Firewall (Zero Leakage)' : 'Data Leakage Flaw' }}
        </span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ activeCodeSnippet }}</code></pre>
    </div>
  </div>
</template>

