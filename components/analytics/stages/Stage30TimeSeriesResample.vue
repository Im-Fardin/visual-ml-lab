<script setup lang="ts">
import Stage30CentralTendencySkewness from './Stage30CentralTendencySkewness.vue'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', payload: { title: string; details: Record<string, any> }): void
}>()
</script>

<template>
  <Stage30CentralTendencySkewness :topic="topic" @inspect="emit('inspect', $event)" />
</template>
