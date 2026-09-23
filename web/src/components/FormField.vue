<script setup lang="ts">
withDefaults(
  defineProps<{ label: string; error?: string | null; errorTestid?: string }>(),
  { error: null, errorTestid: undefined },
)
</script>

<template>
  <label class="flex flex-col gap-1 text-sm">
    <span class="text-label text-[11.5px] font-semibold tracking-wide uppercase">{{ label }}</span>
    <slot />
    <p v-if="error" :data-testid="errorTestid" class="text-danger text-xs">{{ error }}</p>
  </label>
</template>
