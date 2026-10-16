<script setup lang="ts">
import { ArrowLeft, ChevronLeft, ChevronRight, Box, Sparkles } from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

defineProps<{
  currentTopic: AnalyticsTopic
  prevTopic: AnalyticsTopic | null
  nextTopic: AnalyticsTopic | null
}>()
</script>

<template>
  <nav class="w-full shrink-0 border-b border-line bg-card/90 backdrop-blur-md px-4 sm:px-6 py-2.5 transition-colors z-20">
    <div class="max-w-7xl mx-auto flex items-center justify-between gap-3">
      <!-- Breadcrumb & Back Link -->
      <div class="flex items-center gap-3 min-w-0">
        <NuxtLink
          to="/analytics"
          class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-medium text-muted hover:text-ink hover:bg-card-subtle border border-line transition-colors shrink-0"
          title="Return to Analytics Hub catalog"
        >
          <ArrowLeft class="w-3.5 h-3.5" />
          <span class="hidden sm:inline">Analytics Hub</span>
          <span class="sm:hidden">Hub</span>
        </NuxtLink>

        <span class="text-line hidden sm:inline">/</span>

        <!-- Active Topic Badge & Title -->
        <div class="flex items-center gap-2 min-w-0 truncate">
          <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-brand-amber-soft text-brand-amber border border-brand-amber/20 shrink-0 hidden md:inline">
            {{ currentTopic.partTitle.split(':')[0] }}
          </span>
          <h1 class="text-xs sm:text-sm font-bold text-ink truncate font-mono">
            {{ currentTopic.title }}
          </h1>
        </div>
      </div>

      <!-- Prev / Next Topic Stepper Controls -->
      <div class="flex items-center gap-1.5 shrink-0">
        <NuxtLink
          v-if="prevTopic"
          :to="`/analytics/${prevTopic.slug}`"
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
          {{ currentTopic.id }} / 18
        </span>

        <NuxtLink
          v-if="nextTopic"
          :to="`/analytics/${nextTopic.slug}`"
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

