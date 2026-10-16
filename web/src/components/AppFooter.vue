<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

const { t } = useI18n()
</script>

<template>
  <!-- In page flow, with room below so a bottom-center toast never covers the link. -->
  <footer class="px-6 pt-8 pb-24 text-center">
    <RouterLink :to="{ name: 'storage' }" data-testid="cookie-preferences-link" class="text-muted hover:text-ink text-sm">
      {{ t('storage.link') }}
    </RouterLink>
  </footer>
</template>
