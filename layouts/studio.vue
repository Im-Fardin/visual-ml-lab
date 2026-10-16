<script setup lang="ts">
import AppNavbar from '~/components/layout/AppNavbar.vue'
</script>

<template>
  <div class="min-h-screen min-[1000px]:h-screen flex flex-col bg-bg text-ink transition-colors duration-200 min-[1000px]:overflow-hidden">
    <AppNavbar />
    <main class="flex-1 flex flex-col min-[1000px]:overflow-hidden">
      <slot />
    </main>
  </div>
</template>

