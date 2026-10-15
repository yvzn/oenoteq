<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AppButton from '../components/AppButton.vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import PageHeader from '../components/PageHeader.vue'
import { grantConsent, refuseConsent } from '../consent/grantConsent'
import { reloadInto } from '../consent/reload'
import { safeDestination } from '../router/consentGuard'
import { syncNow } from '../sync'

const { t } = useI18n()
const route = useRoute()
const destination = computed(() => safeDestination(route.query.redirect))

type Phase = 'choosing' | 'downloading' | 'failed'
const phase = ref<Phase>('choosing')
const progress = ref({ done: 0, total: 1 })

async function download() {
  phase.value = 'downloading'
  progress.value = { done: 0, total: 1 }
  try {
    await syncNow((done, total) => (progress.value = { done, total }))
  } catch {
    phase.value = 'failed'
    return
  }
  reloadInto(destination.value)
}

function allow() {
  grantConsent()
  void download()
}

function refuse() {
  refuseConsent()
  reloadInto(destination.value)
}
</script>

<template>
  <section class="px-6 py-6">
    <div class="mx-auto max-w-2xl">
      <PageHeader :title="t('consent.title')" />

      <div v-if="phase === 'choosing'" data-testid="consent-choices">
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

        <!-- Equal weight on purpose: same variant, same size, neither pre-selected. -->
        <div class="mt-6 flex flex-col gap-4 sm:flex-row">
          <div class="flex flex-1 flex-col gap-1">
            <AppButton variant="primary" data-testid="consent-allow" @click="allow">{{ t('consent.allow') }}</AppButton>
            <p class="text-muted text-xs">{{ t('consent.allowHint') }}</p>
          </div>
          <div class="flex flex-1 flex-col gap-1">
            <AppButton variant="primary" data-testid="consent-refuse" @click="refuse">{{ t('consent.refuseAction') }}</AppButton>
            <p class="text-muted text-xs">{{ t('consent.refuseHint') }}</p>
          </div>
        </div>
      </div>

      <div v-else-if="phase === 'downloading'" role="status" data-testid="consent-progress" class="mt-6">
        <p class="text-ink text-sm font-semibold">{{ t('consent.downloadingTitle') }}</p>
        <progress class="mt-2 w-full" :value="progress.done" :max="progress.total" />
        <p class="text-muted mt-1 text-sm">{{ t('consent.progress', progress) }}</p>
      </div>

      <div v-else role="alert" data-testid="consent-error" class="mt-6">
        <p class="text-danger text-sm font-semibold">{{ t('consent.failedTitle') }}</p>
        <p class="text-ink mt-1 text-sm">{{ t('consent.failed') }}</p>
        <div class="mt-3 flex flex-wrap gap-3">
          <AppButton data-testid="consent-retry" @click="download">{{ t('consent.retry') }}</AppButton>
          <AppButton data-testid="consent-refuse" @click="refuse">{{ t('consent.refuseAction') }}</AppButton>
        </div>
      </div>

      <div class="mt-6"><LanguageSwitcher /></div>
    </div>
  </section>
</template>
