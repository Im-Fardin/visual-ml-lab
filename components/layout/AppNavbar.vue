<script setup lang="ts">
import { ref } from 'vue'
import {
  Sun,
  Moon,
  Github,
  Sparkles,
  BookOpen,
  Menu,
  X,
  Binary,
  BrainCircuit,
  BarChart2
} from 'lucide-vue-next'

const { theme, isDark, toggleTheme } = useTheme()
const mobileMenuOpen = ref(false)

const navLinks = [
  { label: 'ML Studio', href: '/ml', icon: Binary, badge: 'Classic' },
  { label: 'Deep Learning', href: '/dl', icon: BrainCircuit, badge: 'Neural' },
  { label: 'Data Analytics', href: '/analytics', icon: BarChart2, badge: '3D Tensors' }
]
</script>

<template>
  <header
    class="sticky top-0 z-50 w-full backdrop-blur-md bg-card/85 border-b border-line transition-colors duration-200"
  >
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <!-- Brand Logo / Badge -->
      <NuxtLink to="/" class="flex items-center gap-3 group focus:outline-none">
        <div
          class="w-9 h-9 rounded-md bg-brand-blue flex items-center justify-center text-white font-mono font-bold text-sm shadow-sm group-hover:bg-brand-blue-hover transition-colors"
        >
          ML
        </div>
        <div class="flex flex-col">
          <span class="font-bold text-ink text-base tracking-tight leading-none group-hover:text-brand-blue transition-colors">
            ML &amp; Data Visualizer
          </span>
          <span class="text-xs text-muted font-mono tracking-wider mt-0.5">
            Interactive Educational Platform
          </span>
        </div>
      </NuxtLink>

      <!-- Desktop Nav Links -->
      <nav class="hidden md:flex items-center gap-1">
        <NuxtLink
          to="/#studios"
          class="px-3 py-1.5 rounded-md text-sm font-medium text-muted hover:text-ink hover:bg-card-subtle transition-colors"
        >
          Overview
        </NuxtLink>

        <NuxtLink
          v-for="item in navLinks"
          :key="item.href"
          :to="item.href"
          class="px-3 py-1.5 rounded-md text-sm font-medium text-muted hover:text-ink hover:bg-card-subtle transition-colors flex items-center gap-1.5"
          active-class="!text-brand-blue !bg-brand-blue-soft/50 font-semibold"
        >
          <component :is="item.icon" class="w-4 h-4 opacity-75" />
          <span>{{ item.label }}</span>
        </NuxtLink>

        <NuxtLink
          to="/#philosophy"
          class="px-3 py-1.5 rounded-md text-sm font-medium text-muted hover:text-ink hover:bg-card-subtle transition-colors"
        >
          Architecture
        </NuxtLink>
      </nav>

      <!-- Action Utilities: Theme Toggle & External Links -->
      <div class="flex items-center gap-2 sm:gap-3">
        <!-- Theme Toggle Button -->
        <button
          type="button"
          @click="toggleTheme"
          :title="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
          class="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-line bg-card hover:bg-card-subtle text-ink text-xs font-mono font-medium shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-blue/30"
          aria-label="Toggle theme"
        >
          <Sun v-if="isDark" class="w-3.5 h-3.5 text-brand-amber" />
          <Moon v-else class="w-3.5 h-3.5 text-brand-blue" />
          <span class="capitalize hidden sm:inline">{{ isDark ? 'Dark' : 'Light' }}</span>
        </button>

        <!-- GitHub Link -->
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          class="p-2 rounded-md text-muted hover:text-ink hover:bg-card-subtle border border-transparent hover:border-line transition-colors"
          title="Source Code"
        >
          <Github class="w-4 h-4" />
        </a>

        <!-- Mobile Menu Button -->
        <button
          type="button"
          @click="mobileMenuOpen = !mobileMenuOpen"
          class="md:hidden p-2 rounded-md text-muted hover:text-ink hover:bg-card-subtle transition-colors"
          aria-label="Toggle Navigation Menu"
        >
          <X v-if="mobileMenuOpen" class="w-5 h-5" />
          <Menu v-else class="w-5 h-5" />
        </button>
      </div>
    </div>

    <!-- Mobile Dropdown -->
    <div
      v-show="mobileMenuOpen"
      class="md:hidden border-t border-line bg-card px-4 pt-3 pb-4 space-y-1 shadow-lg"
    >
      <NuxtLink
        to="/#studios"
        @click="mobileMenuOpen = false"
        class="block px-3 py-2 rounded-md text-sm font-medium text-ink hover:bg-card-subtle"
      >
        Overview
      </NuxtLink>
      <NuxtLink
        v-for="item in navLinks"
        :key="item.href"
        :to="item.href"
        @click="mobileMenuOpen = false"
        class="flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium text-ink hover:bg-card-subtle"
      >
        <div class="flex items-center gap-2">
          <component :is="item.icon" class="w-4 h-4 text-brand-blue" />
          <span>{{ item.label }}</span>
        </div>
        <span class="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-card-subtle border border-line text-muted">
          {{ item.badge }}
        </span>
      </NuxtLink>
      <NuxtLink
        to="/#philosophy"
        @click="mobileMenuOpen = false"
        class="block px-3 py-2 rounded-md text-sm font-medium text-ink hover:bg-card-subtle"
      >
        Architecture Philosophy
      </NuxtLink>
    </div>
  </header>
</template>

