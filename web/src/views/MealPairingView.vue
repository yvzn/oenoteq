<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { Color } from '../api/types'
import AppButton from '../components/AppButton.vue'
import AutocompleteField from '../components/AutocompleteField.vue'
import FormField from '../components/FormField.vue'
import PageHeader from '../components/PageHeader.vue'
import StatusLine from '../components/StatusLine.vue'
import { useAppellations } from '../composables/useAppellations'
import { useMealPairings } from '../composables/useMealPairings'
import { useMeals } from '../composables/useMeals'
import { useTransientMessage } from '../composables/useTransientMessage'
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
const showNewMeal = ref(false)
const newMealName = ref('')

const pairingSuccess = useTransientMessage()

const selectionReady = computed(() => appellationId.value !== null && color.value !== '')

const loading = computed(() => appellationsLoading.value || mealsLoading.value)
const loadError = computed(() =>
  [appellationsError.value, mealsError.value].filter((e): e is string => e !== null).join('; '),
)
const hasLoadError = computed(() => loadError.value !== '')

watch([appellationId, color], ([nextAppellationId, nextColor]) => {
  pairingSuccess.clear()
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

function toggleNewMeal() {
  showNewMeal.value = !showNewMeal.value
  newMealName.value = ''
}

async function submitNewMeal() {
  const name = newMealName.value.trim()
  if (name === '') return
  const created = await createMeal(name)
  if (created) {
    selectedMealId.value = created.id
    showNewMeal.value = false
    newMealName.value = ''
  }
}
</script>

<template>
  <section class="px-6 py-6">
    <PageHeader title="Meal pairings" />

    <StatusLine v-if="loading" class="mt-4">Loading…</StatusLine>
    <StatusLine v-else-if="hasLoadError" tone="error" class="mt-4">
      Couldn't load: {{ loadError }}
      <template #retry>
        <AppButton variant="ghost" data-testid="meal-pairing-retry" @click="retry">Retry</AppButton>
      </template>
    </StatusLine>
    <template v-else>
      <div class="mt-6 flex max-w-md flex-col gap-4">
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
          <select v-model="color" data-testid="meal-pairing-color-input">
            <option value="">Choose a color</option>
            <option v-for="c in colors" :key="c" :value="c">{{ c }}</option>
          </select>
        </FormField>
      </div>

      <template v-if="selectionReady">
        <StatusLine v-if="pairingsLoading" class="mt-6">Loading pairings…</StatusLine>
        <StatusLine v-else-if="pairingsError" tone="error" class="mt-6">
          Couldn't load pairings: {{ pairingsError }}
        </StatusLine>
        <section v-else class="border-line mt-8 border-t pt-6">
          <h3 class="font-display text-ink text-lg">Currently paired</h3>
          <StatusLine
            v-if="pairingSuccess.message.value"
            tone="success"
            data-testid="pairing-success"
            class="mt-2"
          >
            {{ pairingSuccess.message.value }}
          </StatusLine>
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
            class="mt-4 flex max-w-md flex-col gap-2"
            @submit.prevent="addMeal"
            @keydown="(e) => submitOnEnter(e, addMeal)"
          >
            <AutocompleteField
              testid="add-meal-autocomplete"
              :items="meals"
              :model-value="selectedMealId"
              placeholder="Add a meal"
              @update:model-value="(v) => (selectedMealId = v)"
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

          <AppButton
            type="button"
            variant="ghost"
            data-testid="new-meal-toggle"
            class="mt-3"
            @click="toggleNewMeal"
          >
            {{ showNewMeal ? 'Cancel' : "Can't find it? Create new meal" }}
          </AppButton>
          <form
            v-if="showNewMeal"
            class="mt-2 flex items-center gap-2"
            @submit.prevent="submitNewMeal"
            @keydown="(e) => submitOnEnter(e, submitNewMeal)"
          >
            <input
              v-model="newMealName"
              data-testid="new-meal-name-input"
              type="text"
              placeholder="New meal name"
              class="text-sm"
            />
            <AppButton
              type="button"
              data-testid="new-meal-submit"
              :disabled="creatingMeal"
              class="text-xs"
              @click="submitNewMeal"
            >
              Create
            </AppButton>
          </form>
          <StatusLine v-if="mealCreateError" tone="error" data-testid="new-meal-error" class="mt-1 text-xs">
            {{ mealCreateError }}
          </StatusLine>
          <StatusLine v-if="mutateError" tone="error" class="mt-1 text-xs">{{ mutateError }}</StatusLine>
        </section>
      </template>
    </template>
  </section>
</template>
