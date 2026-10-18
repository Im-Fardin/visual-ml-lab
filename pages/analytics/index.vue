<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search, Sparkles, Filter, X, Box, Terminal, BarChart2 } from 'lucide-vue-next'
import { ANALYTICS_PARTS, ANALYTICS_TOPICS, type AnalyticsTopic } from '~/data/analyticsCurriculum'
import ModuleCard from '~/components/analytics/ModuleCard.vue'

useHead({
  title: 'Data Analytics 3D Lab — ML & Data Visualizer',
  meta: [
    {
      name: 'description',
      content:
        'Explore 3D/2D visual animations, manipulate mathematical parameters in real time, and inspect executable Python/NumPy/Pandas code.'
    }
  ]
})

const searchQuery = ref('')
const selectedPart = ref<'all' | 'numpy' | 'pandas' | 'preprocessing' | 'statistics' | 'machine-learning' | 'ml'>('all')

// Filtered topics
const filteredTopics = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  return ANALYTICS_TOPICS.filter((topic) => {
    const matchesPart =
      selectedPart.value === 'all' ||
      topic.partId === selectedPart.value ||
      (selectedPart.value === 'machine-learning' && (topic.partId === 'ml' || topic.partId === 'machine-learning' || topic.track === 'machine-learning')) ||
      (selectedPart.value === 'ml' && (topic.partId === 'ml' || topic.partId === 'machine-learning' || topic.track === 'machine-learning'))
    if (!matchesPart) return false

    if (!query) return true

    const inTitle = topic.title.toLowerCase().includes(query)
    const inDesc = topic.shortDesc.toLowerCase().includes(query)
    const inTags = topic.tags.some((t) => t.toLowerCase().includes(query))
    const inInvariant = topic.invariant.toLowerCase().includes(query)
    const inId = topic.id.includes(query)

    return inTitle || inDesc || inTags || inInvariant || inId
  })
})

// Group topics by part if 'all' is selected and no search query
const topicsByPart = computed(() => {
  return ANALYTICS_PARTS.map((part) => {
    const items = filteredTopics.value.filter((t) => t.partId === part.id)
    return {
      part,
      items
    }
  }).filter((group) => group.items.length > 0)
})

const clearSearch = () => {
  searchQuery.value = ''
  selectedPart.value = 'all'
}
</script>

