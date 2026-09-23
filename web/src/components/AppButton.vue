<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'primary' | 'ghost' | 'danger'
    type?: 'button' | 'submit'
    disabled?: boolean
  }>(),
  { variant: 'primary', type: 'button', disabled: false },
)
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    class="rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    :class="{
      'bg-bordeaux hover:bg-bordeaux-hover px-4 py-1.5 text-white shadow-sm':
        variant === 'primary',
      'text-muted hover:text-ink px-0 py-0 underline underline-offset-2': variant === 'ghost',
      'text-danger px-0 py-0 underline underline-offset-2': variant === 'danger',
    }"
  >
    <slot />
  </button>
</template>
