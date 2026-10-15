<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import AppButton from '../components/AppButton.vue'
import ConsentDownload from '../components/ConsentDownload.vue'
import ConsentExplanation from '../components/ConsentExplanation.vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import PageHeader from '../components/PageHeader.vue'
import WithdrawalDialogs from '../components/WithdrawalDialogs.vue'
import { useGranting } from '../consent/useGranting'
import { useWithdrawal } from '../consent/useWithdrawal'
import { safeDestination } from '../router/consentGuard'

const { t } = useI18n()
const route = useRoute()
const destination = computed(() => safeDestination(route.query.redirect))

const granting = useGranting(() => destination.value)
// Refusing is the withdrawal flow: an install from before consent, or a failed first
// download, may already hold a store, a queue and a service worker.
const withdrawal = useWithdrawal(() => destination.value)
</script>

<template>
  <section class="px-6 py-6">
    <div class="mx-auto max-w-2xl">
      <PageHeader :title="t('consent.title')" />

      <div v-if="granting.phase.value === 'idle'" data-testid="consent-choices">
        <ConsentExplanation />

        <!-- Equal weight on purpose: same variant, same size, neither pre-selected. -->
        <div class="mt-6 flex flex-col gap-4 sm:flex-row">
          <div class="flex flex-1 flex-col gap-1">
            <AppButton variant="primary" data-testid="consent-allow" @click="granting.allow">{{ t('consent.allow') }}</AppButton>
            <p class="text-muted text-xs">{{ t('consent.allowHint') }}</p>
          </div>
          <div class="flex flex-1 flex-col gap-1">
            <AppButton variant="primary" data-testid="consent-refuse" @click="withdrawal.start">{{ t('consent.refuseAction') }}</AppButton>
            <p class="text-muted text-xs">{{ t('consent.refuseHint') }}</p>
          </div>
        </div>
      </div>

      <ConsentDownload
        v-else
        :phase="granting.phase.value"
        :progress="granting.progress.value"
        @retry="granting.retry"
        @refuse="withdrawal.start"
      />

      <WithdrawalDialogs
        :phase="withdrawal.phase.value"
        :unsent="withdrawal.unsent.value"
        @confirm="withdrawal.confirm"
        @cancel="withdrawal.cancel"
        @retry="withdrawal.start"
      />

      <div class="mt-6"><LanguageSwitcher /></div>
    </div>
  </section>
</template>
