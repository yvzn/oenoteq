<script setup lang="ts">
import AppHeader from './components/AppHeader.vue'
import OfflineBanner from './components/OfflineBanner.vue'
import SuccessToast from './components/SuccessToast.vue'
</script>

<template>
  <div class="border-line/70 mx-auto min-h-screen max-w-[920px] border-x bg-parchment pb-28 lg:pb-32">
    <AppHeader />
    <SuccessToast />
    <OfflineBanner />
    <main>
      <router-view />
    </main>
  </div>
</template>
