<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import PageHeader from '../components/PageHeader.vue'

const { t } = useI18n()

const links = [
  { to: { name: 'meals' }, testid: 'manage-link-meals', area: 'meals' },
  { to: { name: 'appellations' }, testid: 'manage-link-appellations', area: 'appellations' },
  { to: { name: 'producers' }, testid: 'manage-link-producers', area: 'producers' },
  { to: { name: 'meal-pairings' }, testid: 'manage-link-meal-pairings', area: 'mealPairings' },
]
</script>

<template>
  <section class="px-6 py-6">
    <div class="mx-auto max-w-2xl">
      <PageHeader :title="t('manage.title')" />

      <ul data-testid="manage-hub-list" class="mt-4 flex flex-col gap-3">
        <li v-for="link in links" :key="link.testid">
          <RouterLink
            :to="link.to"
            :data-testid="link.testid"
            class="border-line bg-parchment-raised hover:border-bordeaux block rounded-lg border px-4 py-3 transition-colors"
          >
            <p class="text-ink text-sm font-semibold">{{ t(`manage.${link.area}.label`) }}</p>
            <p class="text-muted mt-0.5 text-sm">{{ t(`manage.${link.area}.description`) }}</p>
          </RouterLink>
        </li>
      </ul>
    </div>
  </section>
</template>
