<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { Play, RotateCcw, PlusCircle, CheckCircle, Crosshair, Sparkles } from 'lucide-vue-next'

interface Point {
  x: number // -1 to 1
  y: number // -1 to 1
  label: 1 | -1 // 1: Class A (Blue), -1: Class B (Amber)
}

const canvasRef = ref<HTMLCanvasElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// State
const activeClass = ref<1 | -1>(1) // 1 = Class A, -1 = Class B
const stepCount = ref<number>(0)
const accuracy = ref<number>(0)
const loss = ref<number>(0)
const statusMessage = ref<string>('Ready. Click canvas to add points or "Step Train" to advance.')

// Model weights for w1*x + w2*y + b = 0
const weights = ref<{ w1: number; w2: number; b: number }>({
  w1: 0.1,
  w2: 0.9,
  b: 0.05
})

// Default initial points (normalized [-1, 1])
const defaultPoints: Point[] = [
  // Class A (top-left cluster, Blue)
  { x: -0.65, y: 0.45, label: 1 },
  { x: -0.45, y: 0.70, label: 1 },
  { x: -0.30, y: 0.35, label: 1 },
  { x: -0.70, y: 0.15, label: 1 },
  { x: -0.50, y: 0.55, label: 1 },
  { x: -0.20, y: 0.60, label: 1 },
  { x: -0.35, y: 0.80, label: 1 },

  // Class B (bottom-right cluster, Amber)
  { x: 0.55, y: -0.45, label: -1 },
  { x: 0.35, y: -0.70, label: -1 },
  { x: 0.20, y: -0.35, label: -1 },
  { x: 0.65, y: -0.20, label: -1 },
  { x: 0.40, y: -0.55, label: -1 },
  { x: 0.70, y: -0.60, label: -1 },
  { x: 0.25, y: -0.80, label: -1 }
]

const points = ref<Point[]>(JSON.parse(JSON.stringify(defaultPoints)))
const { isDark } = useTheme()

// Coordinate conversion helpers
const canvasWidth = ref(560)
const canvasHeight = ref(360)

const toCanvasX = (nx: number) => {
  return ((nx + 1) / 2) * canvasWidth.value
}

const toCanvasY = (ny: number) => {
  // Invert y so positive is up
  return ((1 - ny) / 2) * canvasHeight.value
}

const toNormX = (cx: number) => {
  return (cx / canvasWidth.value) * 2 - 1
}

const toNormY = (cy: number) => {
  return 1 - (cy / canvasHeight.value) * 2
}

// Compute metrics
const updateMetrics = () => {
  if (points.value.length === 0) {
    accuracy.value = 100
    loss.value = 0
    return
  }

  let correct = 0
  let totalLoss = 0
  const { w1, w2, b } = weights.value

  for (const pt of points.value) {
    const raw = w1 * pt.x + w2 * pt.y + b
    const pred = raw >= 0 ? 1 : -1
    if (pred === pt.label) {
      correct++
    }
    // Sigmoid log-loss approximation
    const target = pt.label === 1 ? 1 : 0
    const prob = 1 / (1 + Math.exp(-Math.max(-10, Math.min(10, raw))))
    const sampleLoss = -(target * Math.log(prob + 1e-7) + (1 - target) * Math.log(1 - prob + 1e-7))
    totalLoss += sampleLoss
  }

  accuracy.value = Math.round((correct / points.value.length) * 100)
  loss.value = Number((totalLoss / points.value.length).toFixed(3))
}

// Perceptron / Logistic gradient step (Single step, strictly manual)
const stepTrain = () => {
  if (points.value.length === 0) {
    statusMessage.value = 'Add points to canvas first.'
    return
  }

  const lr = 0.25
  let gradW1 = 0
  let gradW2 = 0
  let gradB = 0
  let mistakes = 0

  for (const pt of points.value) {
    const raw = weights.value.w1 * pt.x + weights.value.w2 * pt.y + weights.value.b
    const prob = 1 / (1 + Math.exp(-Math.max(-10, Math.min(10, raw))))
    const target = pt.label === 1 ? 1 : 0
    const error = prob - target // gradient of binary cross entropy

    if ((raw >= 0 ? 1 : -1) !== pt.label) {
      mistakes++
    }

    gradW1 += error * pt.x
    gradW2 += error * pt.y
    gradB += error
  }

  const n = points.value.length
  // Gradient descent update
  weights.value.w1 -= (lr * gradW1) / n
  weights.value.w2 -= (lr * gradW2) / n
  weights.value.b -= (lr * gradB) / n

  stepCount.value++
  updateMetrics()
  draw()

  if (accuracy.value === 100) {
    statusMessage.value = `Step ${stepCount.value}: Linearly separated with 100% accuracy!`
  } else {
    statusMessage.value = `Step ${stepCount.value}: Boundary adjusted. (${mistakes} misclassified)`
  }
}

