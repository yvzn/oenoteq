<script setup lang="ts">
import type { Appellation, Color, Meal } from '../api/types'
import type { SearchFilters } from '../domain/searchFilters'
import AutocompleteField from './AutocompleteField.vue'
import FormField from './FormField.vue'

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
  <form class="flex flex-wrap items-end gap-4 px-6 py-4" @submit.prevent>
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

    <FormField label="Color">
      <select
        data-testid="color-filter"
        class="text-sm"
        :value="filters.color ?? ''"
        @change="update({ color: (($event.target as HTMLSelectElement).value || null) as Color | null })"
      >
        <option value="">Any color</option>
        <option v-for="c in colors" :key="c" :value="c">{{ c }}</option>
      </select>
    </FormField>

    <label class="text-muted flex items-center gap-2 pb-1.5 text-xs">
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
