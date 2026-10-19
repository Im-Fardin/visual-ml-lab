<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, createError, useHead } from '#imports'
import { ML_TOPICS, type MLTopic } from '~/data/mlCurriculum'
import MLNavbar from '~/components/ml/MLNavbar.vue'
import StudioSplitLayout from '~/components/analytics/StudioSplitLayout.vue'

// Stage Components
import Stage36ManualRegression from '~/components/analytics/stages/Stage36ManualRegression.vue'
import Stage37TrainingEngine from '~/components/analytics/stages/Stage37TrainingEngine.vue'
import StagePlaceholder from '~/components/analytics/stages/StagePlaceholder.vue'

const route = useRoute()
const slug = computed(() => route.params.slug as string)

// Find topic (supports primary slug and aliases)
const topicIndex = computed(() => {
  return ML_TOPICS.findIndex(
    (t) => t.slug === slug.value || (t.aliases && t.aliases.includes(slug.value))
  )
})

const currentTopic = computed<MLTopic>(() => {
  const t = ML_TOPICS[topicIndex.value]
  if (!t) {
    throw createError({
      statusCode: 404,
      statusMessage: `Algorithm "${slug.value}" not found in Machine Learning Studio.`
    })
  }
  return t
})

const prevTopic = computed<MLTopic | null>(() => {
  if (topicIndex.value > 0) {
    return ML_TOPICS[topicIndex.value - 1]
  }
  return null
})

const nextTopic = computed<MLTopic | null>(() => {
  if (topicIndex.value >= 0 && topicIndex.value < ML_TOPICS.length - 1) {
    return ML_TOPICS[topicIndex.value + 1]
  }
  return null
})

// Dynamic Stage Component Resolver
const stageComponent = computed(() => {
  switch (currentTopic.value.componentName) {
    case 'Stage36ManualRegression':
      return Stage36ManualRegression
    case 'Stage37TrainingEngine':
      return Stage37TrainingEngine
    default:
      return StagePlaceholder
  }
})

// Dynamic Inspector data emitted by the active stage
const inspectorState = ref<{
  title: string
  details: Record<string, any>
} | null>(null)

const onInspectUpdate = (data: { title: string; details: Record<string, any> }) => {
  inspectorState.value = data
}

useHead({
  title: computed(() => `${currentTopic.value.title} — Classic ML Studio`),
  meta: [
    {
      name: 'description',
      content: computed(() => currentTopic.value.shortDesc)
    }
  ]
})
</script>

<template>
  <div class="flex-1 flex flex-col min-[1000px]:overflow-hidden bg-bg transition-colors">
    <!-- ML Studio Header Navigation Bar -->
    <MLNavbar
      :current-topic="currentTopic"
      :prev-topic="prevTopic"
      :next-topic="nextTopic"
    />

    <!-- Split Studio Layout (60% Viewport / 40% Inspector & Code) -->
    <StudioSplitLayout :topic="currentTopic as any">
      <!-- Stage Slot -->
      <template #stage>
        <component
          :is="stageComponent"
          :topic="currentTopic"
          @inspect="onInspectUpdate"
        />
      </template>

      <!-- Inspector Slot -->
      <template #inspector>
        <div v-if="inspectorState" class="space-y-3">
          <div class="flex items-center justify-between border-b border-line pb-2">
            <span class="text-xs font-mono font-bold text-ink uppercase tracking-wider">
              {{ inspectorState.title }}
            </span>
            <span class="text-[10px] font-mono text-muted">Live State</span>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs font-mono">
            <div
              v-for="(val, key) in inspectorState.details"
              :key="key"
              class="p-2 rounded bg-card-subtle border border-line"
            >
              <div class="text-muted text-[10px] truncate">{{ key }}</div>
              <div class="text-ink font-bold mt-0.5 truncate">{{ val }}</div>
            </div>
          </div>
        </div>
      </template>
    </StudioSplitLayout>
  </div>
</template>

