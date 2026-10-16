<script setup lang="ts">
import { ArrowRight, Sparkles, Terminal, Activity, Layers } from 'lucide-vue-next'
import InteractivePreviewCanvas from './InteractivePreviewCanvas.vue'
</script>

<template>
  <section class="relative pt-10 pb-16 lg:pt-16 lg:pb-24 overflow-hidden">
    <!-- Subtle Background Glows -->
    <div
      class="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-brand-blue/5 blur-3xl pointer-events-none rounded-full"
    />

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        <!-- Hero Text & Value Proposition (5 cols on lg) -->
        <div class="lg:col-span-5 space-y-6 text-left">
          <!-- Top Tag Badge -->
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-medium bg-brand-blue-soft text-brand-blue border border-brand-blue/20">
            <Sparkles class="w-3.5 h-3.5" />
            <span>Interactive AI Architecture &amp; Visual Analytics</span>
          </div>

          <!-- Main Title -->
          <h1 class="text-4xl sm:text-5xl font-extrabold text-ink tracking-tight leading-[1.15]">
            Master Machine Learning from
            <span class="text-brand-blue underline decoration-brand-blue/30 decoration-wavy underline-offset-4">
              First Principles
            </span>
          </h1>

          <!-- Subtitle -->
          <p class="text-base sm:text-lg text-muted leading-relaxed">
            Direct visual manipulation, step-by-step tensor inspection, and zero-latency in-browser computation. Explore how hyperplanes divide spaces, how gradients descend loss surfaces, and how high-dimensional tensors transform.
          </p>

          <!-- Core Feature Badges -->
          <div class="flex flex-wrap gap-2 pt-1 font-mono text-xs">
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card border border-line text-ink shadow-xs">
              <span class="w-1.5 h-1.5 rounded-full bg-brand-green" /> Client-Side Only
            </span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card border border-line text-ink shadow-xs">
              <span class="w-1.5 h-1.5 rounded-full bg-brand-blue" /> Explicit Step Control
            </span>
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-card border border-line text-ink shadow-xs">
              <span class="w-1.5 h-1.5 rounded-full bg-brand-purple" /> Pure TypeScript Math
            </span>
          </div>

          <!-- Primary Actions -->
          <div class="flex flex-wrap items-center gap-3 pt-2">
            <NuxtLink
              to="/#studios"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-brand-blue hover:bg-brand-blue-hover text-white text-sm font-semibold shadow-md transition-all hover:translate-y-[-1px] focus:outline-none focus:ring-2 focus:ring-brand-blue/50"
            >
              <span>Explore Studios</span>
              <ArrowRight class="w-4 h-4" />
            </NuxtLink>

            <NuxtLink
              to="/#philosophy"
              class="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-line bg-card hover:bg-card-subtle text-ink text-sm font-medium shadow-sm transition-colors"
            >
              System Philosophy
            </NuxtLink>
          </div>
        </div>

        <!-- Interactive Canvas Hero Card (7 cols on lg) -->
        <div class="lg:col-span-7">
          <div class="relative">
            <!-- Decorative Accent Corner Badges -->
            <div class="absolute -top-3 -right-3 z-10 hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-md bg-card border border-line shadow-sm text-xs font-mono text-muted">
              <Activity class="w-3.5 h-3.5 text-brand-green" />
              <span>Interactive Live Demo</span>
            </div>

            <InteractivePreviewCanvas />
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

