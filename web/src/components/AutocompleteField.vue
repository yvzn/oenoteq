<script setup lang="ts">
import { computed, ref, watch } from 'vue'

interface Item {
  id: number
  name: string
}

const props = defineProps<{
  items: Item[]
  modelValue: number | null
  placeholder?: string
  testid: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: number | null] }>()

function selectedName(): string {
  return props.items.find((i) => i.id === props.modelValue)?.name ?? ''
}

const query = ref(selectedName())
const open = ref(false)

watch(
  () => props.modelValue,
  () => {
    query.value = selectedName()
  },
)

const matches = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (q === '' || q === selectedName().toLowerCase()) return props.items
  return props.items.filter((i) => i.name.toLowerCase().includes(q))
})

function onInput() {
  open.value = true
  if (query.value.trim() === '') emit('update:modelValue', null)
}

function select(item: Item) {
  emit('update:modelValue', item.id)
  query.value = item.name
  open.value = false
}
</script>

<template>
  <div class="relative" :data-testid="testid">
    <input
      v-model="query"
      type="text"
      :placeholder="placeholder"
      class="w-full rounded border border-stone-300 px-2 py-1 text-sm"
      :data-testid="`${testid}-input`"
      autocomplete="off"
      @focus="open = true"
      @input="onInput"
      @blur="open = false"
    />
    <ul
      v-if="open && matches.length > 0"
      :data-testid="`${testid}-options`"
      class="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded border border-stone-200 bg-white text-sm shadow"
    >
      <li
        v-for="item in matches"
        :key="item.id"
        :data-testid="`${testid}-option`"
        class="cursor-pointer px-2 py-1 hover:bg-stone-100"
        @mousedown.prevent="select(item)"
      >
        {{ item.name }}
      </li>
    </ul>
  </div>
</template>
