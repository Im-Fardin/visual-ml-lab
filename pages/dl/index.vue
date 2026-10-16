<script setup lang="ts">
import { ArrowLeft, BrainCircuit, Clock, CheckCircle2 } from 'lucide-vue-next'

useHead({
  title: 'Deep Learning Studio — ML & Data Visualizer'
})

const upcomingModules = [
  { name: 'Multi-Layer Perceptrons (MLP)', desc: 'Arbitrary layer depth, node activations, forward computation flow' },
  { name: '3D Loss Landscapes', desc: 'Convex & non-convex loss surfaces rendered via WebGL with saddle points' },
  { name: 'Optimizers in Action', desc: 'Direct side-by-side comparison of SGD, Momentum, RMSprop, and Adam' },
  { name: 'Activation Explorer', desc: 'Interactive curve inspect for ReLU, LeakyReLU, Sigmoid, Tanh, and GELU' },
  { name: 'Backprop Graph Debugger', desc: 'Step-by-step chain rule partial derivative inspector for every node' }
]
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
    <NuxtLink
      to="/"
      class="inline-flex items-center gap-2 text-sm font-mono text-muted hover:text-brand-purple mb-8 transition-colors"
    >
      <ArrowLeft class="w-4 h-4" />
      <span>Back to Overview</span>
    </NuxtLink>

    <div class="rounded-lg border border-line bg-card p-8 sm:p-12 shadow-sm space-y-8">
      <!-- Header Badge -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-lg bg-brand-purple-soft border border-brand-purple/20 text-brand-purple flex items-center justify-center">
            <BrainCircuit class="w-6 h-6" />
          </div>
          <div>
            <span class="text-xs font-mono uppercase tracking-wider text-muted">Studio Phase 02</span>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-ink">
              Deep Learning Studio: Coming Soon
            </h1>
          </div>
        </div>

        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-brand-amber-soft text-brand-amber border border-brand-amber/20">
          <Clock class="w-3.5 h-3.5" /> Under Construction
        </span>
      </div>

      <p class="text-base text-muted leading-relaxed">
        The Deep Learning Studio will provide interactive computational graphs and 3D loss surface visualizations. Step through backpropagation gradients, test vanishing and exploding gradient behaviors, and inspect how optimizers navigate complex loss topographies.
      </p>

      <!-- Upcoming Modules List -->
      <div class="space-y-4 pt-4 border-t border-line">
        <h2 class="text-sm font-mono font-bold uppercase tracking-wider text-ink">
          Scheduled Neural Components
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            v-for="(item, idx) in upcomingModules"
            :key="idx"
            class="p-4 rounded-md border border-line bg-card-subtle flex items-start gap-3"
          >
            <CheckCircle2 class="w-4 h-4 text-brand-purple mt-0.5 shrink-0" />
            <div>
              <h3 class="text-sm font-bold text-ink">{{ item.name }}</h3>
              <p class="text-xs text-muted mt-0.5">{{ item.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

