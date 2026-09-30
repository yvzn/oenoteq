import { ref } from 'vue'
import { apiClient } from '../api/client'
import { friendlyErrorMessage } from '../api/errorMessages'
import type { Appellation } from '../api/types'
import { db } from '../db/localDb'
import { nextLocalId } from '../db/localId'
import { pushChangesInBackground } from '../sync'
import {
  enqueueAppellationCreate,
  enqueueAppellationUpdate,
  patchPendingAppellationCreate,
  pullAppellations,
} from '../sync/appellationSync'

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
      if (navigator.onLine !== false) await pullAppellations()
      appellations.value = await db.appellations.toArray()
    } catch (e) {
      const cached = await db.appellations.toArray()
      if (cached.length > 0) {
        appellations.value = cached
      } else {
        error.value = friendlyErrorMessage(e)
      }
    } finally {
      loading.value = false
    }
  }

  async function create(name: string): Promise<Appellation | null> {
    creating.value = true
    createError.value = null
    try {
      const localId = nextLocalId()
      const record: Appellation = { id: localId, name }
      await db.appellations.put(record)
      appellations.value = [...appellations.value, record]
      await enqueueAppellationCreate(localId, { name, client_id: crypto.randomUUID() })
      pushChangesInBackground()
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
      const record: Appellation = { id, name }
      await db.appellations.put(record)
      appellations.value = appellations.value.map((a) => (a.id === id ? record : a))

      const patchedPendingCreate = id < 0 && (await patchPendingAppellationCreate(id, { name }))
      if (!patchedPendingCreate) await enqueueAppellationUpdate(id, { name })
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
      await apiClient.delete(`/appellations/${id}`, undefined)
      appellations.value = appellations.value.filter((a) => a.id !== id)
      await db.appellations.delete(id)
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
