<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  HardDrive,
  Cpu,
  Layers,
  ArrowRight,
  Play,
  RotateCcw,
  StepForward,
  Database,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  TrendingUp
} from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()

// --- Data Models -----------------------------------------------------------
interface LogRecord {
  id: number
  timestamp: string
  client_id: string
  amount: number
}

const diskFileRows: LogRecord[] = [
  // Chunk 0 (Rows 0..3)
  { id: 0, timestamp: '10:00:01', client_id: 'US-801', amount: 150 },
  { id: 1, timestamp: '10:00:05', client_id: 'EU-204', amount: 320 },
  { id: 2, timestamp: '10:00:12', client_id: 'US-801', amount: 450 },
  { id: 3, timestamp: '10:00:18', client_id: 'AP-552', amount: 210 },
  // Chunk 1 (Rows 4..7)
  { id: 4, timestamp: '10:00:22', client_id: 'EU-204', amount: 600 },
  { id: 5, timestamp: '10:00:29', client_id: 'US-801', amount: 180 },
  { id: 6, timestamp: '10:00:35', client_id: 'AP-552', amount: 390 },
  { id: 7, timestamp: '10:00:41', client_id: 'EU-204', amount: 270 },
  // Chunk 2 (Rows 8..11)
  { id: 8, timestamp: '10:00:48', client_id: 'US-801', amount: 510 },
  { id: 9, timestamp: '10:00:54', client_id: 'AP-552', amount: 130 },
  { id: 10, timestamp: '10:01:02', client_id: 'EU-204', amount: 440 },
  { id: 11, timestamp: '10:01:08', client_id: 'US-801', amount: 360 },
  // Chunk 3 (Rows 12..15)
  { id: 12, timestamp: '10:01:14', client_id: 'AP-552', amount: 290 },
  { id: 13, timestamp: '10:01:21', client_id: 'EU-204', amount: 580 },
  { id: 14, timestamp: '10:01:27', client_id: 'US-801', amount: 220 },
  { id: 15, timestamp: '10:01:33', client_id: 'AP-552', amount: 410 }
]

// --- State -----------------------------------------------------------------
const chunkSize = ref<2 | 4>(4)
const activeChunkIndex = ref<number>(-1) // -1 = Idle, 0..totalChunks-1 = actively in RAM
const isPlaying = ref(false)
let playTimer: ReturnType<typeof setInterval> | null = null

// Processed accumulator history
const processedChunkIndices = ref<number[]>([])

// --- Computeds -------------------------------------------------------------
const totalChunks = computed(() => {
  return Math.ceil(diskFileRows.length / chunkSize.value)
})

const chunks = computed(() => {
  const result: LogRecord[][] = []
  for (let i = 0; i < diskFileRows.length; i += chunkSize.value) {
    result.push(diskFileRows.slice(i, i + chunkSize.value))
  }
  return result
})

// Current chunk in RAM
const activeChunkData = computed<LogRecord[] | null>(() => {
  if (activeChunkIndex.value < 0 || activeChunkIndex.value >= chunks.value.length) {
    return null
  }
  return chunks.value[activeChunkIndex.value]
})

// Current chunk aggregate
const activeChunkSum = computed(() => {
  if (!activeChunkData.value) return 0
  return activeChunkData.value.reduce((acc, row) => acc + row.amount, 0)
})

// Global accumulator
const globalAccumulator = computed(() => {
  let totalSum = 0
  let totalRows = 0

  processedChunkIndices.value.forEach(idx => {
    const ch = chunks.value[idx]
    if (ch) {
      totalSum += ch.reduce((acc, row) => acc + row.amount, 0)
      totalRows += ch.length
    }
  })

  // Add active chunk if not already in processed list
  if (activeChunkIndex.value >= 0 && !processedChunkIndices.value.includes(activeChunkIndex.value)) {
    const ch = chunks.value[activeChunkIndex.value]
    if (ch) {
      totalSum += ch.reduce((acc, row) => acc + row.amount, 0)
      totalRows += ch.length
    }
  }

  return {
    totalSum,
    totalRows,
    mean: totalRows > 0 ? (totalSum / totalRows).toFixed(1) : '0.0'
  }
})

