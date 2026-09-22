<script setup lang="ts">
import type { Appellation, Color, Meal } from '../api/types'
import type { SearchFilters } from '../domain/searchFilters'
import AutocompleteField from './AutocompleteField.vue'

const props = defineProps<{
  filters: SearchFilters
  appellations: Appellation[]
  meals: Meal[]
}>()

const emit = defineEmits<{ 'update:filters': [value: SearchFilters] }>()

const colors: Color[] = ['rouge', 'blanc', 'rose']

function update(patch: Partial<SearchFilters>) {
  emit('update:filters', { ...props.filters, ...patch })
}
</script>

<template>
  <form
    class="flex flex-wrap items-end gap-4 border-b border-stone-200 px-6 py-4"
    @submit.prevent
  >
    <label class="flex w-40 flex-col text-xs text-stone-600">
      Meal
      <AutocompleteField
        testid="meal-filter"
        :items="meals"
        :model-value="filters.mealId"
        placeholder="Any meal"
        @update:model-value="(v) => update({ mealId: v })"
      />
    </label>

    <label class="flex w-40 flex-col text-xs text-stone-600">
      Appellation
      <AutocompleteField
        testid="appellation-filter"
        :items="appellations"
        :model-value="filters.appellationId"
        placeholder="Any appellation"
        @update:model-value="(v) => update({ appellationId: v })"
      />
    </label>

    <label class="flex flex-col text-xs text-stone-600">
      Color
      <select
        data-testid="color-filter"
        class="rounded border border-stone-300 px-2 py-1 text-sm"
        :value="filters.color ?? ''"
        @change="update({ color: (($event.target as HTMLSelectElement).value || null) as Color | null })"
      >
        <option value="">Any color</option>
        <option v-for="c in colors" :key="c" :value="c">{{ c }}</option>
      </select>
    </label>

    <label class="flex items-center gap-2 pb-1.5 text-xs text-stone-600">
      <input
        type="checkbox"
        data-testid="ready-now-filter"
        :checked="filters.readyNow"
        @change="update({ readyNow: ($event.target as HTMLInputElement).checked })"
      />
      Ready now
    </label>
  </form>
</template>
