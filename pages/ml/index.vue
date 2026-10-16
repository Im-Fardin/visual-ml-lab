<script setup lang="ts">
import { ArrowLeft, Binary, Clock, CheckCircle2 } from 'lucide-vue-next'

useHead({
  title: 'Classic ML Studio — ML & Data Visualizer'
})

const upcomingAlgorithms = [
  { name: 'Linear & Polynomial SVM', desc: 'Soft & hard margins, support vector highlights, slack penalty C slider' },
  { name: 'Logistic Regression', desc: 'Sigmoid boundary probabilities, decision contours, binary & multiclass' },
  { name: 'Interactive Decision Trees', desc: 'Gini impurity / entropy tree branching, recursive split visualizer' },
  { name: 'K-Means Clustering', desc: 'Step-by-step Voronoi tessellation, centroid relocation, inertia elbow curve' },
  { name: 'Principal Component Analysis (PCA)', desc: 'Covariance eigenvectors, variance explained ratio, 2D projection' }
]
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
    <NuxtLink
      to="/"
      class="inline-flex items-center gap-2 text-sm font-mono text-muted hover:text-brand-blue mb-8 transition-colors"
    >
      <ArrowLeft class="w-4 h-4" />
      <span>Back to Overview</span>
    </NuxtLink>

    <div class="rounded-lg border border-line bg-card p-8 sm:p-12 shadow-sm space-y-8">
      <!-- Header Badge -->
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-lg bg-brand-blue-soft border border-brand-blue/20 text-brand-blue flex items-center justify-center">
            <Binary class="w-6 h-6" />
          </div>
          <div>
            <span class="text-xs font-mono uppercase tracking-wider text-muted">Studio Phase 01</span>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-ink">
              ML Studio: Coming Soon
            </h1>
          </div>
        </div>

        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-brand-amber-soft text-brand-amber border border-brand-amber/20">
          <Clock class="w-3.5 h-3.5" /> Under Construction
        </span>
      </div>

      <p class="text-base text-muted leading-relaxed">
        The Classic Machine Learning Studio is being developed with zero-latency 2D Canvas visualizations for supervised and unsupervised algorithms. In the next phase, you will be able to place data points, tweak hyper-parameters, and step through training algorithms in real time.
      </p>

      <!-- Upcoming Algorithms List -->
      <div class="space-y-4 pt-4 border-t border-line">
        <h2 class="text-sm font-mono font-bold uppercase tracking-wider text-ink">
          Scheduled Mathematical Kernels
        </h2>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div
            v-for="(item, idx) in upcomingAlgorithms"
            :key="idx"
            class="p-4 rounded-md border border-line bg-card-subtle flex items-start gap-3"
          >
            <CheckCircle2 class="w-4 h-4 text-brand-blue mt-0.5 shrink-0" />
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

