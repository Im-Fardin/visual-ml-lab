<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  ArrowLeft,
  Binary,
  Clock,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Search,
  X,
  Sliders,
  TrendingUp,
  Layers,
  Zap,
  Target
} from 'lucide-vue-next'
import { ML_MODULES, ML_TOPICS, type MLTopic } from '~/data/mlCurriculum'

useHead({
  title: 'Classic ML Studio — ML & Data Visualizer',
  meta: [
    {
      name: 'description',
      content:
        'Zero-latency 2D Canvas visualizations for supervised and unsupervised algorithms. Manipulate loss surfaces, tweak model weights, and step through mathematical training algorithms in real time.'
    }
  ]
})

const searchQuery = ref('')
const selectedModule = ref<string>('all')

const filteredLiveTopics = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return ML_TOPICS.filter((topic) => {
    const matchesModule =
      selectedModule.value === 'all' || topic.moduleId === selectedModule.value
    if (!matchesModule) return false

    if (!query) return true

    const inTitle = topic.title.toLowerCase().includes(query)
    const inDesc = topic.shortDesc.toLowerCase().includes(query)
    const inTags = topic.tags.some((t) => t.toLowerCase().includes(query))
    const inInvariant = topic.invariant.toLowerCase().includes(query)

    return inTitle || inDesc || inTags || inInvariant
  })
})

const upcomingAlgorithms = [
  {
    moduleId: 'linear-models',
    moduleTitle: 'Module 2: Linear & Generalized Models',
    name: 'Linear & Polynomial SVM',
    desc: 'Soft & hard margins, support vector highlights, slack penalty C slider, and kernel trick projections.'
  },
  {
    moduleId: 'linear-models',
    moduleTitle: 'Module 2: Linear & Generalized Models',
    name: 'Logistic Regression',
    desc: 'Sigmoid boundary probabilities, binary cross-entropy log-loss, decision contours, and multi-class softmax.'
  },
  {
    moduleId: 'trees-ensembles',
    moduleTitle: 'Module 3: Decision Trees & Ensembles',
    name: 'Interactive Decision Trees',
    desc: 'Gini impurity / entropy tree branching, recursive split visualizer, and feature importance analysis.'
  },
  {
    moduleId: 'unsupervised',
    moduleTitle: 'Module 4: Unsupervised & Clustering',
    name: 'K-Means Clustering',
    desc: 'Step-by-step Voronoi tessellation, centroid relocation, inertia elbow curve, and silhouette analysis.'
  },
  {
    moduleId: 'unsupervised',
    moduleTitle: 'Module 4: Unsupervised & Clustering',
    name: 'Principal Component Analysis (PCA)',
    desc: 'Covariance eigenvectors, variance explained ratio, orthogonal 2D projections, and dimensionality reduction.'
  }
]

const filteredUpcomingAlgorithms = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return upcomingAlgorithms.filter((algo) => {
    const matchesModule =
      selectedModule.value === 'all' || algo.moduleId === selectedModule.value
    if (!matchesModule) return false

    if (!query) return true
    return algo.name.toLowerCase().includes(query) || algo.desc.toLowerCase().includes(query)
  })
})
</script>

