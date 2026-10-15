<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { isOfflineMode } from '../consent/storageConsent'
import { useConnectivity } from '../composables/useConnectivity'

const { t } = useI18n()
const router = useRouter()
const offlineMode = isOfflineMode()
const { isOnline } = useConnectivity()

function goToSyncStatus() {
  router.push({ name: 'sync-status' })
}
</script>

<template>
  <!-- Without Offline Mode nothing is saved locally and there is no sync page to point to. -->
  <component
    :is="offlineMode ? 'button' : 'div'"
    v-if="!isOnline"
    :type="offlineMode ? 'button' : undefined"
    data-testid="offline-banner"
    role="status"
    class="border-line bg-parchment-raised fixed bottom-4 left-1/2 z-20 flex max-w-xs -translate-x-1/2 items-center gap-3 rounded-lg border px-4 py-2 text-left text-sm shadow-lg max-[360px]:w-[calc(100vw-1rem)] max-[360px]:py-3"
    @click="offlineMode && goToSyncStatus()"
  >
    <span v-if="offlineMode" class="text-danger">{{ t('offline.bannerSavedLocally') }}</span>
    <span v-else class="text-danger">{{ t('offline.bannerNotSaved') }}</span>
  </component>
</template>
