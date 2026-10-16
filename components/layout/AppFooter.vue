<script setup lang="ts">
import { Cpu, Terminal, ShieldCheck, Heart } from 'lucide-vue-next'
</script>

<template>
  <footer class="border-t border-line bg-card/60 backdrop-blur-sm mt-20 transition-colors duration-200">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
        <!-- Brand Description -->
        <div class="md:col-span-2 space-y-3">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded bg-brand-blue flex items-center justify-center text-white font-mono font-bold text-xs">
              ML
            </span>
            <span class="font-bold text-ink text-sm">
              ML &amp; Data Visualizer
            </span>
          </div>
          <p class="text-sm text-muted max-w-md">
            An open-source interactive playground designed to teach Machine Learning, Neural Networks, and High-Dimensional Linear Algebra through direct manipulation and zero-latency client-side computation.
          </p>
          <div class="flex flex-wrap gap-2 pt-2">
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-card-subtle border border-line text-muted">
              <Cpu class="w-3 h-3 text-brand-green" /> Client-Side Only
            </span>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-card-subtle border border-line text-muted">
              <Terminal class="w-3 h-3 text-brand-blue" /> TypeScript Strict
            </span>
            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono bg-card-subtle border border-line text-muted">
              <ShieldCheck class="w-3 h-3 text-brand-amber" /> Zero Data Telemetry
            </span>
          </div>
        </div>

        <!-- Studio Gateways -->
        <div class="space-y-3">
          <h4 class="text-xs font-mono font-bold text-ink uppercase tracking-wider">
            Studios
          </h4>
          <ul class="space-y-2 text-sm">
            <li>
              <NuxtLink to="/ml" class="text-muted hover:text-brand-blue transition-colors">
                Classic ML Studio
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/dl" class="text-muted hover:text-brand-blue transition-colors">
                Deep Learning Studio
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/analytics" class="text-muted hover:text-brand-blue transition-colors">
                Data Analytics 3D Lab
              </NuxtLink>
            </li>
          </ul>
        </div>

        <!-- Specifications & Principles -->
        <div class="space-y-3">
          <h4 class="text-xs font-mono font-bold text-ink uppercase tracking-wider">
            Architecture
          </h4>
          <ul class="space-y-2 text-sm text-muted">
            <li>Zero-Backend Compute</li>
            <li>Explicit User-Triggered Steps</li>
            <li>Strict Math-to-View Decoupling</li>
            <li>HTML5 2D &amp; WebGL Acceleration</li>
          </ul>
        </div>
      </div>

      <div class="border-t border-line mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted font-mono">
        <p>
          &copy; {{ new Date().getFullYear() }} ML &amp; Data Visualizer. Built with Nuxt 3, Vue 3, Tailwind CSS &amp; Bun.
        </p>
        <div class="flex items-center gap-4">
          <span class="inline-flex items-center gap-1">
            Engineered for conceptual clarity
          </span>
        </div>
      </div>
    </div>
  </footer>
</template>

