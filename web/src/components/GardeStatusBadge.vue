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
  too_young: 'bg-status-young-soft text-status-young',
  ready: 'bg-status-ready-soft text-status-ready',
  past_peak: 'bg-status-past-soft text-status-past',
}

const classes = computed(() => classByStatus[props.status])
const text = computed(() => label[props.status])
</script>

<template>
  <span
    class="inline-block rounded-full px-3 py-[5px] text-[12.5px] font-semibold whitespace-nowrap"
    :class="classes"
    >{{ text }}</span
  >
</template>
