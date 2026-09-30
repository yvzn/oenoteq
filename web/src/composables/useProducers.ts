import { ref } from 'vue'
import { apiClient } from '../api/client'
import { friendlyErrorMessage } from '../api/errorMessages'
import type { Producer } from '../api/types'
import { db } from '../db/localDb'
import { nextLocalId } from '../db/localId'
import { pushChangesInBackground } from '../sync'
import {
  enqueueProducerCreate,
  enqueueProducerUpdate,
  patchPendingProducerCreate,
  pullProducers,
} from '../sync/producerSync'

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
      if (navigator.onLine !== false) await pullProducers()
      producers.value = await db.producers.toArray()
    } catch (e) {
      const cached = await db.producers.toArray()
      if (cached.length > 0) {
        producers.value = cached
      } else {
        error.value = friendlyErrorMessage(e)
      }
    } finally {
      loading.value = false
    }
  }

  async function create(name: string): Promise<Producer | null> {
    creating.value = true
    createError.value = null
    try {
      const localId = nextLocalId()
      const record: Producer = { id: localId, name }
      await db.producers.put(record)
      producers.value = [...producers.value, record]
      await enqueueProducerCreate(localId, { name, client_id: crypto.randomUUID() })
      pushChangesInBackground()
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
      const record: Producer = { id, name }
      await db.producers.put(record)
      producers.value = producers.value.map((p) => (p.id === id ? record : p))

      const patchedPendingCreate = id < 0 && (await patchPendingProducerCreate(id, { name }))
      if (!patchedPendingCreate) await enqueueProducerUpdate(id, { name })
      pushChangesInBackground()
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
      await apiClient.delete(`/producers/${id}`, undefined)
      producers.value = producers.value.filter((p) => p.id !== id)
      await db.producers.delete(id)
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
