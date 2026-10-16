<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, createError, useHead, definePageMeta } from '#imports'
import { ANALYTICS_TOPICS, type AnalyticsTopic } from '~/data/analyticsCurriculum'
import AnalyticsNavbar from '~/components/analytics/AnalyticsNavbar.vue'
import StudioSplitLayout from '~/components/analytics/StudioSplitLayout.vue'

definePageMeta({
  layout: 'studio'
})

// Stage Components
import Stage01Tensors from '~/components/analytics/stages/Stage01Tensors.vue'
import Stage02ShapeAxis from '~/components/analytics/stages/Stage02ShapeAxis.vue'
import Stage03IndexingSlicing from '~/components/analytics/stages/Stage03IndexingSlicing.vue'
import Stage04Transpose from '~/components/analytics/stages/Stage04Transpose.vue'
import Stage09DotProduct from '~/components/analytics/stages/Stage09DotProduct.vue'
import StagePlaceholder from '~/components/analytics/stages/StagePlaceholder.vue'

const route = useRoute()
const slug = computed(() => route.params.slug as string)

// Find topic (supports primary slug and aliases)
const topicIndex = computed(() => {
  return ANALYTICS_TOPICS.findIndex(
    (t) => t.slug === slug.value || (t.aliases && t.aliases.includes(slug.value))
  )
})

const currentTopic = computed<AnalyticsTopic>(() => {
  const t = ANALYTICS_TOPICS[topicIndex.value]
  if (!t) {
    throw createError({
      statusCode: 404,
      statusMessage: `Topic "${slug.value}" not found in Analytics Studio catalog.`
    })
  }
  return t
})

const prevTopic = computed<AnalyticsTopic | null>(() => {
  if (topicIndex.value > 0) {
    return ANALYTICS_TOPICS[topicIndex.value - 1]
  }
  return null
})

const nextTopic = computed<AnalyticsTopic | null>(() => {
  if (topicIndex.value >= 0 && topicIndex.value < ANALYTICS_TOPICS.length - 1) {
    return ANALYTICS_TOPICS[topicIndex.value + 1]
  }
  return null
})

// Resolve Stage Component
const stageComponent = computed(() => {
  switch (currentTopic.value.componentName) {
    case 'Stage01Tensors':
      return Stage01Tensors
    case 'Stage02ShapeAxis':
    case 'Stage02ShapeNdimAxis':
      return Stage02ShapeAxis
    case 'Stage03IndexingSlicing':
      return Stage03IndexingSlicing
    case 'Stage04Transpose':
      return Stage04Transpose
    case 'Stage09DotProduct':
      return Stage09DotProduct
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
  title: computed(() => `${currentTopic.value.title} — Analytics Studio`),
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
    <!-- Studio Header Navigation Bar -->
    <AnalyticsNavbar
      :current-topic="currentTopic"
      :prev-topic="prevTopic"
      :next-topic="nextTopic"
    />

    <!-- Split Studio Layout (60% Viewport / 40% Inspector & Code) -->
    <StudioSplitLayout :topic="currentTopic">
      <!-- Stage Slot -->
      <template #stage>
        <component
          :is="stageComponent"
          :key="currentTopic.slug"
          :topic="currentTopic"
          @inspect="onInspectUpdate"
        />
      </template>

      <!-- Inspector Slot in Right Pane -->
      <template #inspector>
        <div v-if="inspectorState" class="space-y-2">
          <div class="text-xs font-mono font-bold text-ink flex items-center justify-between">
            <span>{{ inspectorState.title }}</span>
            <span class="w-2 h-2 rounded-full bg-brand-green" />
          </div>

          <div class="rounded-md border border-line bg-card-subtle p-3 space-y-1.5 font-mono text-xs">
            <div
              v-for="(val, key) in inspectorState.details"
              :key="key"
              class="flex items-center justify-between gap-2 border-b border-line/40 pb-1 last:border-0 last:pb-0"
            >
              <span class="text-muted text-[11px]">{{ key }}:</span>
              <span class="text-ink font-semibold text-right truncate max-w-[200px]">{{ val }}</span>
            </div>
          </div>
        </div>

        <div v-else class="rounded-md border border-line bg-card-subtle p-3 text-xs font-mono text-muted">
          Interact with elements in the 3D viewport to inspect matrix addresses, strides, and memory addresses.
        </div>
      </template>
    </StudioSplitLayout>
  </div>
</template>