<template>
  <div class="min-h-screen bg-bg transition-colors duration-200 pb-20">
    <!-- Hub Hero Header -->
    <section class="border-b border-line bg-card/60 backdrop-blur-sm pt-10 pb-12 sm:pt-14 sm:pb-16 transition-colors">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <!-- Top Badge -->
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium bg-brand-amber-soft text-brand-amber border border-brand-amber/20">
          <Box class="w-3.5 h-3.5" />
          <span>Interactive 3D Linear Algebra &amp; Tabular Computation</span>
        </div>

        <div class="max-w-3xl space-y-3">
          <h1 class="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight">
            Data Analytics 3D Lab
          </h1>
          <p class="text-muted text-base sm:text-lg leading-relaxed">
            Manipulate high-dimensional tensors, witness real-time matrix transpositions, step through dot-product vector projections, and inspect production Python code.
          </p>
        </div>

        <!-- Search & Category Filters Bar -->
        <div class="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <!-- Search Input -->
          <div class="relative flex-1 max-w-md">
            <Search class="w-4 h-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Filter topics (e.g., Transpose, Tensor, Dot Product)..."
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

          <!-- Part Tabs Pills -->
          <div class="inline-flex items-center rounded-md border border-line bg-card p-1 text-xs font-mono overflow-x-auto shrink-0">
            <button
              type="button"
              @click="selectedPart = 'all'"
              class="px-3 py-1.5 rounded transition-colors whitespace-nowrap"
              :class="selectedPart === 'all' ? 'bg-brand-blue text-white font-semibold shadow-xs' : 'text-muted hover:text-ink'"
            >
              All ({{ ANALYTICS_TOPICS.length }})
            </button>
            <button
              type="button"
              @click="selectedPart = 'numpy'"
              class="px-3 py-1.5 rounded transition-colors whitespace-nowrap"
              :class="selectedPart === 'numpy' ? 'bg-brand-blue text-white font-semibold shadow-xs' : 'text-muted hover:text-ink'"
            >
              NumPy
            </button>
            <button
              type="button"
              @click="selectedPart = 'pandas'"
              class="px-3 py-1.5 rounded transition-colors whitespace-nowrap"
              :class="selectedPart === 'pandas' ? 'bg-brand-purple text-white font-semibold shadow-xs' : 'text-muted hover:text-ink'"
            >
              Pandas
            </button>
            <button
              type="button"
              @click="selectedPart = 'preprocessing'"
              class="px-3 py-1.5 rounded transition-colors whitespace-nowrap"
              :class="selectedPart === 'preprocessing' ? 'bg-emerald-600 text-white font-semibold shadow-xs' : 'text-muted hover:text-ink'"
            >
              Preprocessing
            </button>
            <button
              type="button"
              @click="selectedPart = 'statistics'"
              class="px-3 py-1.5 rounded transition-colors whitespace-nowrap"
              :class="selectedPart === 'statistics' ? 'bg-brand-amber text-white font-semibold shadow-xs' : 'text-muted hover:text-ink'"
            >
              Statistics
            </button>
            <button
              type="button"
              @click="selectedPart = 'machine-learning'"
              class="px-3 py-1.5 rounded transition-colors whitespace-nowrap"
              :class="selectedPart === 'machine-learning' ? 'bg-brand-blue text-white font-semibold shadow-xs' : 'text-muted hover:text-ink'"
            >
              Machine Learning
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Main Catalog Grid Area -->
    <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
      <!-- Empty State -->
      <div
        v-if="filteredTopics.length === 0"
        class="text-center py-20 rounded-lg border border-dashed border-line bg-card p-8 space-y-4"
      >
        <div class="w-12 h-12 rounded-full bg-card-subtle border border-line text-muted mx-auto flex items-center justify-center">
          <Search class="w-5 h-5" />
        </div>
        <h3 class="text-base font-bold text-ink">
          No matching modules found
        </h3>
        <p class="text-xs text-muted max-w-sm mx-auto font-mono">
          No modules match "<span class="text-ink font-semibold">{{ searchQuery }}</span>". Try searching for keywords like "Tensor", "Transpose", "Dot Product", or "Gaussian".
        </p>
        <button
          type="button"
          @click="clearSearch"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-blue text-white text-xs font-mono font-medium shadow-xs"
        >
          Reset Filters
        </button>
      </div>

      <!-- Grouped or Filtered Display -->
      <div v-else class="space-y-12">
        <div
          v-for="group in topicsByPart"
          :key="group.part.id"
          class="space-y-4"
        >
          <!-- Part Header -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-line pb-3 gap-2">
            <div>
              <h2 class="text-xl font-bold text-ink flex items-center gap-2">
                <span
                  class="w-2.5 h-2.5 rounded-full"
                  :class="group.part.id === 'numpy' ? 'bg-brand-blue' : group.part.id === 'pandas' ? 'bg-brand-purple' : group.part.id === 'preprocessing' ? 'bg-emerald-600' : group.part.id === 'machine-learning' || group.part.id === 'ml' ? 'bg-brand-blue' : 'bg-brand-amber'"
                />
                {{ group.part.title }}
              </h2>
              <p class="text-xs text-muted mt-0.5">
                {{ group.part.desc }}
              </p>
            </div>
            <span class="text-xs font-mono text-muted">
              {{ group.items.length }} {{ group.items.length === 1 ? 'module' : 'modules' }}
            </span>
          </div>

          <!-- Cards Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <ModuleCard
              v-for="topic in group.items"
              :key="topic.id"
              :topic="topic"
            />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
