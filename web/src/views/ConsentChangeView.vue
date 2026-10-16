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
  <section class="px-6 py-6 sm:px-8 sm:py-10">
    <div class="mx-auto max-w-2xl">
      <PageHeader :title="t('storage.title')" />

      <div v-if="granting.phase.value === 'idle'">
        <div data-testid="storage-current" class="mt-4">
          <p class="flex items-center gap-3">
            <span class="text-ink text-sm font-semibold">{{ t('storage.offlineMode') }}</span>
            <span
              class="inline-flex items-center gap-[7px] text-[12.5px] font-semibold"
              :class="granted ? 'text-status-ready' : 'text-muted'"
            >
              <span class="h-[7px] w-[7px] rounded-full" :class="granted ? 'bg-status-ready' : 'bg-label'" aria-hidden="true"></span>
              {{ granted ? t('storage.on') : t('storage.off') }}
            </span>
          </p>
          <p class="text-muted mt-1 text-sm">{{ granted ? t('storage.currentGranted') : t('storage.currentRefused') }}</p>
          <!-- Same variant both ways: withdrawing is as easy as granting. -->
          <div class="mt-4">
            <AppButton v-if="granted" variant="secondary" data-testid="storage-withdraw" @click="withdrawal.start">
              {{ t('storage.withdraw') }}
            </AppButton>
            <AppButton v-else variant="secondary" data-testid="storage-grant" @click="granting.allow">
              {{ t('storage.grant') }}
            </AppButton>
          </div>
        </div>

        <ConsentExplanation />
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
