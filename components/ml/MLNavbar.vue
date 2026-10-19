<script setup lang="ts">
import { ArrowLeft, ChevronLeft, ChevronRight, Binary, Sparkles } from 'lucide-vue-next'
import { ML_TOPICS, type MLTopic } from '~/data/mlCurriculum'

defineProps<{
  currentTopic: MLTopic
  prevTopic: MLTopic | null
  nextTopic: MLTopic | null
}>()
</script>

<template>
  <nav class="w-full shrink-0 border-b border-line bg-card/90 backdrop-blur-md px-4 sm:px-6 py-2.5 transition-colors z-20">
    <div class="max-w-7xl mx-auto flex items-center justify-between gap-3">
      <!-- Breadcrumb & Back Link to ML Studio Catalog -->
      <div class="flex items-center gap-3 min-w-0">
        <NuxtLink
          to="/ml"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium text-muted hover:text-ink hover:bg-card-subtle border border-line transition-colors shrink-0"
          title="Return to Classic ML Studio catalog"
        >
          <ArrowLeft class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">ML Studio</span>
          <span class="sm:hidden">ML</span>
        </NuxtLink>

        <span class="text-line hidden sm:inline">/</span>

        <!-- Active Topic Badge & Title -->
        <div class="flex items-center gap-2 min-w-0 truncate">
          <span
            class="text-[10px] font-mono uppercase px-2 py-0.5 rounded border shrink-0 hidden md:inline bg-brand-blue-soft text-brand-blue border-brand-blue/20"
          >
            {{ currentTopic.moduleTitle }}
          </span>
          <h1 class="text-xs sm:text-sm font-bold text-ink truncate font-mono">
            {{ currentTopic.title }}
          </h1>
        </div>
      </div>

      <!-- Prev / Next Topic Stepper Controls within ML Studio -->
      <div class="flex items-center gap-1.5 shrink-0">
        <NuxtLink
          v-if="prevTopic"
          :to="`/ml/${prevTopic.slug}`"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono text-muted hover:text-ink hover:bg-card-subtle border border-line transition-colors"
          :title="`Previous: ${prevTopic.title}`"
        >
          <ChevronLeft class="w-3.5 h-3.5" />
          <span class="hidden md:inline">Prev</span>
        </NuxtLink>
        <span
          v-else
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono text-muted/40 border border-line/40 cursor-not-allowed"
        >
          <ChevronLeft class="w-3.5 h-3.5" />
          <span class="hidden md:inline">Prev</span>
        </span>

        <span class="text-xs font-mono text-muted px-1 hidden sm:inline">
          Stage #{{ currentTopic.stageNumber }} ({{ ML_TOPICS.findIndex(t => t.id === currentTopic.id) + 1 }}/{{ ML_TOPICS.length }})
        </span>

        <NuxtLink
          v-if="nextTopic"
          :to="`/ml/${nextTopic.slug}`"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono text-muted hover:text-ink hover:bg-card-subtle border border-line transition-colors"
          :title="`Next: ${nextTopic.title}`"
        >
          <span class="hidden md:inline">Next</span>
          <ChevronRight class="w-3.5 h-3.5" />
        </NuxtLink>
        <span
          v-else
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono text-muted/40 border border-line/40 cursor-not-allowed"
        >
          <span class="hidden md:inline">Next</span>
          <ChevronRight class="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  </nav>
</template>