// Reset points and weights
const resetDemo = () => {
  points.value = JSON.parse(JSON.stringify(defaultPoints))
  weights.value = {
    w1: 0.1,
    w2: 0.9,
    b: 0.05
  }
  stepCount.value = 0
  statusMessage.value = 'Reset to initial state. Click "Step Train" to begin.'
  updateMetrics()
  draw()
}

// Clear all points
const clearPoints = () => {
  points.value = []
  stepCount.value = 0
  statusMessage.value = 'All points cleared. Click on the canvas to place new points.'
  updateMetrics()
  draw()
}

// Handle Canvas Click to add point
const handleCanvasClick = (e: MouseEvent) => {
  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const clickX = e.clientX - rect.left
  const clickY = e.clientY - rect.top

  const normX = Math.max(-0.95, Math.min(0.95, toNormX(clickX)))
  const normY = Math.max(-0.95, Math.min(0.95, toNormY(clickY)))

  points.value.push({
    x: Number(normX.toFixed(3)),
    y: Number(normY.toFixed(3)),
    label: activeClass.value
  })

  updateMetrics()
  draw()
}

// Render Canvas
const draw = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dark = isDark.value
  const w = canvasWidth.value
  const h = canvasHeight.value

  // Colors based on theme
  const bgFill = dark ? '#151a22' : '#fbfaf7'
  const gridLineColor = dark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(27, 36, 48, 0.06)'
  const axisColor = dark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(27, 36, 48, 0.2)'
  const classAColor = dark ? '#6ea0ff' : '#1f5fd6'
  const classBColor = dark ? '#f5a524' : '#d97706'
  const boundaryColor = dark ? '#e8ecf2' : '#1b2430'

  // Clear
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = bgFill
  ctx.fillRect(0, 0, w, h)

  // 1. Decision Region Background Fill (Soft Shading)
  const { w1, w2, b } = weights.value
  const imgData = ctx.createImageData(w, h)
  const data = imgData.data

  // Downsample sampling for performance
  const step = 4
  for (let py = 0; py < h; py += step) {
    const ny = 1 - (py / h) * 2
    for (let px = 0; px < w; px += step) {
      const nx = (px / w) * 2 - 1
      const val = w1 * nx + w2 * ny + b
      const prob = 1 / (1 + Math.exp(-Math.max(-5, Math.min(5, val * 3))))

      // Interpolate soft color between Class B (amber) and Class A (blue)
      // Class A: prob ~ 1 -> blue; Class B: prob ~ 0 -> amber
      const r = Math.round(dark ? (prob * 29 + (1 - prob) * 58) : (prob * 230 + (1 - prob) * 253))
      const g = Math.round(dark ? (prob * 43 + (1 - prob) * 45) : (prob * 238 + (1 - prob) * 240))
      const bColor = Math.round(dark ? (prob * 71 + (1 - prob) * 18) : (prob * 252 + (1 - prob) * 217))
      const alpha = dark ? 45 : 70

      for (let dy = 0; dy < step && py + dy < h; dy++) {
        for (let dx = 0; dx < step && px + dx < w; dx++) {
          const idx = ((py + dy) * w + (px + dx)) * 4
          data[idx] = r
          data[idx + 1] = g
          data[idx + 2] = bColor
          data[idx + 3] = alpha
        }
      }
    }
  }
  ctx.putImageData(imgData, 0, 0)

  // 2. Draw Subtle Coordinate Grid
  ctx.lineWidth = 1
  ctx.strokeStyle = gridLineColor
  for (let i = -0.8; i <= 0.8; i += 0.2) {
    // Vertical grid
    const gx = toCanvasX(i)
    ctx.beginPath()
    ctx.moveTo(gx, 0)
    ctx.lineTo(gx, h)
    ctx.stroke()

    // Horizontal grid
    const gy = toCanvasY(i)
    ctx.beginPath()
    ctx.moveTo(0, gy)
    ctx.lineTo(w, gy)
    ctx.stroke()
  }

  // 3. Central Axes
  ctx.strokeStyle = axisColor
  ctx.lineWidth = 1.5
  // X axis
  ctx.beginPath()
  ctx.moveTo(0, toCanvasY(0))
  ctx.lineTo(w, toCanvasY(0))
  ctx.stroke()
  // Y axis
  ctx.beginPath()
  ctx.moveTo(toCanvasX(0), 0)
  ctx.lineTo(toCanvasX(0), h)
  ctx.stroke()

  // 4. Decision Boundary Line: w1*x + w2*y + b = 0  =>  y = -(w1*x + b) / w2
  if (Math.abs(w2) > 1e-4) {
    const xLeft = -1.1
    const yLeft = -(w1 * xLeft + b) / w2
    const xRight = 1.1
    const yRight = -(w1 * xRight + b) / w2

    ctx.save()
    // Glow behind the line
    ctx.strokeStyle = dark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(27, 36, 48, 0.15)'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(toCanvasX(xLeft), toCanvasY(yLeft))
    ctx.lineTo(toCanvasX(xRight), toCanvasY(yRight))
    ctx.stroke()

    // Main line
    ctx.strokeStyle = boundaryColor
    ctx.lineWidth = 2.5
    ctx.beginPath()
    ctx.moveTo(toCanvasX(xLeft), toCanvasY(yLeft))
    ctx.lineTo(toCanvasX(xRight), toCanvasY(yRight))
    ctx.stroke()
    ctx.restore()
  }

  // 5. Render Data Points
  for (const pt of points.value) {
    const px = toCanvasX(pt.x)
    const py = toCanvasY(pt.y)
    const isClassA = pt.label === 1
    const ptColor = isClassA ? classAColor : classBColor

    ctx.save()
    // Outer shadow / glow ring
    ctx.beginPath()
    ctx.arc(px, py, 9, 0, Math.PI * 2)
    ctx.fillStyle = isClassA
      ? (dark ? 'rgba(110, 160, 255, 0.25)' : 'rgba(31, 95, 214, 0.18)')
      : (dark ? 'rgba(245, 165, 36, 0.25)' : 'rgba(217, 119, 6, 0.18)')
    ctx.fill()

    // Point fill
    ctx.beginPath()
    ctx.arc(px, py, 6, 0, Math.PI * 2)
    ctx.fillStyle = ptColor
    ctx.fill()

    // Point inner ring border
    ctx.lineWidth = 2
    ctx.strokeStyle = dark ? '#12161d' : '#ffffff'
    ctx.stroke()
    ctx.restore()
  }
}

