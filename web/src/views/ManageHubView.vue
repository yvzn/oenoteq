<script setup lang="ts">
import PageHeader from '../components/PageHeader.vue'

const links = [
  { to: { name: 'meals' }, testid: 'manage-link-meals', label: 'Meals', description: 'Rename or remove Meals.' },
  {
    to: { name: 'appellations' },
    testid: 'manage-link-appellations',
    label: 'Appellations',
    description: 'Rename or remove Appellations.',
  },
  {
    to: { name: 'meal-pairings' },
    testid: 'manage-link-meal-pairings',
    label: 'Meal pairings',
    description: 'Pair Wines with Meals.',
  },
]
</script>

<template>
  <section class="px-6 py-6">
    <div class="mx-auto max-w-2xl">
      <PageHeader title="Manage" />

      <ul data-testid="manage-hub-list" class="mt-4 flex flex-col gap-3">
        <li v-for="link in links" :key="link.testid">
          <RouterLink
            :to="link.to"
            :data-testid="link.testid"
            class="border-line bg-parchment-raised hover:border-bordeaux block rounded-lg border px-4 py-3 transition-colors"
          >
            <p class="text-ink text-sm font-semibold">{{ link.label }}</p>
            <p class="text-muted mt-0.5 text-sm">{{ link.description }}</p>
          </RouterLink>
        </li>
      </ul>
    </div>
  </section>
</template>
