<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import AppButton from '../components/AppButton.vue'
import ColorSwatch from '../components/ColorSwatch.vue'
import FilterBar from '../components/FilterBar.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusLine from '../components/StatusLine.vue'
import { useAppellations } from '../composables/useAppellations'
import { useConsumptionHistory } from '../composables/useConsumptionHistory'
import {
  consumptionHistorySortAxes,
  consumptionHistorySortToQueryParams,
  defaultConsumptionHistorySort,
  nextConsumptionHistorySort,
  queryParamsToConsumptionHistorySort,
  type ConsumptionHistorySort,
  type ConsumptionHistorySortBy,
} from '../domain/consumptionHistorySort'
import { pageToQueryParams, paginate, parsePage } from '../domain/pagination'
import { emptyCommonFilters } from '../domain/searchFilters'
import { formatDate, formatYear } from '../i18n/formatters'
import type { Locale } from '../i18n/locales'
import { setListRendered } from '../router/listScroll'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()

const {
  appellations,
  loading: appellationsLoading,
  error: appellationsError,
  load: loadAppellations,
} = useAppellations()
const { entries, loading: historyLoading, error: historyError, load: loadHistory } = useConsumptionHistory()

const sort = computed<ConsumptionHistorySort>(() => queryParamsToConsumptionHistorySort(route.query))

const pageData = computed(() => paginate(entries.value, parsePage(route.query.page)))

const loading = computed(() => appellationsLoading.value || historyLoading.value)
const error = computed(() =>
  [appellationsError.value, historyError.value].filter((e): e is string => e !== null).join('; '),
)

const listTitle = computed(() => {
  if (loading.value || error.value) return t('history.title')
  return t('history.count', pageData.value.total)
})

function millesimeText(millesime: number | null): string {
  return millesime === null ? t('cellar.list.noMillesime') : formatYear(millesime, locale.value as Locale)
}

function dateText(isoDate: string): string {
  return formatDate(isoDate, locale.value as Locale)
}

const appellationNameById = computed(() => {
  const map = new Map<number, string>()
  for (const a of appellations.value) map.set(a.id, a.name)
  return map
})

function appellationName(appellationId: number): string {
  return appellationNameById.value.get(appellationId) ?? t('cellar.list.unknownAppellation')
}

// Sort axes that are wine vocabulary share the vocabulary labels; Date is the page's own column.
function axisLabel(sortBy: ConsumptionHistorySortBy): string {
  return sortBy === 'date' ? t('history.sort.date') : t(`vocabulary.${sortBy}`)
}

function updateSort(next: ConsumptionHistorySort) {
  router.push({ query: consumptionHistorySortToQueryParams(next) })
}

function goToPage(page: number) {
  router.push({ query: { ...consumptionHistorySortToQueryParams(sort.value), ...pageToQueryParams(page) } })
}

function sortByColumn(column: ConsumptionHistorySortBy) {
  updateSort(nextConsumptionHistorySort(sort.value, column))
}

function sortIndicator(column: ConsumptionHistorySortBy) {
  if (sort.value.sortBy !== column) return ''
  return sort.value.sortDir === 'asc' ? '↑' : '↓'
}

function retry() {
  loadAppellations()
  loadHistory(sort.value)
}

// Keyed on the sort only: a page change must not refetch.
const historyKey = computed(() => new URLSearchParams(consumptionHistorySortToQueryParams(sort.value)).toString())

watch(historyKey, () => loadHistory(sort.value), { immediate: true })

// The router restores the scroll offset on back navigation once told the rows are there.
watch(loading, (isLoading) => setListRendered(!isLoading), { immediate: true, flush: 'post' })
onBeforeUnmount(() => setListRendered(false))

onMounted(loadAppellations)
</script>

