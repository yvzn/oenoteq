<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

const props = withDefaults(
  defineProps<{
    variant?: 'primary' | 'secondary' | 'ghost'
    type?: 'button' | 'submit'
    disabled?: boolean
    to?: RouteLocationRaw
  }>(),
  { variant: 'primary', type: 'button', disabled: false },
)

const baseClass = 'rounded-lg text-sm font-semibold transition-colors'

const variantClass = computed(() => ({
  'bg-bordeaux hover:bg-bordeaux-hover px-5 py-3 text-white shadow-sm': props.variant === 'primary',
  'border-bordeaux text-bordeaux hover:bg-bordeaux border px-3 py-1.5 hover:text-white': props.variant === 'secondary',
  'text-muted hover:text-ink px-0 py-0 font-medium hover:underline underline-offset-2': props.variant === 'ghost',
}))
</script>

<template>
  <RouterLink v-if="to" :to="to" :class="[baseClass, variantClass]">
    <slot />
  </RouterLink>
  <button
    v-else
    :type="type"
    :disabled="disabled"
    class="disabled:cursor-not-allowed disabled:opacity-50"
    :class="[baseClass, variantClass]"
  >
    <slot />
  </button>
</template>
