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

watch(matches, resetHighlight)

const optionId = (index: number) => `${props.testid}-option-${index}`
const activeDescendant = computed(() =>
  open.value && highlightedIndex.value >= 0 ? optionId(highlightedIndex.value) : undefined,
)

function resetHighlight() {
  highlightedIndex.value = -1
}

function onInput() {
  open.value = true
  resetHighlight()
  if (query.value.trim() === '') emit('update:modelValue', null)
}

function select(item: Item) {
  emit('update:modelValue', item.id)
  query.value = item.name
  open.value = false
  resetHighlight()
}

function moveHighlight(delta: 1 | -1, openedAt: number) {
  if (!open.value) {
    open.value = true
    highlightedIndex.value = openedAt
    return
  }
  if (matches.value.length === 0) return
  const length = matches.value.length
  highlightedIndex.value = (highlightedIndex.value + delta + length) % length
}

const onArrowDown = () => moveHighlight(1, 0)
const onArrowUp = () => moveHighlight(-1, matches.value.length - 1)

function onEnter(event: KeyboardEvent) {
  if (!open.value) return
  const item = matches.value[highlightedIndex.value]
  if (!item) return
  event.preventDefault()
  select(item)
}

function onEscape() {
  if (!open.value) return
  open.value = false
  resetHighlight()
  query.value = selectedName()
}

function onBlur() {
  open.value = false
  resetHighlight()
}
</script>

<template>
  <div class="relative" :data-testid="testid">
    <input
      v-model="query"
      type="text"
      role="combobox"
      aria-autocomplete="list"
      :aria-expanded="open"
      :aria-controls="`${testid}-options`"
      :aria-activedescendant="activeDescendant"
      :placeholder="placeholder"
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
