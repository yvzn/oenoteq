<script setup lang="ts">
import type { Appellation, Color, Meal } from '../api/types'
import type { SearchFilters } from '../domain/searchFilters'
import AutocompleteField from './AutocompleteField.vue'
import ColorSwatch from './ColorSwatch.vue'
import FormField from './FormField.vue'

const props = withDefaults(
  defineProps<{
    modelValue: SearchFilters
    appellations: Appellation[]
    meals: Meal[]
    testidSuffix?: string
    inline?: boolean
  }>(),
  { testidSuffix: '', inline: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: SearchFilters] }>()

const colors: Color[] = ['rouge', 'blanc', 'rose']

function testid(name: string) {
  return props.testidSuffix ? `${name}-${props.testidSuffix}` : name
}

function update(patch: Partial<SearchFilters>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}
</script>

<template>
  <FormField label="Meal" :class="inline ? 'w-40' : undefined">
    <AutocompleteField
      :testid="testid('meal-filter')"
      :items="meals"
      :model-value="modelValue.mealId"
      placeholder="Any meal"
      @update:model-value="(v) => update({ mealId: v })"
    />
  </FormField>

  <FormField label="Appellation" :class="inline ? 'w-40' : undefined">
    <AutocompleteField
      :testid="testid('appellation-filter')"
      :items="appellations"
      :model-value="modelValue.appellationId"
      placeholder="Any appellation"
      @update:model-value="(v) => update({ appellationId: v })"
    />
  </FormField>

  <FormField label="Color" :class="inline ? 'w-40' : undefined">
    <div class="flex items-center gap-2">
      <ColorSwatch v-if="modelValue.color" :color="modelValue.color" class="shrink-0" />
      <select
        :data-testid="testid('color-filter')"
        class="w-full text-sm"
        :value="modelValue.color ?? ''"
        @change="update({ color: (($event.target as HTMLSelectElement).value || null) as Color | null })"
      >
        <option value="">Any color</option>
        <option v-for="c in colors" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>
  </FormField>

  <label
    class="text-muted flex cursor-pointer items-center gap-2 text-xs"
    :class="inline ? 'h-[38px]' : undefined"
  >
    <input
      type="checkbox"
      :data-testid="testid('ready-now-filter')"
      class="peer sr-only"
      :checked="modelValue.readyNow"
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
</template>
