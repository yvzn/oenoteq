import { ref } from 'vue'
import { friendlyErrorMessage } from '../api/errorMessages'
import type { Appellation } from '../api/types'
import { gateway } from '../gateway'
import { sortByName } from '../db/sortByName'

export function useAppellations() {
  const appellations = ref<Appellation[]>([])
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
      appellations.value = await gateway.appellations.list()
    } catch (e) {
      error.value = friendlyErrorMessage(e)
    } finally {
      loading.value = false
    }
  }

  async function create(name: string): Promise<Appellation | null> {
    creating.value = true
    createError.value = null
    try {
      const record = await gateway.appellations.create(name)
      appellations.value = sortByName([...appellations.value, record])
      return record
    } catch (e) {
      createError.value = friendlyErrorMessage(e)
      return null
    } finally {
      creating.value = false
    }
  }

  async function update(id: number, name: string): Promise<Appellation | null> {
    updating.value = true
    updateError.value = null
    try {
      const record = await gateway.appellations.update(id, name)
      appellations.value = sortByName(appellations.value.map((r) => (r.id === id ? record : r)))
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
      await gateway.appellations.remove(id)
      appellations.value = appellations.value.filter((r) => r.id !== id)
      return true
    } catch (e) {
      deleteError.value = friendlyErrorMessage(e)
      return false
    } finally {
      deleting.value = false
    }
  }

  return {
    appellations,
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
