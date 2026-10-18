<script setup lang="ts">
import { ArrowLeft, Binary, Clock, CheckCircle2, Sparkles, ArrowRight } from 'lucide-vue-next'

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
            <span class="text-xs font-mono uppercase tracking-wider text-muted">Track 02 • Machine Learning</span>
            <h1 class="text-2xl sm:text-3xl font-extrabold text-ink">
              Machine Learning Studio
            </h1>
          </div>
        </div>

        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-brand-blue-soft text-brand-blue border border-brand-blue/20">
          <Sparkles class="w-3.5 h-3.5" /> Stage 36 Live
        </span>
      </div>

      <p class="text-base text-muted leading-relaxed">
        The Classic Machine Learning Studio provides zero-latency 2D Canvas visualizations for supervised and unsupervised algorithms. Manipulate loss surfaces, tweak model weights, and step through mathematical training algorithms in real time.
      </p>

      <!-- Active Live Stage 36 Card -->
      <div class="rounded-xl border border-brand-blue/30 bg-brand-blue-soft/20 p-6 space-y-4">
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-brand-blue text-white shadow-2xs">
            <Sparkles class="w-3.5 h-3.5" /> Module 1: ML Foundations &amp; Training Engine
          </div>
          <span class="text-xs font-mono font-bold text-brand-blue">Stage #36</span>
        </div>

        <div>
          <h2 class="text-lg sm:text-xl font-bold text-ink">
            36 • Manual Regression: Loss Surface, Error Squares &amp; The Geometry of OLS
          </h2>
          <p class="text-xs sm:text-sm text-muted mt-1 leading-relaxed">
            Interactive manual parameter exploration ($w, b$), visualizing geometric squared error areas, centroid pivot invariants, and analytical OLS minimums.
          </p>
        </div>

        <div class="pt-1 flex items-center justify-between flex-wrap gap-3">
          <div class="flex flex-wrap gap-1.5">
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-card border border-line text-muted">Linear Regression</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-card border border-line text-muted">MSE Loss</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-card border border-line text-muted">Convex Optimization</span>
          </div>

          <NuxtLink
            to="/analytics/manual-regression"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-brand-blue hover:bg-brand-blue-hover text-white text-xs font-mono font-bold transition-all shadow-sm"
          >
            <span>Launch Stage 36</span>
            <ArrowRight class="w-4 h-4" />
          </NuxtLink>
        </div>
      </div>

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

