<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Appellation, Meal } from '../api/types'
import { emptySearchFilters, type SearchFilters } from '../domain/searchFilters'
import { defaultWineSort, sortAxes, type SortBy, type WineSort } from '../domain/wineSort'
import AppButton from './AppButton.vue'
import FilterFields from './FilterFields.vue'

const props = defineProps<{
  filters: SearchFilters
  sort: WineSort
  appellations: Appellation[]
  meals: Meal[]
}>()

const emit = defineEmits<{
  'update:filters': [value: SearchFilters]
  'update:sort': [value: WineSort]
}>()

const activeFilterCount = computed(
  () =>
    [
      props.filters.mealId !== null,
      props.filters.appellationId !== null,
      props.filters.color !== null,
      props.filters.readyNow,
    ].filter(Boolean).length,
)

const hasActiveFilters = computed(() => activeFilterCount.value > 0)

const isDefaultSort = computed(
  () => props.sort.sortBy === defaultWineSort.sortBy && props.sort.sortDir === defaultWineSort.sortDir,
)

function clearFilters() {
  emit('update:filters', emptySearchFilters)
}

// Mobile filter panel: edits happen against a draft, only applied on demand.
const panel = ref<HTMLDialogElement | null>(null)
const panelOpen = ref(false)
const draft = ref<SearchFilters>({ ...props.filters })

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

function updateDraft(next: SearchFilters) {
  draft.value = next
}

function clearPanel() {
  draft.value = emptySearchFilters
  emit('update:filters', emptySearchFilters)
  panelOpen.value = false
}

function onPanelBackdropClick(event: MouseEvent) {
  if (event.target === panel.value) cancelPanel()
}

// Mobile sort panel: two steps (axis, then direction). Picking a direction
// applies immediately; picking an axis alone just updates the local draft.
const sortPanel = ref<HTMLDialogElement | null>(null)
const sortPanelOpen = ref(false)
const draftAxis = ref<SortBy>(props.sort.sortBy)

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

function chooseDirection(sortDir: WineSort['sortDir']) {
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
      />

      <div v-if="hasActiveFilters" class="flex h-[38px] items-center">
        <AppButton variant="ghost" type="button" data-testid="clear-filters-button" @click="clearFilters">
          Clear filters
        </AppButton>
      </div>
    </form>

    <div class="border-line bg-parchment-raised flex items-center gap-3 border-b px-6 py-4 sm:hidden">
      <AppButton variant="secondary" type="button" data-testid="filter-toggle-button" @click="openPanel">
        Filters<template v-if="activeFilterCount > 0"> ({{ activeFilterCount }})</template>
      </AppButton>
      <AppButton variant="secondary" type="button" data-testid="sort-toggle-button" @click="openSortPanel">
        Sort<template v-if="!isDefaultSort"> {{ sort.sortDir === 'asc' ? '↑' : '↓' }}</template>
      </AppButton>
      <AppButton
        v-if="hasActiveFilters"
        variant="ghost"
        type="button"
        data-testid="mobile-clear-filters-button"
        @click="clearFilters"
      >
        Clear filters
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
        <h2 class="font-display text-ink text-base">Filters</h2>
        <button
          type="button"
          data-testid="filter-panel-close"
          aria-label="Close filters"
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
        />
      </div>

      <div class="mt-6 flex items-center justify-between">
        <AppButton variant="ghost" type="button" data-testid="filter-panel-clear" @click="clearPanel">
          Clear filters
        </AppButton>
        <AppButton variant="primary" type="button" data-testid="filter-panel-apply" @click="applyPanel">
          Apply
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
        <h2 class="font-display text-ink text-base">Sort</h2>
        <button
          type="button"
          data-testid="sort-panel-close"
          aria-label="Close sort"
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
            name="wine-sort-axis"
            :data-testid="`sort-axis-${axis.sortBy}`"
            :checked="draftAxis === axis.sortBy"
            @change="draftAxis = axis.sortBy"
          />
          {{ axis.label }}
        </label>
      </div>

      <div class="mt-6 flex items-center gap-3">
        <AppButton
          variant="secondary"
          type="button"
          data-testid="sort-direction-asc"
          @click="chooseDirection('asc')"
        >
          ↑ Ascending
        </AppButton>
        <AppButton
          variant="secondary"
          type="button"
          data-testid="sort-direction-desc"
          @click="chooseDirection('desc')"
        >
          ↓ Descending
        </AppButton>
      </div>
    </dialog>
  </div>
</template>
