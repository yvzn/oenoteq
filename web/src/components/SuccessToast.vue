<script setup lang="ts">
import AppButton from './AppButton.vue'
import { useSuccessMessage } from '../composables/useSuccessMessage'

const { message, clear } = useSuccessMessage()
</script>

<template>
  <div
    v-if="message"
    data-testid="success-toast"
    role="status"
    class="border-line bg-parchment-raised fixed top-4 right-4 z-20 flex items-center gap-3 rounded-md border px-4 py-2 text-sm shadow-lg"
  >
    <span class="text-success">{{ message }}</span>
    <AppButton
      type="button"
      variant="ghost"
      data-testid="success-toast-dismiss"
      @click="clear"
    >
      Dismiss
    </AppButton>
  </div>
</template>
