<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'
import { isOfflineMode } from '../consent/storageConsent'
import { useConnectivity } from '../composables/useConnectivity'
import { useSyncStatus } from '../composables/useSyncStatus'
import LanguageToggle from './LanguageToggle.vue'

const { t } = useI18n()
const route = useRoute()
const { failed, queuedCount, isSyncing, syncAllNow } = useSyncStatus()
const { isOnline } = useConnectivity()
const offlineMode = isOfflineMode()

// One state, most urgent first: failed > offline > syncing > pending > synced.
const pill = computed(() => {
  const count = queuedCount.value
  if (failed.value.length > 0) {
    // Retry only makes sense with a connection.
    return { label: t(isOnline.value ? 'sync.pill.failedRetry' : 'sync.pill.failed'), startsSync: isOnline.value }
  }
  if (!isOnline.value) {
    return { label: count > 0 ? t('sync.pill.offlineSaved', { count }, count) : t('sync.pill.offline'), startsSync: false }
  }
  if (isSyncing.value) return { label: t('sync.pill.syncing'), startsSync: false }
  if (count > 0) return { label: t('sync.pill.pending', { count }, count), startsSync: true }
  return { label: t('sync.pill.synced'), startsSync: false }
})

// Navigation is the link's own; a sync-starting state also kicks one off (syncAllNow ignores a second call mid-run).
function onPillClick(): void {
  if (pill.value.startsSync) void syncAllNow()
}

const manageRouteNames = [
  'manage',
  'meals',
  'meal-new',
  'meal-edit',
  'appellations',
  'appellation-new',
  'appellation-edit',
  'meal-pairings',
]

const isCellar = computed(() => route.name === 'cellar' || route.name === 'wine-detail')
const isManage = computed(() => manageRouteNames.includes(route.name as string))
</script>

<template>
  <!-- The pill is rendered once; the grid puts it top right from 640px and at the end of the tabs row below that. -->
  <header class="border-line bg-parchment-raised grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-b px-6 py-5">
    <a href="/" class="col-start-1 row-start-1 block w-fit">
      <p class="text-muted text-[11px] tracking-widest uppercase">Oenoteq</p>
      <h1 class="font-display text-ink mt-0.5 text-base leading-none">{{ t('app.name') }}</h1>
    </a>
    <RouterLink
      v-if="offlineMode"
      :to="{ name: 'sync-status' }"
      data-testid="sync-pill"
      class="border-line text-muted hover:text-ink col-span-2 col-start-2 row-start-2 mt-4 justify-self-end rounded-full border px-2.5 py-1 text-[12px] font-medium whitespace-nowrap sm:col-span-1 sm:row-start-1 sm:mt-0"
      @click="onPillClick"
    >
      {{ pill.label }}
    </RouterLink>
    <div class="col-start-3 row-start-1 flex items-center gap-4">
      <LanguageToggle />
    </div>
    <div class="col-start-1 row-start-2 mt-4">
      <nav class="flex gap-6 text-sm">
        <RouterLink
          to="/"
          class="text-muted hover:text-ink border-b-2 pb-1"
          :class="isCellar ? 'text-bordeaux border-bordeaux font-medium' : 'border-transparent'"
        >
          {{ t('nav.cellar') }}
        </RouterLink>
        <RouterLink
          to="/manage"
          class="text-muted hover:text-ink border-b-2 pb-1"
          :class="isManage ? 'text-bordeaux border-bordeaux font-medium' : 'border-transparent'"
        >
          {{ t('nav.manage') }}
        </RouterLink>
      </nav>
    </div>
  </header>
</template>