<template>
  <div class="min-h-screen bg-bg transition-colors duration-200 pb-20">
    <!-- Hub Hero Header -->
    <section class="border-b border-line bg-card/60 backdrop-blur-sm pt-10 pb-12 sm:pt-14 sm:pb-16 transition-colors">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <!-- Breadcrumb Link Back to Overview -->
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-2 text-xs font-mono text-muted hover:text-brand-blue transition-colors"
        >
          <ArrowLeft class="w-3.5 h-3.5" />
          <span>Back to Overview</span>
        </NuxtLink>

        <!-- Top Badge -->
        <div class="flex items-center justify-between flex-wrap gap-4">
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium bg-brand-blue-soft text-brand-blue border border-brand-blue/20">
            <Binary class="w-3.5 h-3.5" />
            <span>Track 02 • Machine Learning Studio</span>
          </div>

          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-brand-green-soft text-brand-green border border-brand-green/20">
              <Sparkles class="w-3.5 h-3.5" /> {{ ML_TOPICS.length }} Live Stages
            </span>
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-card text-muted border border-line">
              <Clock class="w-3.5 h-3.5" /> 5 Scheduled Kernels
            </span>
          </div>
        </div>

        <div class="max-w-3xl space-y-3">
          <h1 class="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
            Classic Machine Learning Studio
          </h1>
          <p class="text-muted text-base sm:text-lg leading-relaxed">
            Zero-latency 2D Canvas and SVG vector visualizations for parametric and non-parametric learning.
            Manipulate loss surfaces, inspect backpropagation computational graphs, tweak hyperparameters, and observe convergence in real time.
          </p>
        </div>

        <!-- Search & Module Filter Pills Bar -->
        <div class="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <!-- Search Input -->
          <div class="relative flex-1 max-w-md">
            <Search class="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Filter ML topics (e.g., Regression, Gradient Descent, OLS)..."
              class="w-full pl-9 pr-9 py-2 rounded-md border border-line bg-card text-ink placeholder:text-muted/60 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue transition-all"
            />
            <button
              v-if="searchQuery"
              type="button"
              @click="searchQuery = ''"
              class="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Module Tabs Pills -->
          <div class="inline-flex items-center rounded-md border border-line bg-card p-1 text-xs font-mono overflow-x-auto shrink-0">
            <button
              type="button"
              @click="selectedModule = 'all'"
              class="px-3 py-1.5 rounded transition-colors whitespace-nowrap"
              :class="selectedModule === 'all' ? 'bg-brand-blue text-white font-semibold shadow-xs' : 'text-muted hover:text-ink'"
            >
              All ({{ ML_TOPICS.length + upcomingAlgorithms.length }})
            </button>
            <button
              type="button"
              @click="selectedModule = 'foundations'"
              class="px-3 py-1.5 rounded transition-colors whitespace-nowrap"
              :class="selectedModule === 'foundations' ? 'bg-brand-blue text-white font-semibold shadow-xs' : 'text-muted hover:text-ink'"
            >
              Foundations ({{ ML_TOPICS.length }})
            </button>
            <button
              type="button"
              @click="selectedModule = 'linear-models'"
              class="px-3 py-1.5 rounded transition-colors whitespace-nowrap"
              :class="selectedModule === 'linear-models' ? 'bg-brand-purple text-white font-semibold shadow-xs' : 'text-muted hover:text-ink'"
            >
              Linear Models
            </button>
            <button
              type="button"
              @click="selectedModule = 'trees-ensembles'"
              class="px-3 py-1.5 rounded transition-colors whitespace-nowrap"
              :class="selectedModule === 'trees-ensembles' ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'text-muted hover:text-ink'"
            >
              Decision Trees
            </button>
            <button
              type="button"
              @click="selectedModule = 'unsupervised'"
              class="px-3 py-1.5 rounded transition-colors whitespace-nowrap"
              :class="selectedModule === 'unsupervised' ? 'bg-brand-amber text-white font-semibold shadow-xs' : 'text-muted hover:text-ink'"
            >
              Clustering &amp; PCA
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Main Content Area -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 space-y-12">
      <!-- Section: Interactive Live Stages -->
      <section v-if="filteredLiveTopics.length > 0" class="space-y-6">
        <div class="flex items-center justify-between border-b border-line pb-3">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-brand-green animate-pulse" />
            <h2 class="text-base sm:text-lg font-bold text-ink font-mono uppercase tracking-wider">
              Interactive ML Stages (Ready to Launch)
            </h2>
          </div>
          <span class="text-xs font-mono text-muted">
            {{ filteredLiveTopics.length }} interactive simulations
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div
            v-for="topic in filteredLiveTopics"
            :key="topic.id"
            class="rounded-xl border border-line bg-card p-6 flex flex-col justify-between shadow-xs hover:shadow-md hover:border-brand-blue/50 hover:-translate-y-0.5 transition-all group duration-200"
          >
            <div class="space-y-4">
              <!-- Top Badges -->
              <div class="flex items-center justify-between gap-2 flex-wrap">
                <span class="text-[11px] font-mono px-2.5 py-0.5 rounded-full border font-medium bg-brand-blue-soft text-brand-blue border-brand-blue/20">
                  {{ topic.moduleTitle }}
                </span>

                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-brand-green-soft text-brand-green border border-brand-green/20">
                    <Sparkles class="w-3 h-3" /> Live Stage
                  </span>
                  <span class="font-mono text-xs font-bold text-brand-blue">
                    Stage #{{ topic.stageNumber }}
                  </span>
                </div>
              </div>

              <!-- Title & Formula -->
              <div>
                <NuxtLink :to="`/ml/${topic.slug}`" class="block focus:outline-none">
                  <h3 class="text-lg font-bold text-ink group-hover:text-brand-blue transition-colors leading-snug">
                    {{ topic.title }}
                  </h3>
                </NuxtLink>
                <p class="text-xs text-muted font-mono mt-1">
                  {{ topic.shapeFormula }}
                </p>
              </div>

              <!-- Description -->
              <p class="text-xs sm:text-sm text-muted leading-relaxed line-clamp-3">
                {{ topic.shortDesc }}
              </p>

              <!-- Invariant Callout -->
              <div class="p-2.5 rounded-md bg-card-subtle border border-line text-[11px] font-mono text-ink/80 flex items-start gap-2">
                <Target class="w-3.5 h-3.5 text-brand-blue shrink-0 mt-0.5" />
                <span>{{ topic.invariant }}</span>
              </div>

              <!-- Tag Pills -->
              <div class="flex flex-wrap gap-1.5 pt-1">
                <span
                  v-for="tag in topic.tags"
                  :key="tag"
                  class="text-[10px] font-mono px-2 py-0.5 rounded bg-card-subtle border border-line text-muted"
                >
                  {{ tag }}
                </span>
              </div>
            </div>

            <!-- Action Launch Button -->
            <div class="pt-5 mt-5 border-t border-line/70">
              <NuxtLink
                :to="`/ml/${topic.slug}`"
                class="w-full inline-flex items-center justify-between px-4 py-2.5 rounded-md text-xs font-mono font-bold bg-brand-blue hover:bg-brand-blue-hover text-white transition-all shadow-xs group-hover:shadow-sm"
              >
                <span>Launch Stage #{{ topic.stageNumber }} in ML Studio</span>
                <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </NuxtLink>
            </div>
          </div>
        </div>
      </section>

      <!-- Section: Scheduled Upcoming Kernels -->
      <section v-if="filteredUpcomingAlgorithms.length > 0" class="space-y-6 pt-6">
        <div class="flex items-center justify-between border-b border-line pb-3">
          <div class="flex items-center gap-2">
            <Clock class="w-4 h-4 text-brand-amber" />
            <h2 class="text-base sm:text-lg font-bold text-ink font-mono uppercase tracking-wider">
              Scheduled Mathematical Kernels (Roadmap)
            </h2>
          </div>
          <span class="text-xs font-mono text-muted">
            {{ filteredUpcomingAlgorithms.length }} kernels in pipeline
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="(item, idx) in filteredUpcomingAlgorithms"
            :key="idx"
            class="p-4 rounded-lg border border-line bg-card/60 flex items-start gap-3.5 hover:border-line-strong transition-colors"
          >
            <div class="w-8 h-8 rounded-md bg-card-subtle border border-line flex items-center justify-center shrink-0 text-muted mt-0.5">
              <CheckCircle2 class="w-4 h-4 text-brand-blue" />
            </div>
            <div class="space-y-1 min-w-0">
              <span class="text-[10px] font-mono uppercase text-muted tracking-wider block">
                {{ item.moduleTitle.split(':')[0] }}
              </span>
              <h3 class="text-sm font-bold text-ink leading-tight">{{ item.name }}</h3>
              <p class="text-xs text-muted leading-relaxed">{{ item.desc }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Empty State if query has zero matches -->
      <div
        v-if="filteredLiveTopics.length === 0 && filteredUpcomingAlgorithms.length === 0"
        class="text-center py-16 space-y-4 rounded-lg border border-line bg-card p-8"
      >
        <p class="text-muted text-sm font-mono">No ML algorithms match "{{ searchQuery }}"</p>
        <button
          type="button"
          @click="searchQuery = ''; selectedModule = 'all'"
          class="px-4 py-2 rounded-md bg-brand-blue text-white text-xs font-mono font-medium hover:bg-brand-blue-hover transition-colors"
        >
          Reset Filters
        </button>
      </div>
    </main>
  </div>
</template>
