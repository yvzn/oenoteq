<script setup lang="ts">
import { useLocale } from '../i18n/useLocale'
import { LOCALE_NAMES, SUPPORTED_LOCALES } from '../i18n/locales'

const { locale, setLocale, t } = useLocale()

// Shown as `FR | EN`.
const options = [...SUPPORTED_LOCALES].reverse()
</script>

<template>
  <div role="group" :aria-label="t('language.label')" data-testid="language-toggle" class="flex items-center gap-1.5 text-sm">
    <template v-for="(code, index) in options" :key="code">
      <span v-if="index > 0" aria-hidden="true" class="text-muted">|</span>
      <button
        type="button"
        :lang="code"
        :aria-label="LOCALE_NAMES[code]"
        :aria-pressed="locale === code"
        :data-testid="`language-${code}`"
        class="hover:text-ink"
        :class="locale === code ? 'text-ink font-bold' : 'text-muted'"
        @click="setLocale(code)"
      >
        {{ code.toUpperCase() }}
      </button>
    </template>
  </div>
</template>
