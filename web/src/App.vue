<script setup lang="ts">
import AppHeader from './components/AppHeader.vue'
import SuccessToast from './components/SuccessToast.vue'
</script>

<template>
  <AppHeader />
  <SuccessToast />
  <main>
    <router-view />
  </main>
</template>
