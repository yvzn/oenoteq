<script setup lang="ts">
import { computed } from 'vue'
import type { Color } from '../api/types'

const props = withDefaults(defineProps<{ color: Color; variant?: 'dot' | 'rail' }>(), {
  variant: 'dot',
})

const dotClassByColor: Record<Color, string> = {
  rouge: 'bg-bordeaux',
  blanc: 'bg-gold-soft border border-gold',
  rose: 'bg-rose-300',
}

const railClassByColor: Record<Color, string> = {
  rouge: 'bg-bordeaux',
  blanc: 'bg-gold',
  rose: 'bg-rose-300',
}

const classes = computed(() =>
  props.variant === 'rail' ? railClassByColor[props.color] : dotClassByColor[props.color],
)
</script>

<template>
  <span
    v-if="variant === 'rail'"
    class="inline-block w-[5px] shrink-0 self-stretch rounded-[3px]"
    :class="classes"
    :title="color"
    aria-hidden="true"
  />
  <span
    v-else
    class="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
    :class="classes"
    :title="color"
    aria-hidden="true"
  />
</template>
