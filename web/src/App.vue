<script setup lang="ts">
import { onMounted, ref } from 'vue'

interface Wine {
  id: number
  millesime: number | null
  appellation_id: number
  producer: string
  color: string
  garde_debut: number
  garde_fin: number
  quantity: number
}

const wines = ref<Wine[]>([])
const error = ref<string | null>(null)
const loading = ref(true)

onMounted(async () => {
  try {
    const response = await fetch('/wines')
    if (!response.ok) {
      throw new Error(`GET /wines: ${response.status}`)
    }
    wines.value = await response.json()
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <h1>Wine Cellar</h1>
  <p v-if="loading">Loading…</p>
  <p v-else-if="error">Failed to load wines: {{ error }}</p>
  <p v-else>{{ wines.length }} wine(s) in cellar.</p>
</template>
