<script setup lang="ts">
const modelValue = defineModel<string>({ required: true })

const props = withDefaults(
  defineProps<{
    min?: number
    max?: number
    step?: number
    fullWidth?: boolean
    required?: boolean
    placeholder?: string
    inputTestid: string
    decrementTestid: string
    incrementTestid: string
  }>(),
  { step: 1, fullWidth: false, required: false },
)

function stepBy(delta: number) {
  let next = (Number(modelValue.value) || 0) + delta
  if (props.min !== undefined) next = Math.max(props.min, next)
  if (props.max !== undefined) next = Math.min(props.max, next)
  modelValue.value = String(next)
}
</script>

<template>
  <div
    :class="[
      'border-line bg-parchment-raised flex items-stretch overflow-hidden rounded-lg border',
      fullWidth ? 'w-full' : 'w-auto self-start',
    ]"
  >
    <button
      type="button"
      :data-testid="decrementTestid"
      class="text-ink-soft focus-visible:ring-bordeaux w-12 shrink-0 cursor-pointer rounded-l-lg text-lg font-medium transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
      @click="stepBy(-step)"
    >
      −
    </button>
    <input
      v-model="modelValue"
      :data-testid="inputTestid"
      type="number"
      :min="min"
      :max="max"
      :placeholder="placeholder"
      :required="required"
      :class="[
        'border-line rounded-none border-x bg-transparent text-center',
        fullWidth ? 'w-full min-w-0 flex-1' : 'w-16',
      ]"
    />
    <button
      type="button"
      :data-testid="incrementTestid"
      class="text-ink-soft focus-visible:ring-bordeaux w-12 shrink-0 cursor-pointer rounded-r-lg text-lg font-medium transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
      @click="stepBy(step)"
    >
      +
    </button>
  </div>
</template>
