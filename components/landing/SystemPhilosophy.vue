<script setup lang="ts">
import { Zap, Layers, PlayCircle, ShieldCheck, Code2, Cpu } from 'lucide-vue-next'

const principles = [
  {
    icon: Zap,
    title: 'Client-Side Speed & Privacy',
    badge: 'Zero-Backend Architecture',
    color: 'text-brand-green',
    bg: 'bg-brand-green-soft text-brand-green border-brand-green/20',
    description:
      'All matrix operations, gradient updates, decision boundaries, and loss functions execute directly inside the browser using optimized TypeScript engines. No server latency, zero API rate limits, and 100% data privacy.',
    details: [
      'Pure client-side execution with Bun & Nuxt 3',
      'No data leaves your local machine',
      'Instantaneous feedback loop during training steps'
    ]
  },
  {
    icon: Layers,
    title: 'Strict Math-to-View Decoupling',
    badge: 'Clean Architecture',
    color: 'text-brand-blue',
    bg: 'bg-brand-blue-soft text-brand-blue border-brand-blue/20',
    description:
      'The mathematical computation kernels (linear algebra, convex optimization, neural backprop) are written as pure, testable TypeScript classes completely decoupled from Vue UI components or canvas rendering loops.',
    details: [
      'Typed numerical state snapshots',
      'Independent verification of mathematical invariants',
      'Seamless interchange between 2D Canvas and 3D WebGL renderers'
    ]
  },
  {
    icon: PlayCircle,
    title: 'Explicit Step Controls',
    badge: 'No Auto-Run Anti-Pattern',
    color: 'text-brand-amber',
    bg: 'bg-brand-amber-soft text-brand-amber border-brand-amber/20',
    description:
      'Machine learning algorithms should not be mysterious black boxes that flash past your screen. In ML & Data Visualizer, you control the stepping rate, inspect intermediate gradients, and step single epochs manually.',
    details: [
      'Deterministic single-step stepping debugger',
      'Inspect gradients before and after parameter updates',
      'Observe convergence or divergence at your own pace'
    ]
  }
]
</script>

<template>
  <section id="philosophy" class="py-16 sm:py-24 border-t border-line bg-card transition-colors">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Section Header -->
      <div class="max-w-3xl mx-auto text-center space-y-4 mb-16">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-card-subtle border border-line text-muted shadow-xs">
          <Code2 class="w-3.5 h-3.5 text-brand-blue" />
          <span>Architectural Invariants</span>
        </div>
        <h2 class="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
          Engineered for Deep Conceptual Clarity
        </h2>
        <p class="text-muted text-base sm:text-lg">
          We built this platform with three inviolable engineering principles to ensure an educational experience superior to static formulas or opaque animated videos.
        </p>
      </div>

      <!-- Principles Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div
          v-for="(item, index) in principles"
          :key="index"
          class="rounded-lg border border-line bg-card-subtle p-7 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow"
        >
          <div class="space-y-4">
            <!-- Icon & Pill -->
            <div class="flex items-center justify-between">
              <div
                class="w-12 h-12 rounded-lg flex items-center justify-center border"
                :class="item.bg"
              >
                <component :is="item.icon" class="w-6 h-6" />
              </div>
              <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded border" :class="item.bg">
                Pillar 0{{ index + 1 }}
              </span>
            </div>

            <h3 class="text-xl font-bold text-ink">
              {{ item.title }}
            </h3>

            <p class="text-sm text-muted leading-relaxed">
              {{ item.description }}
            </p>

            <ul class="space-y-2 pt-2 border-t border-line/60">
              <li
                v-for="(bullet, bIdx) in item.details"
                :key="bIdx"
                class="flex items-center gap-2 text-xs text-muted"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-brand-blue shrink-0" />
                <span>{{ bullet }}</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Code & Invariant Guarantee Card -->
      <div class="mt-12 rounded-lg border border-line bg-code/40 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
        <div class="space-y-2 text-left">
          <h4 class="text-base font-bold text-ink font-mono flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-brand-green animate-pulse" />
            100% Deterministic &amp; Reproducible
          </h4>
          <p class="text-sm text-muted max-w-2xl">
            Every simulation seed, weight initialization, and tensor projection can be paused, inspected in memory, or replayed step-by-step.
          </p>
        </div>

        <NuxtLink
          to="/#studios"
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-card border border-line hover:border-line-strong text-ink text-xs font-mono font-semibold shadow-xs transition-colors shrink-0"
        >
          Explore All Studios
        </NuxtLink>
      </div>
    </div>
  </section>
</template>

