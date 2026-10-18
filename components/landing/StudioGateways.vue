<script setup lang="ts">
import {
  Binary,
  BrainCircuit,
  Box,
  ArrowRight,
  CheckCircle2,
  Sliders,
  TrendingUp,
  Cpu
} from 'lucide-vue-next'

const studios = [
  {
    id: 'ml',
    title: 'Classic ML Studio',
    subtitle: 'Parametric & Non-Parametric Modeling',
    description:
      'Inspect decision boundaries, support vectors, tree splits, and cluster centroids directly in 2D space. Manipulate regularizations and hyperplanes with immediate feedback.',
    href: '/ml',
    badge: 'Supervised & Unsupervised',
    colorClass: 'text-brand-blue',
    bgBadgeClass: 'bg-brand-blue-soft text-brand-blue border-brand-blue/20',
    btnClass: 'bg-brand-blue hover:bg-brand-blue-hover text-white',
    icon: Binary,
    features: [
      'Stage 36: Manual Regression & Loss Geometry (Live)',
      'Linear & Polynomial SVM with Margin Bounds',
      'Logistic Regression with Decision Contours',
      'Interactive Decision Trees & Entropy Splitting',
      'K-Means Clustering with Centroid Convergence'
    ]
  },
  {
    id: 'dl',
    title: 'Deep Learning Studio',
    subtitle: 'Neural Architectures & Backpropagation',
    description:
      'Step through forward and backward passes layer-by-layer. Explore 3D loss surface landscapes, observe momentum trajectories in SGD/Adam, and debug vanishing gradients.',
    href: '/dl',
    badge: 'Neural Computation',
    colorClass: 'text-brand-purple',
    bgBadgeClass: 'bg-brand-purple-soft text-brand-purple border-brand-purple/20',
    btnClass: 'bg-brand-purple hover:bg-brand-purple-hover text-white',
    icon: BrainCircuit,
    features: [
      'Multi-Layer Perceptrons (MLP) with Custom Depths',
      'Interactive 3D Loss Landscapes & Convexity',
      'Optimizers in Action: SGD, Momentum, RMSprop, Adam',
      'Activation Function Visualizer (ReLU, GELU, Sigmoid)',
      'Step-by-Step Computational Graph Backprop'
    ]
  },
  {
    id: 'analytics',
    title: 'Data Analytics 3D Lab',
    subtitle: 'High-Dimensional Linear Algebra & Tensors',
    description:
      'Visualize tensors from 0D scalars to 3D rank-3 cubes. Understand matrix transposition, dot products, covariance transforms, and empirical probability distributions.',
    href: '/analytics',
    badge: 'Linear Algebra & Tensors',
    colorClass: 'text-brand-amber',
    bgBadgeClass: 'bg-brand-amber-soft text-brand-amber border-brand-amber/20',
    btnClass: 'bg-brand-amber hover:bg-brand-amber-hover text-white',
    icon: Box,
    features: [
      '0D to 3D Rank Tensor Visualizer with Slicing',
      'Interactive Matrix Multiplication & Transpose',
      'Vector Dot Product & Geometric Projections',
      'Covariance Matrices & Eigenvector Rotation',
      'Continuous & Discrete Probability Distributions'
    ]
  }
]
</script>

<template>
  <section id="studios" class="py-16 sm:py-20 border-t border-line bg-card-subtle/50 transition-colors">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <!-- Section Header -->
      <div class="text-center max-w-3xl mx-auto space-y-4 mb-14">
        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium bg-card border border-line text-muted shadow-xs">
          <span>Three Dedicated Studios</span>
        </div>
        <h2 class="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
          Explore the Three Pillars of Machine Learning
        </h2>
        <p class="text-muted text-base sm:text-lg">
          Each studio provides an isolated, highly focused simulation environment built with explicit controls and pure client-side mathematical engines.
        </p>
      </div>

      <!-- Studio Cards Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div
          v-for="studio in studios"
          :key="studio.id"
          class="rounded-lg border border-line bg-card p-6 sm:p-7 flex flex-col justify-between shadow-sm hover:shadow-md hover:border-line-strong transition-all group"
        >
          <div class="space-y-5">
            <!-- Header Icon & Badge -->
            <div class="flex items-center justify-between">
              <div
                class="w-12 h-12 rounded-lg flex items-center justify-center border border-line"
                :class="studio.bgBadgeClass"
              >
                <component :is="studio.icon" class="w-6 h-6" />
              </div>
              <span
                class="text-[11px] font-mono px-2.5 py-1 rounded-full border"
                :class="studio.bgBadgeClass"
              >
                {{ studio.badge }}
              </span>
            </div>

            <!-- Titles -->
            <div>
              <h3 class="text-xl font-bold text-ink group-hover:text-brand-blue transition-colors">
                {{ studio.title }}
              </h3>
              <p class="text-xs font-mono text-muted mt-1">
                {{ studio.subtitle }}
              </p>
            </div>

            <!-- Description -->
            <p class="text-sm text-muted leading-relaxed">
              {{ studio.description }}
            </p>

            <!-- Features Checklist -->
            <div class="pt-2 border-t border-line/60">
              <h4 class="text-xs font-mono uppercase tracking-wider text-ink font-semibold mb-3">
                Key Modules
              </h4>
              <ul class="space-y-2">
                <li
                  v-for="(feature, idx) in studio.features"
                  :key="idx"
                  class="flex items-start gap-2 text-xs text-muted"
                >
                  <CheckCircle2 class="w-3.5 h-3.5 text-brand-green mt-0.5 shrink-0" />
                  <span>{{ feature }}</span>
                </li>
              </ul>
            </div>
          </div>

          <!-- Gateway Routing Action -->
          <div class="pt-6 mt-6 border-t border-line">
            <NuxtLink
              :to="studio.href"
              class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold shadow-xs transition-all group-hover:translate-x-0.5"
              :class="studio.btnClass"
            >
              <span>Launch Studio</span>
              <ArrowRight class="w-4 h-4" />
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

