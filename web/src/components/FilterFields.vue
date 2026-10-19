<script setup lang="ts" generic="F extends CommonFilters">
import { useI18n } from 'vue-i18n'
import type { Appellation, Color, Meal } from '../api/types'
import type { CommonFilters, ExtraFiltersScope } from '../domain/searchFilters'
import AutocompleteField from './AutocompleteField.vue'
import ColorSwatch from './ColorSwatch.vue'
import FormField from './FormField.vue'

const props = withDefaults(
  defineProps<{
    modelValue: F
    appellations: Appellation[]
    meals: Meal[]
    testidSuffix?: string
    inline?: boolean
  }>(),
  { testidSuffix: '', inline: false },
)

const { t } = useI18n()

const emit = defineEmits<{ 'update:modelValue': [value: F] }>()

// Page-specific filters, rendered after the common ones against the same filters and update.
defineSlots<{
  extra?(scope: ExtraFiltersScope<F>): unknown
}>()

const colors: Color[] = ['rouge', 'blanc', 'rose']

function testid(name: string) {
  return props.testidSuffix ? `${name}-${props.testidSuffix}` : name
}

// TypeScript can't see a common-filter patch as a Partial<F>, hence the union.
function update(patch: Partial<CommonFilters> | Partial<F>) {
  emit('update:modelValue', { ...props.modelValue, ...patch })
}
</script>

<template>
  <FormField :label="t('vocabulary.meal')" :class="inline ? 'w-40' : undefined">
    <AutocompleteField
      :testid="testid('meal-filter')"
      :items="meals"
      :model-value="modelValue.mealId"
      :placeholder="t('cellar.filters.anyMeal')"
      @update:model-value="(v) => update({ mealId: v })"
    />
  </FormField>

  <FormField :label="t('vocabulary.appellation')" :class="inline ? 'w-40' : undefined">
    <AutocompleteField
      :testid="testid('appellation-filter')"
      :items="appellations"
      :model-value="modelValue.appellationId"
      :placeholder="t('cellar.filters.anyAppellation')"
      @update:model-value="(v) => update({ appellationId: v })"
    />
  </FormField>

  <FormField :label="t('cellar.filters.color')" :class="inline ? 'w-40' : undefined">
    <div class="flex items-center gap-2">
      <ColorSwatch v-if="modelValue.color" :color="modelValue.color" class="shrink-0" />
      <select
        :data-testid="testid('color-filter')"
        class="w-full text-sm"
        :value="modelValue.color ?? ''"
        @change="update({ color: (($event.target as HTMLSelectElement).value || null) as Color | null })"
      >
        <option value="">{{ t('cellar.filters.anyColor') }}</option>
        <option v-for="c in colors" :key="c" :value="c">{{ t(`color.${c}`) }}</option>
      </select>
    </div>
  </FormField>

  <slot name="extra" :filters="modelValue" :update="update" :testid-suffix="testidSuffix" :inline="inline" />
</template>
