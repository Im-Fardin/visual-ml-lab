<script setup lang="ts">
import { ArrowRight, Sparkles, CheckCircle2, Clock } from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic: AnalyticsTopic
}>()

const isInteractiveReady = computed(() => {
  return props.topic.componentName !== 'StagePlaceholder'
})

const partColorClass = computed(() => {
  switch (props.topic.partId) {
    case 'numpy':
      return {
        badge: 'bg-brand-blue-soft text-brand-blue border-brand-blue/20',
        text: 'text-brand-blue',
        btn: 'bg-brand-blue hover:bg-brand-blue-hover text-white'
      }
    case 'pandas':
      return {
        badge: 'bg-brand-purple-soft text-brand-purple border-brand-purple/20',
        text: 'text-brand-purple',
        btn: 'bg-brand-purple hover:bg-brand-purple-hover text-white'
      }
    case 'statistics':
      return {
        badge: 'bg-brand-amber-soft text-brand-amber border-brand-amber/20',
        text: 'text-brand-amber',
        btn: 'bg-brand-amber hover:bg-brand-amber-hover text-white'
      }
    case 'machine-learning':
    case 'ml':
      return {
        badge: 'bg-brand-blue-soft text-brand-blue border-brand-blue/20',
        text: 'text-brand-blue',
        btn: 'bg-brand-blue hover:bg-brand-blue-hover text-white'
      }
    default:
      return {
        badge: 'bg-card-subtle text-muted border-line',
        text: 'text-ink',
        btn: 'bg-brand-blue hover:bg-brand-blue-hover text-white'
      }
  }
})
</script>

<template>
  <div
    class="rounded-lg border border-line bg-card p-5 sm:p-6 flex flex-col justify-between shadow-xs hover:shadow-md hover:border-line-strong hover:-translate-y-0.5 transition-all group duration-200"
  >
    <div class="space-y-4">
      <!-- Top Meta: Part Badge & Module Number -->
      <div class="flex items-center justify-between gap-2">
        <span
          class="text-[11px] font-mono px-2.5 py-0.5 rounded-full border font-medium"
          :class="partColorClass.badge"
        >
          {{ topic.moduleTitle }}
        </span>

        <div class="flex items-center gap-1.5">
          <span
            v-if="isInteractiveReady"
            class="inline-flex items-center gap-1 text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-brand-green-soft text-brand-green border border-brand-green/20"
          >
            <Sparkles class="w-3 h-3" /> Live 3D
          </span>
          <span
            v-else
            class="inline-flex items-center gap-1 text-[10px] font-mono text-muted px-2 py-0.5 rounded bg-card-subtle border border-line"
          >
            <Clock class="w-3 h-3" /> Preview
          </span>
          <span class="font-mono text-xs font-bold text-muted">
            #{{ topic.id }}
          </span>
        </div>
      </div>

      <!-- Title -->
      <div>
        <NuxtLink :to="`/analytics/${topic.slug}`" class="block focus:outline-none">
          <h3
            class="text-lg font-bold text-ink group-hover:text-brand-blue transition-colors leading-snug"
          >
            {{ topic.title }}
          </h3>
        </NuxtLink>
        <p class="text-xs text-muted font-mono mt-1">
          {{ topic.invariant }}
        </p>
      </div>

      <!-- Short Intuition Description -->
      <p class="text-xs sm:text-sm text-muted leading-relaxed line-clamp-2">
        {{ topic.shortDesc }}
      </p>

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
        :to="`/analytics/${topic.slug}`"
        class="w-full inline-flex items-center justify-between px-3.5 py-2 rounded-md text-xs font-mono font-semibold transition-all shadow-xs group-hover:shadow-sm"
        :class="partColorClass.btn"
      >
        <span>Launch Studio</span>
        <ArrowRight class="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
      </NuxtLink>
    </div>
  </div>
</template>

