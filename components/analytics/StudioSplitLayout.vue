<script setup lang="ts">
import { ref } from 'vue'
import { Copy, Check, Terminal, BookOpen, Lightbulb, Activity } from 'lucide-vue-next'
import type { AnalyticsTopic } from '~/data/analyticsCurriculum'

const props = defineProps<{
  topic: AnalyticsTopic
}>()

const copied = ref(false)

const copyCode = async () => {
  try {
    await navigator.clipboard.writeText(props.topic.pythonCode)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
  } catch (err) {
    console.error('Failed to copy code', err)
  }
}
</script>

<template>
  <div class="w-full flex-1 flex flex-col bg-bg">
    <!-- Laptop-First Split Studio Grid: 1.6fr (3D Stage + Controls + HUD) / 1fr (Theory & Code) -->
    <div
      class="max-w-[1700px] w-full mx-auto p-3 sm:p-4 grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start flex-1"
    >
      <!-- LEFT PANE: Sticky, zero-scroll 3D stage and playback bar -->
      <section class="w-full flex flex-col gap-2.5 lg:sticky lg:top-2">
        <slot name="stage" />
      </section>

      <!-- RIGHT PANE: Theory & Technical Dossier (Independently scrollable) -->
      <aside
        class="flex flex-col gap-3 overflow-y-auto lg:max-h-[calc(100vh-95px)] pr-1.5 pb-6"
      >
        <!-- Concept & Theory Card -->
        <div class="rounded-lg border border-line bg-card p-5 space-y-3.5 shadow-xs">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-md bg-brand-blue-soft border border-brand-blue/20 text-brand-blue flex items-center justify-center shrink-0">
              <BookOpen class="w-4 h-4" />
            </div>
            <div>
              <span class="text-[10px] font-mono uppercase tracking-wider text-muted">Theoretical Invariant</span>
              <h2 class="text-sm sm:text-base font-bold text-ink leading-tight">
                {{ topic.theory.title }}
              </h2>
            </div>
          </div>

          <p class="text-xs sm:text-sm text-ink leading-relaxed">
            {{ topic.theory.concept }}
          </p>

          <!-- Practical Production Insight Callout -->
          <div class="rounded-md border border-brand-amber/25 bg-brand-amber-soft/40 p-3 space-y-1">
            <div class="flex items-center gap-1.5 text-xs font-mono font-bold text-brand-amber">
              <Lightbulb class="w-3.5 h-3.5 shrink-0" />
              <span>Production &amp; Engineering Insight</span>
            </div>
            <p class="text-xs text-ink/90 leading-relaxed">
              {{ topic.theory.practicalInsight }}
            </p>
          </div>
        </div>

        <!-- Interactive Selection / Parameter Inspector Card -->
        <div class="rounded-lg border border-line bg-card p-4 space-y-2.5 shadow-xs">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Activity class="w-4 h-4 text-brand-purple" />
              <h3 class="text-xs font-mono font-bold uppercase tracking-wider text-ink">
                Live Parameter Inspector
              </h3>
            </div>
            <span class="text-[10px] font-mono text-muted">Direct Cell Feedback</span>
          </div>

          <slot name="inspector">
            <div class="rounded-md border border-line bg-card-subtle p-3 text-xs font-mono text-muted">
              Select or hover elements in the 3D viewport to inspect matrix addresses, strides, and memory addresses.
            </div>
          </slot>
        </div>

        <!-- Executable Python / NumPy / Pandas Code -->
        <div class="rounded-lg border border-line bg-card p-4 space-y-2.5 shadow-xs">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Terminal class="w-4 h-4 text-brand-green" />
              <h3 class="text-xs font-mono font-bold uppercase tracking-wider text-ink">
                Executable Python Implementation
              </h3>
            </div>

            <!-- Copy Code Button -->
            <button
              type="button"
              @click="copyCode"
              class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-line bg-card hover:bg-card-subtle text-xs font-mono text-muted hover:text-ink transition-colors shadow-xs"
              :title="copied ? 'Copied to clipboard' : 'Copy code snippet'"
            >
              <Check v-if="copied" class="w-3.5 h-3.5 text-brand-green" />
              <Copy v-else class="w-3.5 h-3.5" />
              <span>{{ copied ? 'Copied!' : 'Copy' }}</span>
            </button>
          </div>

          <!-- Code Box -->
          <div class="rounded-md border border-line bg-code/70 p-3 overflow-x-auto text-xs font-mono text-ink shadow-inner">
            <pre class="leading-relaxed"><code>{{ topic.pythonCode }}</code></pre>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>
