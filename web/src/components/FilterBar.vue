<script setup lang="ts">
import { computed } from 'vue'
import type { Appellation, Color, Meal } from '../api/types'
import { emptySearchFilters, type SearchFilters } from '../domain/searchFilters'
import AppButton from './AppButton.vue'
import AutocompleteField from './AutocompleteField.vue'
import ColorSwatch from './ColorSwatch.vue'
import FormField from './FormField.vue'

const props = defineProps<{
  filters: SearchFilters
  appellations: Appellation[]
  meals: Meal[]
}>()

const emit = defineEmits<{ 'update:filters': [value: SearchFilters] }>()

const colors: Color[] = ['rouge', 'blanc', 'rose']

const hasActiveFilters = computed(
  () =>
    props.filters.mealId !== null ||
    props.filters.appellationId !== null ||
    props.filters.color !== null ||
    props.filters.readyNow,
)

function update(patch: Partial<SearchFilters>) {
  emit('update:filters', { ...props.filters, ...patch })
}

function clearFilters() {
  emit('update:filters', emptySearchFilters)
}
</script>

<template>
  <form class="border-line bg-parchment-raised flex flex-wrap items-end gap-4 border-b px-6 py-4" @submit.prevent>
    <FormField label="Meal" class="w-40">
      <AutocompleteField
        testid="meal-filter"
        :items="meals"
        :model-value="filters.mealId"
        placeholder="Any meal"
        @update:model-value="(v) => update({ mealId: v })"
      />
    </FormField>

    <FormField label="Appellation" class="w-40">
      <AutocompleteField
        testid="appellation-filter"
        :items="appellations"
        :model-value="filters.appellationId"
        placeholder="Any appellation"
        @update:model-value="(v) => update({ appellationId: v })"
      />
    </FormField>

    <FormField label="Color" class="w-40">
      <div class="flex items-center gap-2">
        <ColorSwatch v-if="filters.color" :color="filters.color" class="shrink-0" />
        <select
          data-testid="color-filter"
          class="w-full text-sm"
          :value="filters.color ?? ''"
          @change="update({ color: (($event.target as HTMLSelectElement).value || null) as Color | null })"
        >
          <option value="">Any color</option>
          <option v-for="c in colors" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
    </FormField>

    <label class="text-muted flex cursor-pointer items-center gap-2 pb-1.5 text-xs">
      <input
        type="checkbox"
        data-testid="ready-now-filter"
        class="peer sr-only"
        :checked="filters.readyNow"
        @change="update({ readyNow: ($event.target as HTMLInputElement).checked })"
      />
      <span
        class="border-line bg-parchment-raised peer-checked:bg-bordeaux peer-checked:border-bordeaux peer-focus-visible:ring-bordeaux/40 text-transparent peer-checked:text-white inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2"
        aria-hidden="true"
      >
        <svg viewBox="0 0 12 12" class="h-2.5 w-2.5">
          <path d="M2.5 6.3 4.9 8.6 9.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </span>
      Ready now
    </label>

    <div v-if="hasActiveFilters" class="flex items-center pb-1.5">
      <AppButton variant="ghost" type="button" data-testid="clear-filters-button" @click="clearFilters">
        Clear filters
      </AppButton>
    </div>
  </form>
</template>
