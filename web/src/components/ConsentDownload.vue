<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppButton from './AppButton.vue'

defineProps<{ phase: 'downloading' | 'failed'; progress: { done: number; total: number } }>()
defineEmits<{ retry: []; refuse: [] }>()

const { t } = useI18n()
</script>

<template>
  <div v-if="phase === 'downloading'" role="status" data-testid="consent-progress" class="mt-6">
    <p class="text-ink text-sm font-semibold">{{ t('consent.downloadingTitle') }}</p>
    <progress class="mt-2 w-full" :value="progress.done" :max="progress.total" />
    <p class="text-muted mt-1 text-sm">{{ t('consent.progress', progress) }}</p>
  </div>

  <div v-else role="alert" data-testid="consent-error" class="mt-6">
    <p class="text-danger text-sm font-semibold">{{ t('consent.failedTitle') }}</p>
    <p class="text-ink mt-1 text-sm">{{ t('consent.failed') }}</p>
    <div class="mt-3 flex flex-wrap gap-3">
      <AppButton data-testid="consent-retry" @click="$emit('retry')">{{ t('consent.retry') }}</AppButton>
      <AppButton data-testid="consent-refuse" @click="$emit('refuse')">{{ t('consent.refuseAction') }}</AppButton>
    </div>
  </div>
</template>
