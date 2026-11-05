<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ConfirmDialog from './ConfirmDialog.vue'
import type { WithdrawalPhase } from '../consent/useWithdrawal'

const props = defineProps<{ phase: WithdrawalPhase; unsent: number }>()
defineEmits<{ confirm: []; cancel: []; retry: [] }>()

const { t } = useI18n()
const confirming = computed(() => props.phase === 'confirming')
</script>

<template>
  <!-- Mounted only while asking, so the page itself is never a dialog. -->
  <ConfirmDialog
    v-if="confirming"
    :open="true"
    :message="t('withdraw.unsent', { count: unsent }, unsent)"
    :confirm-label="t('withdraw.discard')"
    :cancel-label="t('withdraw.cancel')"
    @confirm="$emit('confirm')"
    @cancel="$emit('cancel')"
  />
  <p v-if="phase === 'working'" role="status" data-testid="withdraw-working" class="text-muted mt-4 text-sm">
    {{ t('withdraw.working') }}
  </p>
  <div v-else-if="phase === 'failed'" role="alert" data-testid="withdraw-error" class="mt-4">
    <p class="text-danger text-sm font-semibold">{{ t('withdraw.failedTitle') }}</p>
    <p class="text-ink mt-1 text-sm">{{ t('withdraw.failed') }}</p>
    <button type="button" data-testid="withdraw-retry" class="text-bordeaux mt-2 text-sm underline" @click="$emit('retry')">
      {{ t('withdraw.retry') }}
    </button>
  </div>
</template>
