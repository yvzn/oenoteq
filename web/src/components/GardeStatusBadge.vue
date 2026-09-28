<script setup lang="ts">
import { computed } from 'vue'
import type { GardeStatus } from '../api/types'

const props = defineProps<{ status: GardeStatus }>()

const label: Record<GardeStatus, string> = {
  too_young: 'Too young',
  ready: 'Ready',
  past_peak: 'Past peak',
  unassessed: 'Not assessed',
}

const textClassByStatus: Record<GardeStatus, string> = {
  too_young: 'text-status-young',
  ready: 'text-status-ready',
  past_peak: 'text-status-past',
  unassessed: 'text-muted',
}

const dotClassByStatus: Record<GardeStatus, string> = {
  too_young: 'bg-status-young',
  ready: 'bg-status-ready',
  past_peak: 'bg-status-past',
  unassessed: 'bg-label',
}

const textClass = computed(() => textClassByStatus[props.status])
const dotClass = computed(() => dotClassByStatus[props.status])
const text = computed(() => label[props.status])
</script>

<template>
  <span class="inline-flex items-center gap-[7px] text-[12.5px] font-semibold whitespace-nowrap" :class="textClass">
    <span class="h-[7px] w-[7px] shrink-0 rounded-full" :class="dotClass" aria-hidden="true"></span>
    {{ text }}
  </span>
</template>
