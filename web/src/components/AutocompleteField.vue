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
const highlightedIndex = ref(-1)

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

watch(matches, () => {
  highlightedIndex.value = -1
})

const optionId = (index: number) => `${props.testid}-option-${index}`
const activeDescendant = computed(() =>
  open.value && highlightedIndex.value >= 0 ? optionId(highlightedIndex.value) : undefined,
)

function onInput() {
  open.value = true
  highlightedIndex.value = -1
  if (query.value.trim() === '') emit('update:modelValue', null)
}

function select(item: Item) {
  emit('update:modelValue', item.id)
  query.value = item.name
  open.value = false
  highlightedIndex.value = -1
}

function onArrowDown() {
  if (!open.value) {
    open.value = true
    highlightedIndex.value = 0
    return
  }
  if (matches.value.length === 0) return
  highlightedIndex.value = (highlightedIndex.value + 1) % matches.value.length
}

function onArrowUp() {
  if (!open.value) {
    open.value = true
    highlightedIndex.value = matches.value.length - 1
    return
  }
  if (matches.value.length === 0) return
  highlightedIndex.value =
    highlightedIndex.value <= 0 ? matches.value.length - 1 : highlightedIndex.value - 1
}

function onEnter(event: KeyboardEvent) {
  if (!open.value || matches.value.length === 0) return
  const item = matches.value[highlightedIndex.value]
  if (!item) return
  event.preventDefault()
  select(item)
}

function onEscape() {
  if (!open.value) return
  open.value = false
  highlightedIndex.value = -1
  query.value = selectedName()
}

function onBlur() {
  open.value = false
  highlightedIndex.value = -1
}
</script>

<template>
  <div class="relative" :data-testid="testid">
    <input
      v-model="query"
      type="text"
      :placeholder="placeholder"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="open"
      :aria-controls="`${testid}-options`"
      :aria-activedescendant="activeDescendant"
      class="w-full text-sm"
      :data-testid="`${testid}-input`"
      autocomplete="off"
      @focus="open = true"
      @input="onInput"
      @blur="onBlur"
      @keydown.down="onArrowDown"
      @keydown.up="onArrowUp"
      @keydown.enter="onEnter"
      @keydown.esc="onEscape"
    />
    <ul
      v-if="open && matches.length > 0"
      :id="`${testid}-options`"
      role="listbox"
      :data-testid="`${testid}-options`"
      class="border-line absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-white text-sm shadow-lg"
    >
      <li
        v-for="(item, index) in matches"
        :id="optionId(index)"
        :key="item.id"
        role="option"
        :aria-selected="index === highlightedIndex"
        :data-testid="`${testid}-option`"
        class="cursor-pointer px-2.5 py-1.5"
        :class="index === highlightedIndex ? 'bg-gold-soft text-ink' : 'hover:bg-parchment'"
        @mousedown.prevent="select(item)"
      >
        {{ item.name }}
      </li>
    </ul>
  </div>
</template>
