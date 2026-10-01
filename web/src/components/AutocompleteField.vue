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
  creatable?: boolean
  busy?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
  create: [name: string]
}>()

function selectedName(): string {
  return props.items.find((i) => i.id === props.modelValue)?.name ?? ''
}

const query = ref(selectedName())
const open = ref(false)
const root = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
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

const createCandidate = computed(() => {
  if (!props.creatable) return false
  const q = query.value.trim().toLowerCase()
  if (q === '') return false
  return !props.items.some((i) => i.name.trim().toLowerCase() === q)
})

const optionCount = computed(() => matches.value.length + (createCandidate.value ? 1 : 0))
const createIndex = computed(() => matches.value.length)

watch([matches, createCandidate], resetHighlight)

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

function requestCreate() {
  if (!createCandidate.value || props.busy) return
  emit('create', query.value.trim())
  open.value = false
  resetHighlight()
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
  if (optionCount.value === 0) return
  const length = optionCount.value
  highlightedIndex.value = (highlightedIndex.value + delta + length) % length
}

const onArrowDown = () => moveHighlight(1, 0)
const onArrowUp = () => moveHighlight(-1, optionCount.value - 1)

function onEnter(event: KeyboardEvent) {
  if (!open.value) return
  const onlyCreateOption = matches.value.length === 0 && highlightedIndex.value === -1
  if (createCandidate.value && (highlightedIndex.value === createIndex.value || onlyCreateOption)) {
    event.preventDefault()
    requestCreate()
    return
  }
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

// Close only when focus leaves the whole widget, so Tab from the input can
// land on the Create option without the list unmounting underneath it.
function onFocusOut(event: FocusEvent) {
  if (root.value?.contains(event.relatedTarget as Node | null)) return
  open.value = false
  resetHighlight()
}

function onCreateOptionKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    inputEl.value?.focus()
    onEscape()
    return
  }
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  const hadFocus = document.activeElement === event.currentTarget
  requestCreate()
  if (hadFocus) {
    inputEl.value?.focus()
    open.value = false
  }
}
</script>

<template>
  <div ref="root" class="relative" :data-testid="testid" @focusout="onFocusOut">
    <input
      ref="inputEl"
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
      @keydown.down="onArrowDown"
      @keydown.up="onArrowUp"
      @keydown.enter="onEnter"
      @keydown.esc="onEscape"
    />
    <ul
      v-if="open && optionCount > 0"
      :id="`${testid}-options`"
      role="listbox"
      :data-testid="`${testid}-options`"
      class="border-line absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-white text-sm shadow-lg"
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
      <li
        v-if="createCandidate"
        :id="optionId(createIndex)"
        role="option"
        :aria-selected="highlightedIndex === createIndex"
        :aria-disabled="busy"
        :data-testid="`${testid}-create-option`"
        tabindex="0"
        class="text-bordeaux border-line focus-visible:bg-gold-soft cursor-pointer px-2.5 py-1.5 font-medium outline-none"
        :class="[
          matches.length > 0 ? 'border-t' : '',
          highlightedIndex === createIndex ? 'bg-gold-soft' : 'hover:bg-parchment',
          busy ? 'opacity-50' : '',
        ]"
        @mousedown.prevent="requestCreate"
        @keydown="onCreateOptionKeydown"
      >
        ＋ Create "{{ query.trim() }}"
      </li>
    </ul>
  </div>
</template>
