<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { Consumption } from '../api/types'
import AppButton from '../components/AppButton.vue'
import ColorSwatch from '../components/ColorSwatch.vue'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import FormField from '../components/FormField.vue'
import GardeStatusBadge from '../components/GardeStatusBadge.vue'
import StatusLine from '../components/StatusLine.vue'
import { useAppellations } from '../composables/useAppellations'
import { useSuccessMessage } from '../composables/useSuccessMessage'
import { useWines } from '../composables/useWines'
import { computeGardeStatus } from '../domain/gardeStatus'

const route = useRoute()

const {
  wine,
  loading: wineLoading,
  error: wineError,
  load: loadWine,
  recordConsumption,
  submittingConsumption,
  consumptionError,
  updateConsumption,
  updatingConsumption,
  updateConsumptionError,
  deleteConsumption,
  deletingConsumption,
  deleteConsumptionError,
} = useWines()
const {
  appellations,
  loading: appellationsLoading,
  error: appellationsError,
  load: loadAppellations,
} = useAppellations()

const id = computed(() => Number(route.params.id))

const consumptionDate = ref('')
const consumptionRating = ref('')
const consumptionNotes = ref('')

const consumptionSuccess = useSuccessMessage()

async function submitConsumption() {
  await recordConsumption(id.value, {
    date: consumptionDate.value,
    rating: consumptionRating.value === '' ? null : Number(consumptionRating.value),
    notes: consumptionNotes.value === '' ? null : consumptionNotes.value,
  })
  if (!consumptionError.value) {
    consumptionDate.value = ''
    consumptionRating.value = ''
    consumptionNotes.value = ''
    consumptionSuccess.show('Consumption recorded.')
  }
}

const editingConsumptionId = ref<number | null>(null)
const editDate = ref('')
const editRating = ref('')
const editNotes = ref('')

function startEdit(consumption: Consumption) {
  editingConsumptionId.value = consumption.id
  editDate.value = consumption.date
  editRating.value = consumption.rating === null ? '' : String(consumption.rating)
  editNotes.value = consumption.notes ?? ''
  updateConsumptionError.value = null
}

function cancelEdit() {
  editingConsumptionId.value = null
}

async function submitEdit(consumptionId: number) {
  const ok = await updateConsumption(id.value, consumptionId, {
    date: editDate.value,
    rating: editRating.value === '' ? null : Number(editRating.value),
    notes: editNotes.value === '' ? null : editNotes.value,
  })
  if (ok) {
    editingConsumptionId.value = null
    consumptionSuccess.show('Consumption updated.')
  }
}

const pendingDeleteConsumption = ref<Consumption | null>(null)
const deleteConfirmOpen = computed(() => pendingDeleteConsumption.value !== null)
const deleteConfirmMessage = computed(() =>
  pendingDeleteConsumption.value ? `Delete consumption from ${pendingDeleteConsumption.value.date}?` : '',
)

function askDeleteConsumption(consumption: Consumption) {
  pendingDeleteConsumption.value = consumption
}

function cancelDeleteConsumption() {
  pendingDeleteConsumption.value = null
}

async function confirmDeleteConsumption() {
  if (!pendingDeleteConsumption.value) return
  const consumptionId = pendingDeleteConsumption.value.id
  pendingDeleteConsumption.value = null
  const ok = await deleteConsumption(id.value, consumptionId)
  if (ok) consumptionSuccess.show('Consumption deleted.')
}

const loading = computed(() => wineLoading.value || appellationsLoading.value)
const error = computed(() =>
  [wineError.value, appellationsError.value].filter((e): e is string => e !== null).join('; '),
)
const hasError = computed(() => error.value !== '')

const appellationName = computed(() => {
  if (!wine.value) return ''
  return appellations.value.find((a) => a.id === wine.value!.appellation_id)?.name ?? 'Unknown appellation'
})

const gardeStatus = computed(() => (wine.value ? computeGardeStatus(wine.value) : null))

