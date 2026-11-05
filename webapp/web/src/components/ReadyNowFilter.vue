<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    testidSuffix?: string
    inline?: boolean
  }>(),
  { testidSuffix: '', inline: false },
)

const { t } = useI18n()

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const testid = computed(() =>
  props.testidSuffix ? `ready-now-filter-${props.testidSuffix}` : 'ready-now-filter',
)
</script>

<template>
  <label
    class="text-muted flex cursor-pointer items-center gap-2 text-xs"
    :class="inline ? 'h-[38px]' : undefined"
  >
    <input
      type="checkbox"
      :data-testid="testid"
      class="peer sr-only"
      :checked="modelValue"
      @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
    />
    <span
      class="border-line bg-parchment-raised peer-checked:bg-bordeaux peer-checked:border-bordeaux peer-focus-visible:ring-bordeaux/40 text-transparent peer-checked:text-white inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors peer-focus-visible:ring-2"
      aria-hidden="true"
    >
      <svg viewBox="0 0 12 12" class="h-2.5 w-2.5">
        <path d="M2.5 6.3 4.9 8.6 9.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </span>
    {{ t('cellar.filters.readyNow') }}
  </label>
</template>
