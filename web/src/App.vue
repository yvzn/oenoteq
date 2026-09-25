<script setup lang="ts">
import AppHeader from './components/AppHeader.vue'
import SuccessToast from './components/SuccessToast.vue'
</script>

<template>
  <div class="border-line/70 mx-auto min-h-screen max-w-[920px] border-x bg-parchment pb-12 lg:pb-24">
    <AppHeader />
    <SuccessToast />
    <main>
      <router-view />
    </main>
  </div>
</template>
