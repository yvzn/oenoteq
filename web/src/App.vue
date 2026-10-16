<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useDocumentLocale } from './i18n/useDocumentLocale'
import { useSuccessMessage } from './composables/useSuccessMessage'
import AppFooter from './components/AppFooter.vue'
import AppHeader from './components/AppHeader.vue'
import LiveAnnouncer from './components/LiveAnnouncer.vue'
import OfflineToast from './components/OfflineToast.vue'
import SuccessToast from './components/SuccessToast.vue'

const route = useRoute()
const { message } = useSuccessMessage()
useDocumentLocale()
</script>

<template>
  <div class="border-line/70 bg-parchment mx-auto flex min-h-screen max-w-[920px] flex-col border-x">
    <AppHeader v-if="route.name !== 'consent'" />
    <SuccessToast />
    <OfflineToast />
    <LiveAnnouncer />
    <main class="flex-1">
      <router-view />
    </main>
    <AppFooter v-if="route.name !== 'consent'" />
    <div v-if="message" aria-hidden="true" class="h-20" :class="{ 'bg-desk/50': route.name !== 'consent' }" />
  </div>
</template>
