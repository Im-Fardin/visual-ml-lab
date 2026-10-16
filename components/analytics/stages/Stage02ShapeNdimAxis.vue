<script setup lang="ts">
import Stage02ShapeAxis from './Stage02ShapeAxis.vue'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

defineProps<{
  topic?: AnalyticsTopic
}>()

const emit = defineEmits<{
  (e: 'inspect', data: { title: string; details: Record<string, any> }): void
}>()
</script>

<template>
  <Stage02ShapeAxis :topic="topic" @inspect="(data) => emit('inspect', data)" />
</template>

