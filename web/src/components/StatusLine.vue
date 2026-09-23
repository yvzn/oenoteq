<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'muted' | 'error' }>(), { tone: 'muted' })
</script>

<template>
  <p :role="tone === 'error' ? 'alert' : 'status'" :class="tone === 'error' ? 'text-danger' : 'text-muted'">
    <slot />
    <slot v-if="tone === 'error'" name="retry" />
  </p>
</template>
