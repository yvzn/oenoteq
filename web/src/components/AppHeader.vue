<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const isCellar = computed(() => route.name === 'cellar' || route.name === 'wine-detail')
const isMealPairings = computed(() => route.name === 'meal-pairings')
</script>

<template>
  <header class="border-line bg-parchment-raised border-b px-6 py-5">
    <p class="text-muted text-[11px] tracking-widest uppercase">Oenoteq</p>
    <h1 class="font-display text-ink mt-0.5 text-base leading-none">Wine Cellar Tracker</h1>
    <nav class="mt-4 flex gap-6 text-sm">
      <RouterLink
        to="/"
        class="text-muted hover:text-ink border-b-2 pb-1"
        :class="isCellar ? 'text-bordeaux border-bordeaux font-medium' : 'border-transparent'"
      >
        Cellar
      </RouterLink>
      <RouterLink
        to="/meal-pairings"
        class="text-muted hover:text-ink border-b-2 pb-1"
        :class="isMealPairings ? 'text-bordeaux border-bordeaux font-medium' : 'border-transparent'"
      >
        Meal pairings
      </RouterLink>
    </nav>
  </header>
</template>
