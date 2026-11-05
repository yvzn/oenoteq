<script setup lang="ts">
import { useHighlight } from '../composables/useHighlight'

const { announcements } = useHighlight()
</script>

<template>
  <div data-testid="live-announcer" role="status" aria-live="polite" class="sr-only">
    <p v-for="a in announcements" :key="a.seq">{{ a.text }}</p>
  </div>
</template>