watch(
  id,
  (next) => {
    consumptionError.value = null
    consumptionDate.value = ''
    consumptionRating.value = ''
    consumptionNotes.value = ''
    editingConsumptionId.value = null
    updateConsumptionError.value = null
    pendingDeleteConsumption.value = null
    deleteConsumptionError.value = null
    loadWine(next)
  },
  { immediate: true },
)

onMounted(() => {
  loadAppellations()
})

function retry() {
  loadWine(id.value)
}
</script>

<template>
  <section class="px-6 py-6">
    <StatusLine v-if="loading">Loading wine…</StatusLine>
    <StatusLine v-else-if="hasError" tone="error">
      Couldn't load this wine: {{ error }}
      <template #retry>
        <AppButton variant="ghost" data-testid="wine-detail-retry" @click="retry">Retry</AppButton>
      </template>
    </StatusLine>
    <div v-else-if="wine" data-testid="wine-detail" class="mx-auto max-w-2xl">
      <div class="flex flex-wrap items-start justify-between gap-6">
        <div class="flex items-center gap-3.5">
          <ColorSwatch :color="wine.color" variant="rail" />
          <h1 class="font-display text-ink text-[38px] leading-tight font-semibold tracking-tight">
            {{ wine.producer.name }}
          </h1>
        </div>
        <div class="flex items-center gap-4 pt-2">
          <AppButton :to="{ name: 'wine-edit', params: { id: wine.id } }" variant="secondary" data-testid="edit-wine-link">
            Edit
          </AppButton>
        </div>
      </div>

      <div class="text-muted mt-3.5 mb-[26px] ml-[19px] flex flex-wrap items-center gap-3 text-[14.5px]">
        <span class="capitalize">{{ wine.color }}</span>
        <span class="text-muted/40">·</span>
        <span>{{ appellationName }}</span>
        <span class="text-muted/40">·</span>
        <span class="text-ink-soft tabular-nums">{{ wine.millesime ?? 'NV' }}</span>
        <span class="text-muted/40">·</span>
        <span>Garde {{ wine.garde_debut }}–{{ wine.garde_fin }}</span>
        <span class="text-muted/40">·</span>
        <span class="text-ink-soft tabular-nums">×{{ wine.quantity }}</span>
        <GardeStatusBadge v-if="gardeStatus" :status="gardeStatus" class="ml-1" />
      </div>

      <div class="border-line border-t pt-[26px] pb-[26px]">
        <section>
          <div class="mb-4 flex items-center justify-between gap-3">
            <h2 class="font-display text-ink text-[16px] font-semibold">Suggested meals</h2>
            <AppButton
              :to="{
                name: 'meal-pairings',
                query: { appellation_id: wine.appellation_id, color: wine.color },
              }"
              variant="ghost"
              data-testid="manage-pairings-link"
            >
              Manage
            </AppButton>
          </div>
          <StatusLine v-if="wine.suggested_meals.length === 0">No suggestions yet.</StatusLine>
          <ul v-else data-testid="suggested-meals" class="flex flex-col gap-2.5 text-[15px]">
            <li
              v-for="meal in wine.suggested_meals"
              :key="meal.id"
              data-testid="suggested-meal"
              class="flex items-center gap-2.5"
            >
              <span class="bg-bordeaux h-1.5 w-1.5 shrink-0 rounded-full"></span>
              {{ meal.name }}
            </li>
          </ul>
        </section>

        <section class="border-line mt-[26px] border-t pt-[26px]">
          <h2 class="font-display text-ink mb-4 text-[16px] font-semibold">Consumption history</h2>
          <StatusLine v-if="wine.consumption_history.length === 0">No consumptions recorded yet.</StatusLine>
          <ul v-else data-testid="consumption-history" class="flex flex-col">
            <li
              v-for="(consumption, index) in wine.consumption_history"
              :key="consumption.id"
              data-testid="consumption-entry"
              class="flex flex-col gap-2 py-[11px]"
              :class="index < wine.consumption_history.length - 1 ? 'border-line border-b' : ''"
            >
              <form
                v-if="editingConsumptionId === consumption.id"
                data-testid="consumption-edit-form"
                class="flex flex-col gap-3"
                @submit.prevent="submitEdit(consumption.id)"
              >
                <FormField label="Date">
                  <input v-model="editDate" data-testid="consumption-edit-date-input" type="date" required class="w-full" />
                </FormField>
                <FormField label="Rating (1–5)">
                  <input
                    v-model="editRating"
                    data-testid="consumption-edit-rating-input"
                    type="number"
                    min="1"
                    max="5"
                    class="w-20"
                  />
                </FormField>
                <FormField label="Notes">
                  <textarea v-model="editNotes" data-testid="consumption-edit-notes-input" class="w-full"></textarea>
                </FormField>
                <StatusLine v-if="updateConsumptionError" tone="error">{{ updateConsumptionError }}</StatusLine>
                <div class="flex gap-2">
                  <AppButton type="submit" :disabled="updatingConsumption" data-testid="consumption-edit-save">
                    Save
                  </AppButton>
                  <AppButton type="button" variant="ghost" data-testid="consumption-edit-cancel" @click="cancelEdit">
                    Cancel
                  </AppButton>
                </div>
              </form>
              <div v-else class="flex items-start justify-between gap-3">
                <div class="flex flex-col gap-0.5">
                  <span class="text-ink text-[15px] font-semibold tabular-nums">{{ consumption.date }}</span>
                  <span v-if="consumption.rating !== null" class="text-muted text-[14.5px]">Rating: {{ consumption.rating }}</span>
                  <span v-if="consumption.notes" class="text-muted text-[14.5px]">{{ consumption.notes }}</span>
                </div>
                <div class="flex shrink-0 items-center gap-2">
                  <AppButton
                    type="button"
                    variant="ghost"
                    data-testid="consumption-edit-button"
                    @click="startEdit(consumption)"
                  >
                    Edit
                  </AppButton>
                  <AppButton
                    type="button"
                    variant="ghost"
                    data-testid="consumption-delete-button"
                    :disabled="deletingConsumption"
                    @click="askDeleteConsumption(consumption)"
                  >
                    Delete
                  </AppButton>
                </div>
              </div>
            </li>
          </ul>
          <StatusLine v-if="deleteConsumptionError" tone="error" class="mt-3">{{ deleteConsumptionError }}</StatusLine>
        </section>
      </div>

      <section class="border-line border-t pt-[26px]">
        <h2 class="font-display text-ink mb-[18px] text-[16px] font-semibold">Record a consumption</h2>
        <StatusLine v-if="wine.quantity === 0" data-testid="consumption-blocked-message">
          No bottles left to record a consumption — quantity is already 0.
        </StatusLine>
        <form
          v-else
          data-testid="consumption-form"
          class="flex flex-col gap-4"
          @submit.prevent="submitConsumption"
        >
          <FormField label="Date">
            <input v-model="consumptionDate" data-testid="consumption-date-input" type="date" required class="w-full" />
          </FormField>
          <FormField label="Rating (1–5)">
            <input
              v-model="consumptionRating"
              data-testid="consumption-rating-input"
              type="number"
              min="1"
              max="5"
              class="w-20"
            />
          </FormField>
          <FormField label="Notes">
            <textarea v-model="consumptionNotes" data-testid="consumption-notes-input" class="w-full"></textarea>
          </FormField>
          <StatusLine v-if="consumptionError" tone="error">{{ consumptionError }}</StatusLine>
          <AppButton type="submit" :disabled="submittingConsumption" class="self-start" data-testid="consumption-submit">
            Record
          </AppButton>
        </form>
      </section>
    </div>

    <ConfirmDialog
      :open="deleteConfirmOpen"
      :message="deleteConfirmMessage"
      confirm-label="Delete"
      @confirm="confirmDeleteConsumption"
      @cancel="cancelDeleteConsumption"
    />
  </section>
</template>
