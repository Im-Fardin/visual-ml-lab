<script setup lang="ts">
import Stage29HistogramKde from './Stage29HistogramKde.vue'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()
</script>

<template>
  <Stage29HistogramKde :topic="topic" @inspect="emit('inspect', $event)" />
</template>
