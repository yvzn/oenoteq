<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import AppButton from './AppButton.vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    message: string
    confirmLabel?: string
    cancelLabel?: string
  }>(),
  { confirmLabel: 'Confirm', cancelLabel: 'Cancel' },
)

const emit = defineEmits<{ confirm: []; cancel: [] }>()

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
    role="alertdialog"
    data-testid="confirm-dialog"
    class="border-line bg-parchment-raised m-auto w-full max-w-sm rounded-lg border p-5 shadow-lg backdrop:bg-ink/40"
    @cancel.prevent="emit('cancel')"
    @click="onDialogClick"
  >
    <p class="text-ink text-sm">{{ message }}</p>
    <div class="mt-4 flex justify-between">
      <AppButton type="button" variant="ghost" data-testid="confirm-dialog-cancel" @click="emit('cancel')">
        {{ cancelLabel }}
      </AppButton>
      <AppButton type="button" variant="primary" data-testid="confirm-dialog-confirm" @click="emit('confirm')">
        {{ confirmLabel }}
      </AppButton>
    </div>
  </dialog>
</template>
