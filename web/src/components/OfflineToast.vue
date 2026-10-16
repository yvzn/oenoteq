<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { isOfflineMode } from '../consent/storageConsent'
import { useConnectivity } from '../composables/useConnectivity'
import { useSuccessMessage } from '../composables/useSuccessMessage'

const { t } = useI18n()
const offlineMode = isOfflineMode()
const { isOnline } = useConnectivity()
const { show } = useSuccessMessage()

// One toast per online → offline transition; reconnecting says nothing (the sync pill covers it).
watch(
  isOnline,
  (online) => {
    if (!online) show(t(offlineMode ? 'offline.bannerSavedLocally' : 'offline.bannerNotSaved'))
  },
  { immediate: true },
)
</script>

<template>
  <span hidden />
</template>
