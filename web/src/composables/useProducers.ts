import { ref } from 'vue'
import { friendlyErrorMessage } from '../api/errorMessages'
import type { Producer } from '../api/types'
import { gateway } from '../gateway'
import { sortByName } from '../db/sortByName'

export function useProducers() {
  const producers = ref<Producer[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const creating = ref(false)
  const createError = ref<string | null>(null)
  const updating = ref(false)
  const updateError = ref<string | null>(null)
  const deleting = ref(false)
  const deleteError = ref<string | null>(null)

  async function load() {
    loading.value = true
    error.value = null
    try {
      producers.value = await gateway.producers.list()
    } catch (e) {
      error.value = friendlyErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  async function create(name: string): Promise<Producer | null> {
    creating.value = true
    createError.value = null
    try {
      const record = await gateway.producers.create(name)
      producers.value = sortByName([...producers.value, record])
      return record
    } catch (e) {
      createError.value = friendlyErrorMessage(e)
      return null
    } finally {
      creating.value = false
    }
  }

  async function update(id: number, name: string): Promise<Producer | null> {
    updating.value = true
    updateError.value = null
    try {
      const record = await gateway.producers.update(id, name)
      producers.value = sortByName(producers.value.map((r) => (r.id === id ? record : r)))
      return record
    } catch (e) {
      updateError.value = friendlyErrorMessage(e)
      return null
    } finally {
      updating.value = false
    }
  }

  async function remove(id: number): Promise<boolean> {
    deleting.value = true
    deleteError.value = null
    try {
      await gateway.producers.remove(id)
      producers.value = producers.value.filter((r) => r.id !== id)
      return true
    } catch (e) {
      deleteError.value = friendlyErrorMessage(e)
      return false
    } finally {
      deleting.value = false
    }
  }

  return {
    producers,
    loading,
    error,
    load,
    create,
    creating,
    createError,
    update,
    updating,
    updateError,
    remove,
    deleting,
    deleteError,
  }
}
