<script setup lang="ts">
import { useLocale } from '../i18n/useLocale'
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '../i18n/locales'

const { locale, setLocale, t } = useLocale()
</script>

<template>
  <div role="group" :aria-label="t('language.label')" data-testid="language-switcher" class="flex items-center gap-2">
    <span class="text-muted text-sm">{{ t('language.label') }}</span>
    <button
      v-for="code in SUPPORTED_LOCALES"
      :key="code"
      type="button"
      :lang="code"
      :aria-pressed="locale === code"
      :data-testid="`language-${code}`"
      class="border-line rounded-full border px-3 py-1 text-sm"
      :class="locale === code ? 'bg-bordeaux border-bordeaux text-white' : 'bg-parchment-raised text-ink'"
      @click="setLocale(code)"
    >
      {{ LOCALE_NAMES[code] }}
    </button>
  </div>
</template>
