<script setup lang="ts">
import { useSyncPending } from '../composables/useSyncPending'

const props = defineProps<{
  creating: boolean
  created: { id: number; name: string } | null
  // Outbox entity name ('producer', 'appellation', 'meal') used to tell
  // whether the created row is still waiting to sync.
  entity: string
  error: string | null
  testid: string
  errorTestid?: string
}>()

// Live: drops out as soon as the create leaves the outbox, so the note never
// outlives the sync it describes.
const { pending } = useSyncPending(
  () => props.entity,
  () => props.created?.id ?? 0,
)
</script>

<template>
  <div aria-live="polite" class="text-xs">
    <p v-if="error" role="alert" :data-testid="errorTestid ?? `${testid}-error`" class="text-danger mt-1">
      {{ error }}
    </p>
    <p v-else-if="creating" :data-testid="`${testid}-creating`" class="text-muted mt-1">Creating…</p>
    <p v-else-if="created" :data-testid="`${testid}-created`" class="text-success mt-1">
      ✓ Created "{{ created.name }}"<span v-if="pending" :data-testid="`${testid}-pending`" class="text-muted">
        — not synced yet, will sync automatically</span>
    </p>
  </div>
</template>
