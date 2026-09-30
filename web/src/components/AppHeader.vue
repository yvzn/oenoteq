<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import { useSyncStatus } from '../composables/useSyncStatus'

const route = useRoute()
const { hasPending } = useSyncStatus()

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
  <header class="border-line bg-parchment-raised border-b px-6 py-5">
    <a href="/" class="block w-fit">
      <p class="text-muted text-[11px] tracking-widest uppercase">Oenoteq</p>
      <h1 class="font-display text-ink mt-0.5 text-base leading-none">Wine Cellar Tracker</h1>
    </a>
    <div class="mt-4 flex items-center justify-between gap-4">
      <nav class="flex gap-6 text-sm">
        <RouterLink
          to="/"
          class="text-muted hover:text-ink border-b-2 pb-1"
          :class="isCellar ? 'text-bordeaux border-bordeaux font-medium' : 'border-transparent'"
        >
          Cellar
        </RouterLink>
        <RouterLink
          to="/manage"
          class="text-muted hover:text-ink border-b-2 pb-1"
          :class="isManage ? 'text-bordeaux border-bordeaux font-medium' : 'border-transparent'"
        >
          Manage
        </RouterLink>
      </nav>
      <RouterLink
        v-if="hasPending"
        :to="{ name: 'sync-status' }"
        data-testid="sync-status-indicator"
        class="text-muted hover:text-ink text-sm"
      >
        <span aria-hidden="true">⏳</span> Sync
      </RouterLink>
    </div>
  </header>
</template>
