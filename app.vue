<script setup lang="ts">
import { onMounted } from 'vue'

const { initTheme } = useTheme()

onMounted(() => {
  initTheme()
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

