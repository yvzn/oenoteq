<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useDocumentLocale } from './i18n/useDocumentLocale'
import AppHeader from './components/AppHeader.vue'
import OfflineBanner from './components/OfflineBanner.vue'
import SuccessToast from './components/SuccessToast.vue'

const route = useRoute()
useDocumentLocale()
</script>

<template>
  <div class="border-line/70 mx-auto min-h-screen max-w-[920px] border-x bg-parchment pb-28 lg:pb-32">
    <AppHeader v-if="route.name !== 'consent'" />
    <SuccessToast />
    <OfflineBanner />
    <main>
      <router-view />
    </main>
  </div>
</template>
