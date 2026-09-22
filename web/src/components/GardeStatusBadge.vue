<script setup lang="ts">
import { computed } from 'vue'
import type { GardeStatus } from '../domain/gardeStatus'

const props = defineProps<{ status: GardeStatus }>()

const label: Record<GardeStatus, string> = {
  too_young: 'Too young',
  ready: 'Ready',
  past_peak: 'Past peak',
}

const classByStatus: Record<GardeStatus, string> = {
  too_young: 'bg-stone-100 text-stone-600',
  ready: 'bg-amber-100 text-amber-800',
  past_peak: 'bg-red-50 text-red-700',
}

const classes = computed(() => classByStatus[props.status])
const text = computed(() => label[props.status])
</script>

<template>
  <span
    class="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
    :class="classes"
    >{{ text }}</span
  >
</template>
