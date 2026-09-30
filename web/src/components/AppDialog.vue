<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'

const props = defineProps<{ open: boolean }>()

const emit = defineEmits<{ cancel: [] }>()

const dialog = ref<HTMLDialogElement | null>(null)

function sync(isOpen: boolean) {
  if (isOpen) dialog.value?.showModal()
  else dialog.value?.close()
}

onMounted(() => sync(props.open))
watch(() => props.open, sync)

function onDialogClick(event: MouseEvent) {
  if (event.target === dialog.value) emit('cancel')
}
</script>

<template>
  <dialog
    ref="dialog"
    role="dialog"
    data-testid="app-dialog"
    class="border-line bg-parchment-raised m-auto w-[calc(100%-2rem)] max-w-sm rounded-lg border p-5 shadow-lg backdrop:bg-ink/40"
    @cancel.prevent="emit('cancel')"
    @click="onDialogClick"
  >
    <slot />
  </dialog>
</template>
