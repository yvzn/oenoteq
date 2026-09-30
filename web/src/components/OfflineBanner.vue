<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useConnectivity } from '../composables/useConnectivity'

const router = useRouter()
const { isOnline } = useConnectivity()

function goToSyncStatus() {
  router.push({ name: 'sync-status' })
}
</script>

<template>
  <button
    v-if="!isOnline"
    type="button"
    data-testid="offline-banner"
    role="status"
    class="border-line bg-parchment-raised fixed top-4 left-4 z-20 flex max-w-xs items-center gap-3 rounded-lg border px-4 py-2 text-left text-sm shadow-lg"
    @click="goToSyncStatus"
  >
    <span class="text-danger">
      No network — changes are saved locally and will sync when you're back online.
    </span>
  </button>
</template>