<template>
  <section>
    <FilterBar
      :filters="emptyCommonFilters"
      :sort="sort"
      :appellations="appellations"
      :meals="[]"
      :empty-filters="emptyCommonFilters"
      :sort-axes="consumptionHistorySortAxes"
      :axis-label="axisLabel"
      :default-sort="defaultConsumptionHistorySort"
      @update:sort="updateSort"
    />

    <div class="mx-auto max-w-2xl px-6 py-6 sm:px-8 sm:py-10">
      <PageHeader :title="listTitle" />

      <StatusLine v-if="loading" class="mt-6">{{ t('history.loading') }}</StatusLine>
      <StatusLine v-else-if="error" tone="error" class="mt-6">
        {{ t('history.loadError', { error }) }}
        <template #retry>
          <AppButton variant="ghost" data-testid="history-retry" @click="retry">{{ t('actions.retry') }}</AppButton>
        </template>
      </StatusLine>
      <StatusLine v-else-if="entries.length === 0" class="mt-6">
        {{ t('history.empty') }}
      </StatusLine>
      <template v-else>
        <div
          data-testid="consumption-columns"
          class="border-line mt-8 hidden grid-cols-[5px_1fr_78px_150px] gap-5 border-b px-[22px] pb-2.5 sm:grid"
        >
          <div></div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              data-testid="sort-header-producer"
              class="text-label flex cursor-pointer items-center gap-1 text-xs font-medium"
              @click="sortByColumn('producer')"
            >
              {{ t('vocabulary.producer') }} <span aria-hidden="true">{{ sortIndicator('producer') }}</span>
            </button>
            <button
              type="button"
              data-testid="sort-header-appellation"
              class="text-label flex cursor-pointer items-center gap-1 text-xs font-medium"
              @click="sortByColumn('appellation')"
            >
              {{ t('vocabulary.appellation') }} <span aria-hidden="true">{{ sortIndicator('appellation') }}</span>
            </button>
          </div>
          <button
            type="button"
            data-testid="sort-header-millesime"
            class="text-label flex cursor-pointer items-center justify-end gap-1 text-right text-xs font-medium"
            @click="sortByColumn('millesime')"
          >
            {{ t('vocabulary.millesime') }} <span aria-hidden="true">{{ sortIndicator('millesime') }}</span>
          </button>
          <button
            type="button"
            data-testid="sort-header-date"
            class="text-label flex cursor-pointer items-center justify-end gap-1 text-right text-xs font-medium"
            @click="sortByColumn('date')"
          >
            {{ t('history.columns.date') }} <span aria-hidden="true">{{ sortIndicator('date') }}</span>
          </button>
        </div>
        <ul data-testid="consumption-list" class="mt-2 flex flex-col sm:mt-0">
          <li
            v-for="entry in pageData.items"
            :key="entry.id"
            data-testid="consumption-item"
            class="border-line border-b"
          >
            <RouterLink
              :to="{ name: 'wine-detail', params: { id: entry.wine_id } }"
              data-testid="consumption-link"
              class="hover:bg-parchment-raised grid grid-cols-[5px_1fr] items-center gap-4 px-[22px] py-4 transition-colors sm:grid-cols-[5px_1fr_78px_150px] sm:gap-5"
            >
              <ColorSwatch :color="entry.color" variant="rail" />
              <div class="min-w-0">
                <div class="font-display text-ink text-[19px] leading-[1.25] font-semibold">
                  {{ entry.producer.name }}
                </div>
                <div class="text-muted mt-0.5 text-[13.5px]">
                  {{ t(`color.${entry.color}`) }} · {{ appellationName(entry.appellation_id) }}
                </div>
                <div
                  data-testid="consumption-item-mobile-meta"
                  class="text-ink-soft mt-2 text-[14px] tabular-nums sm:hidden"
                >
                  {{ millesimeText(entry.millesime) }} · {{ dateText(entry.date) }}
                </div>
              </div>
              <div class="text-ink-soft hidden text-right text-[15px] tabular-nums sm:block">
                {{ millesimeText(entry.millesime) }}
              </div>
              <div class="text-ink-soft hidden text-right text-[15px] tabular-nums sm:block">
                {{ dateText(entry.date) }}
              </div>
            </RouterLink>
          </li>
        </ul>
        <nav
          v-if="pageData.pageCount > 1"
          data-testid="pagination"
          :aria-label="t('history.pagination.label')"
          class="mt-6 flex items-center justify-between gap-4"
        >
          <AppButton
            variant="secondary"
            data-testid="pagination-previous"
            :disabled="pageData.page <= 1"
            @click="goToPage(pageData.page - 1)"
          >
            {{ t('cellar.pagination.previous') }}
          </AppButton>
          <span data-testid="pagination-status" class="text-muted text-sm tabular-nums">
            {{ t('cellar.pagination.status', { page: pageData.page, pageCount: pageData.pageCount }) }}
          </span>
          <AppButton
            variant="secondary"
            data-testid="pagination-next"
            :disabled="pageData.page >= pageData.pageCount"
            @click="goToPage(pageData.page + 1)"
          >
            {{ t('cellar.pagination.next') }}
          </AppButton>
        </nav>
      </template>
    </div>
  </section>
</template>
