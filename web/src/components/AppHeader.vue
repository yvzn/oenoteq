<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <header class="border-b border-stone-200 bg-stone-50 px-6 py-4">
    <h1 class="font-serif text-xl text-stone-900">Wine Cellar</h1>
    <nav class="mt-2 flex gap-4 text-sm text-stone-700">
      <RouterLink to="/" class="hover:text-stone-900">Cellar</RouterLink>
      <RouterLink to="/meal-pairings" class="hover:text-stone-900">Meal pairings</RouterLink>
    </nav>
  </header>
</template>
