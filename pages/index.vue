<script setup lang="ts">
import HeroSection from '~/components/landing/HeroSection.vue'
import StudioGateways from '~/components/landing/StudioGateways.vue'
import SystemPhilosophy from '~/components/landing/SystemPhilosophy.vue'

useHead({
  title: 'ML & Data Visualizer — Interactive Educational Platform',
  meta: [
    {
      name: 'description',
      content:
        'Interactive educational platform for machine learning, deep learning, and data analytics with zero backend and direct manipulation.'
    }
  ]
})
</script>

<template>
  <div class="space-y-0">
    <HeroSection />
    <StudioGateways />
    <SystemPhilosophy />
  </div>
</template>

