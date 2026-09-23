<script setup lang="ts">
import { computed } from 'vue'
import type { GardeStatus } from '../api/types'

const props = defineProps<{ status: GardeStatus }>()

const label: Record<GardeStatus, string> = {
  too_young: 'Too young',
  ready: 'Ready',
  past_peak: 'Past peak',
}

const classByStatus: Record<GardeStatus, string> = {
  too_young: 'bg-parchment-raised text-muted border border-line',
  ready: 'bg-gold-soft text-ink border border-gold',
  past_peak: 'bg-danger-soft text-danger border border-transparent',
}

const classes = computed(() => classByStatus[props.status])
const text = computed(() => label[props.status])
</script>

<template>
  <span
    class="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
    :class="classes"
    >{{ text }}</span
  >
</template>
