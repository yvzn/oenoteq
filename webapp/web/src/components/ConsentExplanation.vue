<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <!-- The full detail, folded away: the buttons and lead must make sense without it. -->
  <details data-testid="consent-details" class="mt-6">
    <summary class="text-bordeaux cursor-pointer text-sm font-semibold underline-offset-2 hover:underline">
      {{ t('consent.details') }}
    </summary>
    <ul class="text-ink mt-2 list-disc pl-5 text-sm">
      <li>{{ t('consent.what.copy') }}</li>
      <li>{{ t('consent.what.queue') }}</li>
      <li>{{ t('consent.what.cache') }}</li>
    </ul>
    <p class="text-ink mt-3 text-sm">{{ t('consent.refuse') }}</p>
    <p class="text-muted mt-3 text-sm">{{ t('consent.signIn') }}</p>
    <p class="text-muted mt-1 text-sm">{{ t('consent.necessary') }}</p>
  </details>
</template>
