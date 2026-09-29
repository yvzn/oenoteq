<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

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
    <nav class="mt-4 flex gap-6 text-sm">
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
  </header>
</template>
