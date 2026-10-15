<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useSyncPending } from '../composables/useSyncPending'

const props = defineProps<{ entity: string; targetId: number | string }>()

const { t } = useI18n()
const { pending } = useSyncPending(
  () => props.entity,
  () => props.targetId,
)
</script>

<template>
  <span
    v-if="pending"
    data-testid="sync-pending-badge"
    class="border-line text-muted inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium whitespace-nowrap"
  >
    {{ t('syncBadge.notSynced') }}
  </span>
</template>
