<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
</script>

<template>
  <div>
    <p class="text-ink mt-4 text-sm">{{ t('consent.intro') }}</p>

    <h3 class="text-ink mt-5 text-sm font-semibold">{{ t('consent.whatTitle') }}</h3>
    <ul class="text-ink mt-1 list-disc pl-5 text-sm">
      <li>{{ t('consent.what.copy') }}</li>
      <li>{{ t('consent.what.queue') }}</li>
      <li>{{ t('consent.what.cache') }}</li>
    </ul>

    <h3 class="text-ink mt-5 text-sm font-semibold">{{ t('consent.whyTitle') }}</h3>
    <p class="text-ink mt-1 text-sm">{{ t('consent.why') }}</p>

    <h3 class="text-ink mt-5 text-sm font-semibold">{{ t('consent.refuseTitle') }}</h3>
    <p class="text-ink mt-1 text-sm">{{ t('consent.refuse') }}</p>

    <p class="text-muted mt-5 text-sm">{{ t('consent.signIn') }}</p>
    <p class="text-muted mt-1 text-sm">{{ t('consent.necessary') }}</p>
    <p class="text-muted mt-1 text-sm">{{ t('consent.later') }}</p>
  </div>
</template>