// Resize handler
const resizeCanvas = () => {
  if (!containerRef.value || !canvasRef.value) return
  const rect = containerRef.value.getBoundingClientRect()
  const width = Math.floor(rect.width)
  const height = 360

  canvasWidth.value = width
  canvasHeight.value = height

  const dpr = window.devicePixelRatio || 1
  canvasRef.value.width = width * dpr
  canvasRef.value.height = height * dpr

  const ctx = canvasRef.value.getContext('2d')
  if (ctx) {
    ctx.scale(dpr, dpr)
  }

  draw()
}

onMounted(() => {
  resizeCanvas()
  updateMetrics()
  window.addEventListener('resize', resizeCanvas)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeCanvas)
})

watch(isDark, () => {
  draw()
})
</script>

<template>
  <div class="rounded-lg border border-line bg-card shadow-md overflow-hidden transition-colors">
    <!-- Canvas Header Bar with Controls -->
    <div class="border-b border-line bg-card-subtle px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium bg-card border border-line text-ink">
          <Sparkles class="w-3.5 h-3.5 text-brand-blue" />
          Live 2D Separator
        </span>
        <span class="text-xs text-muted font-mono hidden sm:inline">
          Single-Step Gradient Descent
        </span>
      </div>

      <!-- Class Toggle Pill -->
      <div class="inline-flex rounded-md border border-line bg-card p-0.5 text-xs font-medium">
        <button
          type="button"
          @click="activeClass = 1"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors"
          :class="activeClass === 1 ? 'bg-brand-blue text-white shadow-xs' : 'text-muted hover:text-ink'"
        >
          <span class="w-2.5 h-2.5 rounded-full bg-blue-300 inline-block" />
          <span>Class A</span>
        </button>
        <button
          type="button"
          @click="activeClass = -1"
          class="flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors"
          :class="activeClass === -1 ? 'bg-brand-amber text-white shadow-xs' : 'text-muted hover:text-ink'"
        >
          <span class="w-2.5 h-2.5 rounded-full bg-amber-300 inline-block" />
          <span>Class B</span>
        </button>
      </div>
    </div>

    <!-- Interactive Canvas Stage -->
    <div ref="containerRef" class="relative w-full h-[360px] bg-stage select-none cursor-crosshair">
      <canvas
        ref="canvasRef"
        @click="handleCanvasClick"
        class="w-full h-full block"
      />

      <!-- Prompt Overlay / Helper Hint -->
      <div class="absolute bottom-2 left-3 pointer-events-none text-[11px] font-mono text-muted bg-card/85 backdrop-blur-xs px-2 py-0.5 rounded border border-line/60">
        Click to plot <span :class="activeClass === 1 ? 'text-brand-blue font-bold' : 'text-brand-amber font-bold'">{{ activeClass === 1 ? 'Class A (+)' : 'Class B (-)' }}</span>
      </div>

      <div class="absolute top-2 right-3 pointer-events-none text-[11px] font-mono text-muted bg-card/85 backdrop-blur-xs px-2 py-0.5 rounded border border-line/60">
        [ -1.0, +1.0 ] Plane
      </div>
    </div>

    <!-- Live Telemetry / Metrics Bar -->
    <div class="grid grid-cols-2 sm:grid-cols-4 border-t border-line bg-card-subtle divide-x divide-line text-xs font-mono">
      <div class="px-4 py-2.5 flex flex-col">
        <span class="text-muted text-[10px] uppercase">Step / Epoch</span>
        <span class="font-bold text-ink text-sm">{{ stepCount }}</span>
      </div>
      <div class="px-4 py-2.5 flex flex-col">
        <span class="text-muted text-[10px] uppercase">Accuracy</span>
        <span class="font-bold text-sm" :class="accuracy === 100 ? 'text-brand-green' : 'text-ink'">
          {{ accuracy }}%
        </span>
      </div>
      <div class="px-4 py-2.5 flex flex-col">
        <span class="text-muted text-[10px] uppercase">Binary Loss</span>
        <span class="font-bold text-ink text-sm">{{ loss }}</span>
      </div>
      <div class="px-4 py-2.5 flex flex-col">
        <span class="text-muted text-[10px] uppercase">Total Points</span>
        <span class="font-bold text-ink text-sm">{{ points.length }}</span>
      </div>
    </div>

    <!-- Canvas Action Footer: Step Train & Reset -->
    <div class="px-4 py-3 bg-card border-t border-line flex flex-wrap items-center justify-between gap-3">
      <!-- Status Notice -->
      <div class="text-xs text-muted font-mono flex items-center gap-1.5 truncate max-w-sm">
        <CheckCircle class="w-3.5 h-3.5 text-brand-blue shrink-0" />
        <span class="truncate">{{ statusMessage }}</span>
      </div>

      <!-- Buttons -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="clearPoints"
          class="px-2.5 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-muted hover:text-ink text-xs font-mono font-medium transition-colors"
          title="Clear all points"
        >
          Clear
        </button>

        <button
          type="button"
          @click="resetDemo"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-ink text-xs font-mono font-medium shadow-sm transition-colors"
        >
          <RotateCcw class="w-3.5 h-3.5 text-muted" />
          Reset
        </button>

        <button
          type="button"
          @click="stepTrain"
          class="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-mono font-semibold shadow-sm transition-all focus:ring-2 focus:ring-brand-blue/40"
        >
          <Play class="w-3.5 h-3.5 fill-current" />
          Step Train
        </button>
      </div>
    </div>
  </div>
</template>

