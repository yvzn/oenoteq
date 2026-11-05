<script setup lang="ts">
import type { Color } from '../api/types'
import ColorSwatch from './ColorSwatch.vue'

defineProps<{ title: string; color?: Color | '' | null }>()
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
    <div class="flex items-center gap-3">
      <ColorSwatch v-if="color" :color="color" variant="rail" />
      <h2 class="text-ink font-display text-[22px] leading-tight font-semibold sm:text-[28px]">{{ title }}</h2>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-4"><slot name="actions" /></div>
  </div>
</template>