// Simulated RAM footprint
const memoryUsageStats = computed(() => {
  const bytesPerRow = 32
  const activeRamBytes = activeChunkData.value ? activeChunkData.value.length * bytesPerRow : 0
  const unchunkedRamBytes = diskFileRows.length * bytesPerRow

  return {
    chunkedRamKb: (activeRamBytes / 1024).toFixed(3),
    monolithicRamKb: (unchunkedRamBytes / 1024).toFixed(3),
    isStreamComplete: processedChunkIndices.value.length === totalChunks.value
  }
})

const activeCodeSnippet = computed(() => {
  return `# Out-of-Core Processing with Streaming Generator
total_revenue = 0
total_count = 0

for chunk in pd.read_csv('huge_transactions.csv', chunksize=${chunkSize.value}):
    # 1. Process bounded slice in RAM
    total_revenue += chunk['amount'].sum()
    total_count += len(chunk)
    # 2. Chunk memory is automatically garbage collected here!

print(f"Total: \${total_revenue:,} across {total_count} rows")`
})

// --- Methods ---------------------------------------------------------------
const emitInspection = () => {
  emit('inspect', {
    title: `pd.read_csv(chunksize=${chunkSize.value})`,
    details: {
      'Generator Type': 'pandas.io.parsers.TextFileReader',
      'Chunk Size (rows)': chunkSize.value,
      'Active Chunk': activeChunkIndex.value >= 0 ? `Chunk #${activeChunkIndex.value} (${chunkSize.value} rows)` : 'None (Buffer Empty)',
      'Total Chunks': totalChunks.value,
      'Active RAM Buffer': activeChunkData.value ? `${chunkSize.value} rows in memory` : '0 bytes in RAM',
      'RAM Invariant': 'O(chunksize) constant memory — avoids Out-Of-Memory (OOM)',
      'Global Accumulator': `\$${globalAccumulator.value.totalSum.toLocaleString()} (${globalAccumulator.value.totalRows} rows)`
    }
  })
}

const nextChunk = () => {
  if (activeChunkIndex.value >= 0 && !processedChunkIndices.value.includes(activeChunkIndex.value)) {
    processedChunkIndices.value.push(activeChunkIndex.value)
  }

  if (activeChunkIndex.value < totalChunks.value - 1) {
    activeChunkIndex.value++
  } else {
    // Finished all chunks
    if (activeChunkIndex.value >= 0 && !processedChunkIndices.value.includes(activeChunkIndex.value)) {
      processedChunkIndices.value.push(activeChunkIndex.value)
    }
    activeChunkIndex.value = -1 // Flush buffer
  }
  emitInspection()
}

const togglePlay = () => {
  isPlaying.value = !isPlaying.value
  if (isPlaying.value) {
    if (activeChunkIndex.value < 0 || activeChunkIndex.value >= totalChunks.value - 1) {
      resetSimulation()
      activeChunkIndex.value = 0
    }
    playTimer = setInterval(() => {
      if (activeChunkIndex.value < totalChunks.value - 1) {
        if (!processedChunkIndices.value.includes(activeChunkIndex.value)) {
          processedChunkIndices.value.push(activeChunkIndex.value)
        }
        activeChunkIndex.value++
        emitInspection()
      } else {
        if (!processedChunkIndices.value.includes(activeChunkIndex.value)) {
          processedChunkIndices.value.push(activeChunkIndex.value)
        }
        activeChunkIndex.value = -1 // Finished
        isPlaying.value = false
        if (playTimer) clearInterval(playTimer)
        emitInspection()
      }
    }, 1400)
  } else if (playTimer) {
    clearInterval(playTimer)
  }
}

