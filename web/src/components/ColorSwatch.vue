<script setup lang="ts">
import { computed } from 'vue'
import type { Color } from '../api/types'

const props = defineProps<{ color: Color }>()

const classByColor: Record<Color, string> = {
  rouge: 'bg-bordeaux',
  blanc: 'bg-gold-soft border border-gold',
  rose: 'bg-rose-300',
}

const classes = computed(() => classByColor[props.color])
</script>

<template>
  <span
    class="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
    :class="classes"
    :title="color"
    aria-hidden="true"
  />
</template>
