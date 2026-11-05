<script setup lang="ts" generic="F extends CommonFilters, S extends string">
import { computed, ref, shallowRef, watch, type ShallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Appellation, Meal } from '../api/types'
import type { CommonFilters, ExtraFiltersScope } from '../domain/searchFilters'
import type { SortDir } from '../domain/wineSort'
import AppButton from './AppButton.vue'
import FilterFields from './FilterFields.vue'

type Sort = { sortBy: S; sortDir: SortDir }

const props = defineProps<{
  filters: F
  sort: Sort
  appellations: Appellation[]
  meals: Meal[]
  emptyFilters: F
  sortAxes: { sortBy: S }[]
  axisLabel: (sortBy: S) => string
  defaultSort: Sort
}>()

const { t } = useI18n()

const emit = defineEmits<{
  'update:filters': [value: F]
  'update:sort': [value: Sort]
}>()

// Page-specific filters, forwarded to both the inline form and the mobile panel.
defineSlots<{
  extra?(scope: ExtraFiltersScope<F>): unknown
}>()

// A filter is active when it is set: not null for pickers, not false for toggles.
const activeFilterCount = computed(
  () => Object.values(props.filters).filter((value) => value !== null && value !== false).length,
)

const hasActiveFilters = computed(() => activeFilterCount.value > 0)

const isDefaultSort = computed(
  () => props.sort.sortBy === props.defaultSort.sortBy && props.sort.sortDir === props.defaultSort.sortDir,
)

function clearFilters() {
  emit('update:filters', props.emptyFilters)
}

// Mobile filter panel: edits happen against a draft, only applied on demand.
const panel = ref<HTMLDialogElement | null>(null)
const panelOpen = ref(false)
// Shallow refs: a deep ref's unwrapped type doesn't line up with a generic F or S.
const draft: ShallowRef<F> = shallowRef({ ...props.filters })

watch(panelOpen, (isOpen) => {
  if (isOpen) panel.value?.showModal()
  else panel.value?.close()
})

function openPanel() {
  draft.value = { ...props.filters }
  panelOpen.value = true
}

function applyPanel() {
  emit('update:filters', draft.value)
  panelOpen.value = false
}

function cancelPanel() {
  panelOpen.value = false
}

function updateDraft(next: F) {
  draft.value = next
}

function clearPanel() {
  draft.value = props.emptyFilters
  emit('update:filters', props.emptyFilters)
  panelOpen.value = false
}

function onPanelBackdropClick(event: MouseEvent) {
  if (event.target === panel.value) cancelPanel()
}

// Mobile sort panel: two steps (axis, then direction). Picking a direction
// applies immediately; picking an axis alone just updates the local draft.
const sortPanel = ref<HTMLDialogElement | null>(null)
const sortPanelOpen = ref(false)
const draftAxis: ShallowRef<S> = shallowRef(props.sort.sortBy)

watch(sortPanelOpen, (isOpen) => {
  if (isOpen) sortPanel.value?.showModal()
  else sortPanel.value?.close()
})

function openSortPanel() {
  draftAxis.value = props.sort.sortBy
  sortPanelOpen.value = true
}

function closeSortPanel() {
  sortPanelOpen.value = false
}

function chooseDirection(sortDir: SortDir) {
  emit('update:sort', { sortBy: draftAxis.value, sortDir })
  sortPanelOpen.value = false
}

function onSortPanelBackdropClick(event: MouseEvent) {
  if (event.target === sortPanel.value) closeSortPanel()
}
</script>

