<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute } from 'vue-router'

const { t } = useI18n()
const route = useRoute()
</script>

<template>
  <!-- In page flow, with room below so a bottom-center toast never covers the link. -->
  <footer class="bg-desk/50 mt-8 px-6 pt-6 pb-24 text-center">
    <!-- No link to the page we are already on. -->
    <RouterLink
      v-if="route.name !== 'storage'"
      :to="{ name: 'storage' }"
      data-testid="cookie-preferences-link"
      class="text-ink-soft hover:text-ink text-sm"
    >
      {{ t('storage.link') }}
    </RouterLink>
  </footer>
</template>
