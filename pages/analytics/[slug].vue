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
import Stage05ReshapeFlatten from '~/components/analytics/stages/Stage05ReshapeFlatten.vue'
import Stage06StackConcatSplit from '~/components/analytics/stages/Stage06StackConcatSplit.vue'
import Stage07VectorizationVsLoop from '~/components/analytics/stages/Stage07VectorizationVsLoop.vue'
import Stage08UfuncElementwise from '~/components/analytics/stages/Stage08UfuncElementwise.vue'
import Stage09DotProduct from '~/components/analytics/stages/Stage09DotProduct.vue'
import Stage10AggregationAxis from '~/components/analytics/stages/Stage10AggregationAxis.vue'
import Stage11CumulativeVsReduce from '~/components/analytics/stages/Stage11CumulativeVsReduce.vue'
import Stage12BroadcastingRules from '~/components/analytics/stages/Stage12BroadcastingRules.vue'
import Stage13BroadcastingNewaxis from '~/components/analytics/stages/Stage13BroadcastingNewaxis.vue'
import Stage14BooleanMask from '~/components/analytics/stages/Stage14BooleanMask.vue'
import Stage15LogicalOpsWhere from '~/components/analytics/stages/Stage15LogicalOpsWhere.vue'
import Stage16FancyIndexing from '~/components/analytics/stages/Stage16FancyIndexing.vue'
import Stage17SeriesAnatomy from '~/components/analytics/stages/Stage17SeriesAnatomy.vue'
import Stage18SeriesAlignment from '~/components/analytics/stages/Stage18SeriesAlignment.vue'
import Stage19DataFrameAnatomy from '~/components/analytics/stages/Stage19DataFrameAnatomy.vue'
import Stage20LocVsIloc from '~/components/analytics/stages/Stage20LocVsIloc.vue'
import Stage21ReadCsvParsing from '~/components/analytics/stages/Stage21ReadCsvParsing.vue'
import Stage22ConditionalSelection from '~/components/analytics/stages/Stage22ConditionalSelection.vue'
import Stage23ApplyAxis from '~/components/analytics/stages/Stage23ApplyAxis.vue'
import Stage27PivotTableCrosstab from '~/components/analytics/stages/Stage27PivotTableCrosstab.vue'
import Stage28MeltWideToLong from '~/components/analytics/stages/Stage28MeltWideToLong.vue'
import Stage29HistogramKde from '~/components/analytics/stages/Stage29HistogramKde.vue'
import Stage30CentralTendencySkewness from '~/components/analytics/stages/Stage30CentralTendencySkewness.vue'
import Stage29FeatureScaling from '~/components/analytics/stages/Stage29FeatureScaling.vue'
import Stage30CategoricalEncoding from '~/components/analytics/stages/Stage30CategoricalEncoding.vue'
import Stage29StackUnstackMultiIndex from '~/components/analytics/stages/Stage29StackUnstackMultiIndex.vue'
import Stage30TimeSeriesResample from '~/components/analytics/stages/Stage30TimeSeriesResample.vue'
import Stage31NormalDistribution from '~/components/analytics/stages/Stage31NormalDistribution.vue'
import Stage32CentralLimitTheorem from '~/components/analytics/stages/Stage32CentralLimitTheorem.vue'
import Stage31RollingWindow from '~/components/analytics/stages/Stage31RollingWindow.vue'
import Stage32MemoryCategorical from '~/components/analytics/stages/Stage32MemoryCategorical.vue'
import Stage33PdfCdfQuantiles from '~/components/analytics/stages/Stage33PdfCdfQuantiles.vue'
import Stage34CorrelationScatter from '~/components/analytics/stages/Stage34CorrelationScatter.vue'
import Stage33ChunkingLargeFiles from '~/components/analytics/stages/Stage33ChunkingLargeFiles.vue'
import Stage34RowVsColumnarParquet from '~/components/analytics/stages/Stage34RowVsColumnarParquet.vue'
import Stage35FeatureScaling from '~/components/analytics/stages/Stage35FeatureScaling.vue'
import Stage36CategoricalEncoding from '~/components/analytics/stages/Stage36CategoricalEncoding.vue'
import Stage37TrainTestSplitLeakage from '~/components/analytics/stages/Stage37TrainTestSplitLeakage.vue'
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
    case 'Stage05ReshapeFlatten':
      return Stage05ReshapeFlatten
    case 'Stage06StackConcatSplit':
      return Stage06StackConcatSplit
    case 'Stage07VectorizationVsLoop':
      return Stage07VectorizationVsLoop
    case 'Stage08UfuncElementwise':
      return Stage08UfuncElementwise
    case 'Stage09DotProduct':
      return Stage09DotProduct
    case 'Stage10AggregationAxis':
      return Stage10AggregationAxis
    case 'Stage11CumulativeVsReduce':
      return Stage11CumulativeVsReduce
    case 'Stage12BroadcastingRules':
      return Stage12BroadcastingRules
    case 'Stage13BroadcastingNewaxis':
      return Stage13BroadcastingNewaxis
    case 'Stage14BooleanMask':
      return Stage14BooleanMask
    case 'Stage15LogicalOpsWhere':
      return Stage15LogicalOpsWhere
    case 'Stage16FancyIndexing':
      return Stage16FancyIndexing
    case 'Stage17SeriesAnatomy':
      return Stage17SeriesAnatomy
    case 'Stage18SeriesAlignment':
      return Stage18SeriesAlignment
    case 'Stage19DataFrameAnatomy':
      return Stage19DataFrameAnatomy
    case 'Stage20LocVsIloc':
      return Stage20LocVsIloc
    case 'Stage21ReadCsvParsing':
      return Stage21ReadCsvParsing
    case 'Stage22ConditionalSelection':
      return Stage22ConditionalSelection
    case 'Stage23ApplyAxis':
      return Stage23ApplyAxis
    case 'Stage27PivotTableCrosstab':
      return Stage27PivotTableCrosstab
    case 'Stage28MeltWideToLong':
      return Stage28MeltWideToLong
    case 'Stage29HistogramKde':
      return Stage29HistogramKde
    case 'Stage30CentralTendencySkewness':
      return Stage30CentralTendencySkewness
    case 'Stage29FeatureScaling':
    case 'Stage29StackUnstackMultiIndex':
      return Stage29FeatureScaling
    case 'Stage30CategoricalEncoding':
    case 'Stage30TimeSeriesResample':
      return Stage30CategoricalEncoding
    case 'Stage31NormalDistribution':
    case 'Stage31RollingWindow':
      return Stage31NormalDistribution
    case 'Stage32CentralLimitTheorem':
    case 'Stage32MemoryCategorical':
      return Stage32CentralLimitTheorem
    case 'Stage33PdfCdfQuantiles':
      return Stage33PdfCdfQuantiles
    case 'Stage34CorrelationScatter':
      return Stage34CorrelationScatter
    case 'Stage33ChunkingLargeFiles':
      return Stage33ChunkingLargeFiles
    case 'Stage34RowVsColumnarParquet':
      return Stage34RowVsColumnarParquet
    case 'Stage35FeatureScaling':
      return Stage35FeatureScaling
    case 'Stage36CategoricalEncoding':
      return Stage36CategoricalEncoding
    case 'Stage37TrainTestSplitLeakage':
      return Stage37TrainTestSplitLeakage
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