<template>
  <div>
    <form
      class="border-line bg-parchment-raised hidden flex-wrap items-end gap-4 border-b px-6 py-4 sm:flex"
      @submit.prevent
    >
      <FilterFields
        inline
        :model-value="filters"
        :appellations="appellations"
        :meals="meals"
        @update:model-value="(v) => emit('update:filters', v)"
      >
        <template #extra="scope"><slot name="extra" v-bind="scope" /></template>
      </FilterFields>

      <div v-if="hasActiveFilters" class="flex h-[38px] items-center">
        <AppButton variant="ghost" type="button" data-testid="clear-filters-button" @click="clearFilters">
          {{ t('cellar.filters.clear') }}
        </AppButton>
      </div>
    </form>

    <div class="border-line bg-parchment-raised flex items-center gap-3 border-b px-6 py-4 sm:hidden">
      <AppButton variant="secondary" type="button" data-testid="filter-toggle-button" @click="openPanel">
        {{ activeFilterCount > 0 ? t('cellar.filters.titleWithCount', { count: activeFilterCount }) : t('cellar.filters.title') }}
      </AppButton>
      <AppButton variant="secondary" type="button" data-testid="sort-toggle-button" @click="openSortPanel">
        {{ t('cellar.sort.title') }}<template v-if="!isDefaultSort"> {{ sort.sortDir === 'asc' ? '↑' : '↓' }}</template>
      </AppButton>
      <AppButton
        v-if="hasActiveFilters"
        variant="ghost"
        type="button"
        data-testid="mobile-clear-filters-button"
        @click="clearFilters"
      >
        {{ t('cellar.filters.clear') }}
      </AppButton>
    </div>

    <dialog
      ref="panel"
      data-testid="filter-panel"
      class="border-line bg-parchment-raised fixed inset-y-0 right-0 m-0 h-full w-full max-w-xs rounded-none border-l p-5 shadow-lg backdrop:bg-ink/40"
      @cancel.prevent="cancelPanel"
      @click="onPanelBackdropClick"
    >
      <div class="flex items-center justify-between">
        <h2 class="font-display text-ink text-base">{{ t('cellar.filters.title') }}</h2>
        <button
          type="button"
          data-testid="filter-panel-close"
          :aria-label="t('cellar.filters.close')"
          class="text-muted hover:text-ink cursor-pointer text-xl leading-none"
          @click="cancelPanel"
        >
          &times;
        </button>
      </div>

      <div class="mt-4 flex flex-col gap-4">
        <FilterFields
          testid-suffix="mobile"
          :model-value="draft"
          :appellations="appellations"
          :meals="meals"
          @update:model-value="updateDraft"
        >
          <template #extra="scope"><slot name="extra" v-bind="scope" /></template>
        </FilterFields>
      </div>

      <div class="mt-6 flex items-center justify-between">
        <AppButton variant="ghost" type="button" data-testid="filter-panel-clear" @click="clearPanel">
          {{ t('cellar.filters.clear') }}
        </AppButton>
        <AppButton variant="primary" type="button" data-testid="filter-panel-apply" @click="applyPanel">
          {{ t('actions.apply') }}
        </AppButton>
      </div>
    </dialog>

    <dialog
      ref="sortPanel"
      data-testid="sort-panel"
      class="border-line bg-parchment-raised fixed inset-y-0 right-0 m-0 h-full w-full max-w-xs rounded-none border-l p-5 shadow-lg backdrop:bg-ink/40"
      @cancel.prevent="closeSortPanel"
      @click="onSortPanelBackdropClick"
    >
      <div class="flex items-center justify-between">
        <h2 class="font-display text-ink text-base">{{ t('cellar.sort.title') }}</h2>
        <button
          type="button"
          data-testid="sort-panel-close"
          :aria-label="t('cellar.sort.close')"
          class="text-muted hover:text-ink cursor-pointer text-xl leading-none"
          @click="closeSortPanel"
        >
          &times;
        </button>
      </div>

      <div class="mt-4 flex flex-col gap-3">
        <label v-for="axis in sortAxes" :key="axis.sortBy" class="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="radio"
            name="sort-axis"
            :data-testid="`sort-axis-${axis.sortBy}`"
            :checked="draftAxis === axis.sortBy"
            @change="draftAxis = axis.sortBy"
          />
          {{ axisLabel(axis.sortBy) }}
        </label>
      </div>

      <div class="mt-6 flex items-center gap-3">
        <AppButton
          variant="secondary"
          type="button"
          data-testid="sort-direction-asc"
          @click="chooseDirection('asc')"
        >
          {{ t('cellar.sort.ascending') }}
        </AppButton>
        <AppButton
          variant="secondary"
          type="button"
          data-testid="sort-direction-desc"
          @click="chooseDirection('desc')"
        >
          {{ t('cellar.sort.descending') }}
        </AppButton>
      </div>
    </dialog>
  </div>
</template>
