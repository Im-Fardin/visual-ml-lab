<script setup lang="ts">
import { ArrowLeft, Box, Clock, CheckCircle2 } from 'lucide-vue-next'

useHead({
  title: 'Data Analytics 3D Lab — ML & Data Visualizer'
})

const upcomingTools = [
  { name: '0D to 3D Tensor Explorer', desc: 'Scalars, vectors, matrices, and 3D volume tensors with slicing axes' },
  { name: 'Matrix Transposition & Multiplication', desc: 'Step-by-step dot products, row-by-column visual animation' },
  { name: 'Vector Dot & Cross Product', desc: 'Geometric projection, orthogonal vectors, cosine similarity angles' },
  { name: 'Covariance & Eigenvectors', desc: 'Ellipsoid principal axes, variance along coordinates, spectral theory' },
  { name: 'Probability Distribution Sandbox', desc: 'Gaussian/Normal, Poisson, Bernoulli, and CDF/PDF interactors' }
]
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
    <NuxtLink
      to="/"
      class="inline-flex items-center gap-2 text-sm font-mono text-muted hover:text-brand-amber mb-8 transition-colors"
    >
      <ArrowLeft class="w-4 h-4" />
      <span>Back to Overview</span>
    </NuxtLink>

    <div class="rounded-lg border border-line bg-card p-8 sm:p-12 shadow-sm space-y-8">
      <!-- Header Badge -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-lg bg-brand-amber-soft border border-brand-amber/20 text-brand-amber flex items-center justify-center">
            <Box class="w-6 h-6" />
          </div>
          <div>
            <span class="text-xs font-mono uppercase tracking-wider text-muted">Studio Phase 03</span>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-ink">
              Data Analytics 3D Lab: Coming Soon
            </h1>
          </div>
        </div>

        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-brand-amber-soft text-brand-amber border border-brand-amber/20">
          <Clock class="w-3.5 h-3.5" /> Under Construction
        </span>
      </div>

      <p class="text-base text-muted leading-relaxed">
        The Data Analytics 3D Lab focuses on the linear algebraic foundations of modern machine learning. Explore multi-dimensional tensors, matrix transformations, geometric dot product projections, and probability density functions in interactive 3D space.
      </p>

      <!-- Upcoming Tools List -->
      <div class="space-y-4 pt-4 border-t border-line">
        <h2 class="text-sm font-mono font-bold uppercase tracking-wider text-ink">
          Scheduled Tensor &amp; Algebraic Tools
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            v-for="(item, idx) in upcomingTools"
            :key="idx"
            class="p-4 rounded-md border border-line bg-card-subtle flex items-start gap-3"
          >
            <CheckCircle2 class="w-4 h-4 text-brand-amber mt-0.5 shrink-0" />
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

