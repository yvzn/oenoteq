<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { Color } from '../api/types'
import AppButton from '../components/AppButton.vue'
import AutocompleteField from '../components/AutocompleteField.vue'
import ColorSwatch from '../components/ColorSwatch.vue'
import CreateFeedback from '../components/CreateFeedback.vue'
import FormField from '../components/FormField.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusLine from '../components/StatusLine.vue'
import { useAppellations } from '../composables/useAppellations'
import { useMealPairings } from '../composables/useMealPairings'
import { useMeals } from '../composables/useMeals'
import { useSuccessMessage } from '../composables/useSuccessMessage'
import { parseColor, parseId } from '../domain/searchFilters'

const route = useRoute()

const {
  appellations,
  loading: appellationsLoading,
  error: appellationsError,
  load: loadAppellations,
} = useAppellations()
const {
  meals,
  loading: mealsLoading,
  error: mealsError,
  load: loadMeals,
  create: createMeal,
  creating: creatingMeal,
  createError: mealCreateError,
} = useMeals()
const {
  meals: pairedMeals,
  loading: pairingsLoading,
  error: pairingsError,
  load: loadPairings,
  add: addPairing,
  remove: removePairing,
  mutating,
  mutateError,
} = useMealPairings()

const colors: Color[] = ['rouge', 'blanc', 'rose']

const appellationId = ref<number | null>(parseId(route.query.appellation_id))
const color = ref<Color | ''>(parseColor(route.query.color) ?? '')

const selectedMealId = ref<number | null>(null)

const pairingSuccess = useSuccessMessage()
const createdMeal = ref<{ id: number; name: string } | null>(null)

const selectionReady = computed(() => appellationId.value !== null && color.value !== '')

const loading = computed(() => appellationsLoading.value || mealsLoading.value)
const loadError = computed(() =>
  [appellationsError.value, mealsError.value].filter((e): e is string => e !== null).join('; '),
)
const hasLoadError = computed(() => loadError.value !== '')

watch([appellationId, color], ([nextAppellationId, nextColor]) => {
  pairingSuccess.clear()
  createdMeal.value = null
  if (nextAppellationId !== null && nextColor !== '') {
    loadPairings(nextAppellationId, nextColor as Color)
  }
})

function retry() {
  loadAppellations()
  loadMeals()
}

onMounted(() => {
  retry()
  if (selectionReady.value) loadPairings(appellationId.value as number, color.value as Color)
})

async function addMeal() {
  if (!selectionReady.value || selectedMealId.value === null) return
  await addPairing(appellationId.value as number, color.value as Color, selectedMealId.value)
  if (!mutateError.value) {
    selectedMealId.value = null
    pairingSuccess.show('Meal pairing added.')
  }
}

async function removeMeal(mealId: number) {
  if (!selectionReady.value) return
  await removePairing(appellationId.value as number, color.value as Color, mealId)
  if (!mutateError.value) pairingSuccess.show('Meal pairing removed.')
}

function submitOnEnter(event: KeyboardEvent, action: () => void) {
  if (event.key !== 'Enter' || event.defaultPrevented) return
  event.preventDefault()
  action()
}

async function submitNewMeal(name: string) {
  if (!selectionReady.value) return
  createdMeal.value = null
  const created = await createMeal(name)
  if (!created) return
  createdMeal.value = { id: created.id, name: created.name }
  await addPairing(appellationId.value as number, color.value as Color, created.id)
  if (mutateError.value) {
    selectedMealId.value = created.id
  } else {
    pairingSuccess.show('Meal pairing added.')
  }
}
</script>

<template>
  <section class="px-6 py-6">
   <div class="mx-auto max-w-2xl">
    <PageHeader title="Meal pairings" :color="color" />

    <StatusLine v-if="loading" class="mt-4">Loading…</StatusLine>
    <StatusLine v-else-if="hasLoadError" tone="error" class="mt-4">
      Couldn't load: {{ loadError }}
      <template #retry>
        <AppButton variant="ghost" data-testid="meal-pairing-retry" @click="retry">Retry</AppButton>
      </template>
    </StatusLine>
    <template v-else>
      <div class="mt-6 grid grid-cols-2 gap-4">
        <FormField label="Appellation">
          <AutocompleteField
            testid="meal-pairing-appellation"
            :items="appellations"
            :model-value="appellationId"
            placeholder="Pick an appellation"
            @update:model-value="(v) => (appellationId = v)"
          />
        </FormField>

        <FormField label="Color">
          <div class="flex items-center gap-2">
            <ColorSwatch v-if="color" :color="color" class="shrink-0" />
            <select v-model="color" data-testid="meal-pairing-color-input" class="w-full">
              <option value="">Choose a color</option>
              <option v-for="c in colors" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
        </FormField>
      </div>

      <section
        v-if="!selectionReady"
        class="border-line mt-10 flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-6 py-10 text-center"
      >
        <p class="text-ink-soft text-[15px] font-medium">No selection yet</p>
        <p class="text-muted text-[14px]">Pick an appellation and a color above to see and edit meal pairings.</p>
      </section>

      <template v-if="selectionReady">
        <StatusLine v-if="pairingsLoading" class="mt-6">Loading pairings…</StatusLine>
        <StatusLine v-else-if="pairingsError" tone="error" class="mt-6">
          Couldn't load pairings: {{ pairingsError }}
        </StatusLine>
        <section v-else class="border-line mt-8 border-t pt-6">
          <h3 class="font-display text-ink text-[16px] font-semibold">Currently paired</h3>
          <StatusLine v-if="pairedMeals.length === 0" class="mt-2">No meals paired yet.</StatusLine>
          <ul v-else data-testid="paired-meals" class="mt-2 flex flex-col gap-1">
            <li
              v-for="meal in pairedMeals"
              :key="meal.id"
              data-testid="paired-meal"
              class="flex items-center gap-3 text-sm"
            >
              <span class="text-ink">{{ meal.name }}</span>
              <AppButton
                type="button"
                variant="ghost"
                data-testid="remove-meal-button"
                :disabled="mutating"
                @click="removeMeal(meal.id)"
              >
                Remove
              </AppButton>
            </li>
          </ul>

          <form
            class="mt-4 flex flex-col gap-2"
            @submit.prevent="addMeal"
            @keydown="(e) => submitOnEnter(e, addMeal)"
          >
            <AutocompleteField
              testid="add-meal-autocomplete"
              :items="meals"
              :model-value="selectedMealId"
              placeholder="Add or create a meal"
              creatable
              :busy="creatingMeal || mutating"
              @update:model-value="(v) => (selectedMealId = v)"
              @create="submitNewMeal"
            />
            <AppButton
              type="button"
              data-testid="add-meal-button"
              :disabled="mutating || selectedMealId === null"
              class="self-start"
              @click="addMeal"
            >
              Add meal
            </AppButton>
          </form>

          <CreateFeedback
            testid="new-meal"
            entity="meal"
            error-testid="new-meal-error"
            :creating="creatingMeal"
            :created="createdMeal"
            :error="mealCreateError"
          />
          <StatusLine v-if="mutateError" tone="error" class="mt-1 text-xs">{{ mutateError }}</StatusLine>
        </section>
      </template>
    </template>
   </div>
  </section>
</template>
