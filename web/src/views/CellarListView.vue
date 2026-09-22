<script setup lang="ts">
import { computed, onMounted } from 'vue'
import GardeStatusBadge from '../components/GardeStatusBadge.vue'
import { useAppellations } from '../composables/useAppellations'
import { useWines } from '../composables/useWines'
import { computeGardeStatus } from '../domain/gardeStatus'

const { wines, loading: winesLoading, error: winesError, load: loadWines } = useWines()
const {
  appellations,
  loading: appellationsLoading,
  error: appellationsError,
  load: loadAppellations,
} = useAppellations()

const loading = computed(() => winesLoading.value || appellationsLoading.value)
const error = computed(() =>
  [winesError.value, appellationsError.value].filter((e): e is string => e !== null).join('; '),
)
const hasError = computed(() => error.value !== '')

const appellationNameById = computed(() => {
  const map = new Map<number, string>()
  for (const a of appellations.value) map.set(a.id, a.name)
  return map
})

function appellationName(appellationId: number): string {
  return appellationNameById.value.get(appellationId) ?? 'Unknown appellation'
}

onMounted(() => {
  loadWines()
  loadAppellations()
})
</script>

<template>
  <section class="px-6 py-4">
    <p v-if="loading" role="status" class="text-stone-600">Loading your cellar…</p>
    <p v-else-if="hasError" role="alert" class="text-red-700">
      Couldn't load your cellar: {{ error }}
    </p>
    <ul v-else data-testid="wine-list" class="divide-y divide-stone-200">
      <li
        v-for="wine in wines"
        :key="wine.id"
        data-testid="wine-item"
        class="flex flex-wrap items-center gap-3 py-3"
      >
        <span class="font-medium text-stone-900">{{ wine.producer }}</span>
        <span class="text-stone-600">{{ appellationName(wine.appellation_id) }}</span>
        <span class="text-stone-600">{{ wine.millesime ?? 'NV' }}</span>
        <span class="text-stone-600">{{ wine.color }}</span>
        <span class="text-stone-600">Qty: {{ wine.quantity }}</span>
        <GardeStatusBadge :status="computeGardeStatus(wine)" />
      </li>
    </ul>
  </section>
</template>
