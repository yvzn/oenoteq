<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppButton from './AppButton.vue'
import { useSuccessMessage } from '../composables/useSuccessMessage'

const { t } = useI18n()
const { message, clear } = useSuccessMessage()
</script>

<template>
  <div
    v-if="message"
    data-testid="success-toast"
    role="status"
    class="border-line bg-parchment-raised fixed top-4 right-4 z-20 flex items-center gap-3 rounded-lg border px-4 py-2 text-sm shadow-lg"
  >
    <span class="text-success">{{ message }}</span>
    <AppButton
      type="button"
      variant="ghost"
      data-testid="success-toast-dismiss"
      @click="clear"
    >
      {{ t('actions.dismiss') }}
    </AppButton>
  </div>
</template>
