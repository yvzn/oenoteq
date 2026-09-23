<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const isCellar = computed(() => route.name === 'cellar' || route.name === 'wine-detail')
const isMealPairings = computed(() => route.name === 'meal-pairings')
</script>

<template>
  <header class="border-line bg-parchment-raised border-b px-6 py-4">
    <h1 class="font-display text-ink text-xl">Wine Cellar</h1>
    <p class="text-muted text-xs tracking-widest uppercase">Private cellar</p>
    <nav class="mt-3 flex gap-6 text-sm">
      <RouterLink
        to="/"
        class="text-muted hover:text-ink border-b-2 pb-1"
        :class="isCellar ? 'text-ink border-gold' : 'border-transparent'"
      >
        Cellar
      </RouterLink>
      <RouterLink
        to="/meal-pairings"
        class="text-muted hover:text-ink border-b-2 pb-1"
        :class="isMealPairings ? 'text-ink border-gold' : 'border-transparent'"
      >
        Meal pairings
      </RouterLink>
    </nav>
  </header>
</template>
