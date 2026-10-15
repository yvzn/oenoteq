<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppButton from '../components/AppButton.vue'
import ConsentDownload from '../components/ConsentDownload.vue'
import ConsentExplanation from '../components/ConsentExplanation.vue'
import PageHeader from '../components/PageHeader.vue'
import WithdrawalDialogs from '../components/WithdrawalDialogs.vue'
import { isOfflineMode } from '../consent/storageConsent'
import { useGranting } from '../consent/useGranting'
import { useWithdrawal } from '../consent/useWithdrawal'

const { t } = useI18n()

// Read once: a change reloads the page into the new mode rather than flipping this screen.
const granted = isOfflineMode()
// Both changes come back to this screen, now in the new mode.
const here = '/storage'
const granting = useGranting(() => here)
const withdrawal = useWithdrawal(() => here)
</script>

<template>
  <section class="px-6 py-6">
    <div class="mx-auto max-w-2xl">
      <PageHeader :title="t('storage.title')" />

      <div v-if="granting.phase.value === 'idle'">
        <p class="text-ink mt-4 text-sm font-semibold" data-testid="storage-current">
          {{ granted ? t('storage.currentGranted') : t('storage.currentRefused') }}
        </p>

        <ConsentExplanation />

        <div class="mt-6">
          <AppButton v-if="granted" variant="primary" data-testid="storage-withdraw" @click="withdrawal.start">
            {{ t('storage.withdraw') }}
          </AppButton>
          <AppButton v-else variant="primary" data-testid="storage-grant" @click="granting.allow">
            {{ t('storage.grant') }}
          </AppButton>
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
    </div>
  </section>
</template>
