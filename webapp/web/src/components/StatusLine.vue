<script setup lang="ts">
import { computed } from 'vue'

type Tone = 'muted' | 'error' | 'success'

const props = withDefaults(defineProps<{ tone?: Tone }>(), { tone: 'muted' })

const classByTone: Record<Tone, string> = {
  muted: 'text-muted',
  error: 'text-danger',
  success: 'text-success',
}

const toneClass = computed(() => classByTone[props.tone])
</script>

<template>
  <p :role="tone === 'error' ? 'alert' : 'status'" :class="toneClass">
    <slot />
    <slot v-if="tone === 'error'" name="retry" />
  </p>
</template>
