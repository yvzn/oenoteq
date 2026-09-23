<script setup lang="ts">
defineProps<{ title: string }>()
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <h2 class="text-ink font-display text-2xl">{{ title }}</h2>
    <div v-if="$slots.actions" class="flex items-center gap-4"><slot name="actions" /></div>
  </div>
</template>
