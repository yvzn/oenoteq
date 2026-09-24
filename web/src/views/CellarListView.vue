<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '../components/AppButton.vue'
import ColorSwatch from '../components/ColorSwatch.vue'
import FilterBar from '../components/FilterBar.vue'
import GardeStatusBadge from '../components/GardeStatusBadge.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusLine from '../components/StatusLine.vue'
import { useAppellations } from '../composables/useAppellations'
import { useMeals } from '../composables/useMeals'
import { useSearch } from '../composables/useSearch'
import { filtersToQueryParams, queryParamsToFilters, type SearchFilters } from '../domain/searchFilters'

const route = useRoute()
const router = useRouter()

const {
  appellations,
  loading: appellationsLoading,
  error: appellationsError,
  load: loadAppellations,
} = useAppellations()
const { meals, loading: mealsLoading, error: mealsError, load: loadMeals } = useMeals()
const { results, loading: searchLoading, error: searchError, search } = useSearch()

const filters = computed<SearchFilters>(() => queryParamsToFilters(route.query))

const loading = computed(
  () => appellationsLoading.value || mealsLoading.value || searchLoading.value,
)
const error = computed(() =>
  [appellationsError.value, mealsError.value, searchError.value]
    .filter((e): e is string => e !== null)
    .join('; '),
)
const hasError = computed(() => error.value !== '')

const listTitle = computed(() => {
  if (loading.value || hasError.value) return 'Cellar'
  return `${results.value.length} ${results.value.length === 1 ? 'wine' : 'wines'} in cellar`
})

const appellationNameById = computed(() => {
  const map = new Map<number, string>()
  for (const a of appellations.value) map.set(a.id, a.name)
  return map
})

function appellationName(appellationId: number): string {
  return appellationNameById.value.get(appellationId) ?? 'Unknown appellation'
}

function updateFilters(next: SearchFilters) {
  router.push({ query: filtersToQueryParams(next) })
}

function loadFilterOptions() {
  loadAppellations()
  loadMeals()
}

function retry() {
  loadFilterOptions()
  search(filters.value)
}

watch(filters, (next) => search(next), { immediate: true })

onMounted(loadFilterOptions)
</script>

<template>
  <section>
    <FilterBar
      :filters="filters"
      :appellations="appellations"
      :meals="meals"
      @update:filters="updateFilters"
    />

    <div class="mx-auto max-w-2xl px-6 py-6">
      <PageHeader :title="listTitle">
        <template #actions>
          <AppButton :to="{ name: 'wine-new' }" data-testid="add-wine-link">Add wine</AppButton>
        </template>
      </PageHeader>

      <StatusLine v-if="loading" class="mt-6">Loading your cellar…</StatusLine>
      <StatusLine v-else-if="hasError" tone="error" class="mt-6">
        Couldn't load your cellar: {{ error }}
        <template #retry>
          <AppButton variant="ghost" data-testid="cellar-retry" @click="retry">Retry</AppButton>
        </template>
      </StatusLine>
      <StatusLine v-else-if="results.length === 0" class="mt-6">
        No wines match these filters.
      </StatusLine>
      <template v-else>
        <div
          class="border-line mt-8 hidden grid-cols-[5px_1fr_78px_60px_118px] gap-5 border-b px-[22px] pb-2.5 sm:grid"
        >
          <div></div>
          <div class="text-label text-xs font-medium">Wine</div>
          <div class="text-label text-right text-xs font-medium">Vintage</div>
          <div class="text-label text-right text-xs font-medium">Qty</div>
          <div class="text-label text-right text-xs font-medium">Status</div>
        </div>
        <ul data-testid="wine-list" class="mt-2 flex flex-col sm:mt-0">
          <li v-for="wine in results" :key="wine.id" data-testid="wine-item" class="border-line border-b">
            <RouterLink
              :to="{ name: 'wine-detail', params: { id: wine.id } }"
              data-testid="wine-link"
              class="hover:bg-parchment-raised grid grid-cols-[5px_1fr] items-center gap-4 px-[22px] py-4 transition-colors sm:grid-cols-[5px_1fr_78px_60px_118px] sm:gap-5"
            >
              <ColorSwatch :color="wine.color" variant="rail" />
              <div class="min-w-0">
                <div class="font-display text-ink text-[19px] leading-[1.25] font-semibold">
                  {{ wine.producer }}
                </div>
                <div class="text-muted mt-0.5 text-[13.5px] capitalize">
                  {{ wine.color }} · {{ appellationName(wine.appellation_id) }}
                </div>
                <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 sm:hidden">
                  <span class="text-ink-soft text-[14px] tabular-nums">{{ wine.millesime ?? 'NV' }}</span>
                  <span class="text-ink-soft text-[14px] tabular-nums">×{{ wine.quantity }}</span>
                  <GardeStatusBadge :status="wine.garde_status" />
                </div>
              </div>
              <div class="text-ink-soft hidden text-right text-[15px] tabular-nums sm:block">
                {{ wine.millesime ?? 'NV' }}
              </div>
              <div class="text-ink-soft hidden text-right text-[15px] tabular-nums sm:block">×{{ wine.quantity }}</div>
              <div class="hidden text-right sm:block"><GardeStatusBadge :status="wine.garde_status" /></div>
            </RouterLink>
          </li>
        </ul>
      </template>
    </div>
  </section>
</template>