const resetSimulation = () => {
  isPlaying.value = false
  if (playTimer) clearInterval(playTimer)
  activeChunkIndex.value = -1
  processedChunkIndices.value = []
  emitInspection()
}

const setChunkSize = (sz: 2 | 4) => {
  chunkSize.value = sz
  resetSimulation()
}

onMounted(() => {
  emitInspection()
})
</script>

<template>
  <div class="flex flex-col gap-3 w-full">
    <!-- Top Action Toolbar -->
    <div class="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
      <!-- Chunk Size Selection -->
      <div class="flex items-center gap-1.5 flex-wrap">
        <span class="text-muted">chunksize:</span>
        <button
          type="button"
          @click="setChunkSize(4)"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="chunkSize === 4 ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          chunksize=4 ({{ totalChunks }} chunks)
        </button>
        <button
          type="button"
          @click="setChunkSize(2)"
          class="px-2.5 py-1 rounded-md border transition-all text-[11px] font-medium shadow-2xs cursor-pointer"
          :class="chunkSize === 2 ? 'bg-brand-blue text-white font-bold border-brand-blue shadow-xs' : 'bg-card border-line text-muted hover:text-ink'"
        >
          chunksize=2 ({{ Math.ceil(diskFileRows.length / 2) }} chunks)
        </button>
      </div>

      <!-- Streaming Generator Status Badge -->
      <div class="flex items-center gap-2 bg-card px-3 py-1 rounded-md border border-line shadow-2xs">
        <span
          class="w-2 h-2 rounded-full"
          :class="activeChunkIndex >= 0 ? 'bg-emerald-500 animate-pulse' : processedChunkIndices.length === totalChunks ? 'bg-brand-blue' : 'bg-muted'"
        />
        <span class="font-bold text-ink">Generator:</span>
        <span v-if="activeChunkIndex >= 0" class="text-emerald-600 dark:text-emerald-400 font-bold">
          Streaming Chunk {{ activeChunkIndex + 1 }}/{{ totalChunks }}
        </span>
        <span v-else-if="processedChunkIndices.length === totalChunks" class="text-brand-blue font-bold">
          Stream Complete (Buffer Flushed)
        </span>
        <span v-else class="text-muted">
          Ready (Buffer Empty)
        </span>
      </div>
    </div>

    <!-- Main Streaming Pipeline Arena -->
    <div class="relative w-full rounded-lg border border-line bg-stage p-4 shadow-xs min-h-[380px] flex flex-col justify-between select-none">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <!-- LEFT 5 COLS: Disk Storage (Large File on Disk) -->
        <div class="lg:col-span-5 flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1.5">
            <span class="flex items-center gap-1.5">
              <HardDrive class="w-4 h-4 text-muted" />
              <span>Disk File: sales.csv</span>
              <span class="text-[11px] font-normal text-muted">({{ diskFileRows.length }} rows)</span>
            </span>
            <span class="text-[10px] font-normal text-muted">Persistent Flash/SSD</span>
          </div>

          <div class="overflow-x-auto w-full max-h-[310px] overflow-y-auto">
            <table class="dataframe w-full text-xs">
              <thead>
                <tr>
                  <th class="w-8 text-center text-muted">#</th>
                  <th class="text-left font-bold text-ink">client_id</th>
                  <th class="text-right font-bold text-ink">amount</th>
                  <th class="text-center font-bold text-muted text-[10px]">Chunk Partition</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="(row, idx) in diskFileRows"
                  :key="row.id"
                  class="transition-colors"
                  :class="[
                    Math.floor(idx / chunkSize) === activeChunkIndex
                      ? 'bg-emerald-500/15 font-bold border-l-4 border-l-emerald-500'
                      : processedChunkIndices.includes(Math.floor(idx / chunkSize))
                        ? 'opacity-40 bg-card-subtle'
                        : 'hover:bg-card-subtle'
                  ]"
                >
                  <td class="text-center font-mono text-[11px] text-muted">{{ idx }}</td>
                  <td class="font-mono text-ink font-semibold py-1">{{ row.client_id }}</td>
                  <td class="font-mono text-right font-bold text-brand-blue">\${{ row.amount }}</td>
                  <td class="text-center font-mono text-[10px]">
                    <span
                      class="px-1.5 py-0.2 rounded text-[9px] font-bold"
                      :class="Math.floor(idx / chunkSize) === activeChunkIndex ? 'bg-emerald-500 text-white' : 'bg-muted/15 text-muted'"
                    >
                      Chunk {{ Math.floor(idx / chunkSize) }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="p-2 rounded border border-line bg-card-subtle text-[11px] font-mono text-muted flex items-center justify-between">
            <span>Partitions: <strong class="text-ink">{{ totalChunks }} Chunks</strong></span>
            <span>Total Size: <strong class="text-ink">100% on Disk</strong></span>
          </div>
        </div>

        <!-- RIGHT 7 COLS: RAM Memory Buffer & Accumulator -->
        <div class="lg:col-span-7 flex flex-col gap-4">
          <!-- TOP: Active RAM Buffer (Bounded Envelope) -->
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line pb-1.5">
              <span class="flex items-center gap-1.5">
                <Cpu class="w-4 h-4 text-emerald-500" />
                <span>Physical RAM Buffer (Bounded at {{ chunkSize }} rows)</span>
              </span>
              <span class="text-[10px] font-normal" :class="activeChunkData ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-muted'">
                {{ activeChunkData ? `Active Chunk #${activeChunkIndex}` : 'Buffer Flushed' }}
              </span>
            </div>

            <!-- RAM Chunk Table View -->
            <div v-if="activeChunkData" class="overflow-x-auto w-full">
              <table class="dataframe w-full text-xs">
                <thead>
                  <tr>
                    <th class="w-8 text-center text-muted">#</th>
                    <th class="text-left font-bold text-ink">timestamp</th>
                    <th class="text-left font-bold text-ink">client_id</th>
                    <th class="text-right font-bold text-emerald-600 dark:text-emerald-400">amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="row in activeChunkData"
                    :key="row.id"
                    class="bg-emerald-500/5 font-medium"
                  >
                    <td class="text-center font-mono text-[11px] text-muted">{{ row.id }}</td>
                    <td class="font-mono text-muted py-1">{{ row.timestamp }}</td>
                    <td class="font-mono text-ink font-semibold">{{ row.client_id }}</td>
                    <td class="font-mono text-right font-bold text-emerald-600 dark:text-emerald-400">\${{ row.amount }}</td>
                  </tr>
                </tbody>
              </table>

              <div class="mt-1.5 p-2 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between font-mono text-xs">
                <span class="text-emerald-800 dark:text-emerald-300 font-medium">chunk['amount'].sum():</span>
                <span class="font-bold text-emerald-700 dark:text-emerald-300">\${{ activeChunkSum }}</span>
              </div>
            </div>

            <!-- Empty RAM Buffer Indicator -->
            <div
              v-else
              class="rounded-md border border-dashed border-line bg-card-subtle p-6 flex flex-col items-center justify-center text-center gap-1.5"
            >
              <Cpu class="w-6 h-6 text-muted" />
              <div class="text-xs font-mono font-bold text-ink">RAM Buffer Empty</div>
              <p class="text-[11px] font-mono text-muted max-w-sm">
                {{ processedChunkIndices.length === totalChunks ? 'All chunks processed and accumulated. Total memory footprint remained bounded!' : 'Click "Next Chunk" or "Stream Pipeline" to load the first batch from disk into RAM.' }}
              </p>
            </div>
          </div>

          <!-- BOTTOM: Global Running Accumulator -->
          <div class="rounded-md border border-line bg-card p-3 flex flex-col gap-2.5">
            <div class="flex items-center justify-between text-xs font-mono font-bold text-ink border-b border-line/60 pb-1">
              <span class="flex items-center gap-1.5">
                <Database class="w-3.5 h-3.5 text-brand-blue" />
                <span>Global Running Accumulator</span>
              </span>
              <span class="text-[11px] font-normal text-muted">
                {{ processedChunkIndices.length }}/{{ totalChunks }} Chunks Ingested
              </span>
            </div>

            <div class="grid grid-cols-3 gap-2 font-mono text-center">
              <div class="p-2 rounded bg-card-subtle border border-line">
                <div class="text-[10px] text-muted uppercase">Total Revenue</div>
                <div class="text-sm font-bold text-brand-blue mt-0.5">\${{ globalAccumulator.totalSum.toLocaleString() }}</div>
              </div>
              <div class="p-2 rounded bg-card-subtle border border-line">
                <div class="text-[10px] text-muted uppercase">Rows Processed</div>
                <div class="text-sm font-bold text-ink mt-0.5">{{ globalAccumulator.totalRows }} / {{ diskFileRows.length }}</div>
              </div>
              <div class="p-2 rounded bg-card-subtle border border-line">
                <div class="text-[10px] text-muted uppercase">Mean / Row</div>
                <div class="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">\${{ globalAccumulator.mean }}</div>
              </div>
            </div>

            <!-- Invariant Visual Callout -->
            <div class="flex items-center gap-2 p-2 rounded bg-brand-blue/10 border border-brand-blue/20 text-xs font-mono">
              <CheckCircle2 class="w-4 h-4 text-brand-blue shrink-0" />
              <div class="text-[11px] leading-tight text-ink">
                <strong>O(ChunkSize) Memory Invariant:</strong> Peak RAM usage is strictly capped at {{ chunkSize }} rows, allowing a 10 GB file to run seamlessly on a 4 GB RAM machine.
              </div>
            </div>
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
            <span>{{ isPlaying ? 'Pause Stream' : 'Stream Pipeline' }}</span>
          </button>

          <button
            type="button"
            @click="nextChunk"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card text-xs font-mono text-ink hover:bg-card-subtle shadow-2xs cursor-pointer"
          >
            <StepForward class="w-3.5 h-3.5 text-muted" />
            <span>Next Chunk</span>
          </button>

          <button
            type="button"
            @click="resetSimulation"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-line bg-card text-xs font-mono text-muted hover:text-ink hover:bg-card-subtle shadow-2xs cursor-pointer"
            title="Reset generator"
          >
            <RotateCcw class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Chunk Stepper Buttons -->
        <div class="flex items-center gap-1">
          <button
            v-for="(_, idx) in chunks"
            :key="idx"
            type="button"
            @click="activeChunkIndex = idx; emitInspection()"
            class="px-2.5 py-1 rounded text-[11px] font-mono border transition-all cursor-pointer"
            :class="activeChunkIndex === idx ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-2xs' : processedChunkIndices.includes(idx) ? 'bg-muted/15 border-line text-muted' : 'bg-card border-line text-ink hover:bg-card-subtle'"
          >
            Chunk {{ idx }}
          </button>
        </div>
      </div>
    </div>

    <!-- Active Executable Code Representation -->
    <div class="rounded-md border border-line bg-card p-3 font-mono text-xs">
      <div class="flex items-center justify-between text-muted text-[11px] mb-1.5 border-b border-line/60 pb-1">
        <span>Active Out-of-Core Processing Pattern:</span>
        <span class="text-emerald-600 dark:text-emerald-400 font-semibold">Constant Memory Generator</span>
      </div>
      <pre class="text-ink overflow-x-auto selection:bg-brand-blue selection:text-white"><code>{{ activeCodeSnippet }}</code></pre>
    </div>
  </div>
</template>

