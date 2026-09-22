<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import type { Color } from '../api/types'
import AutocompleteField from '../components/AutocompleteField.vue'
import { useAppellations } from '../composables/useAppellations'
import { useMealPairings } from '../composables/useMealPairings'
import { useMeals } from '../composables/useMeals'
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

const selectionReady = computed(() => appellationId.value !== null && color.value !== '')

const loading = computed(() => appellationsLoading.value || mealsLoading.value)
const loadError = computed(() =>
  [appellationsError.value, mealsError.value].filter((e): e is string => e !== null).join('; '),
)
const hasLoadError = computed(() => loadError.value !== '')

watch([appellationId, color], ([nextAppellationId, nextColor]) => {
  if (nextAppellationId !== null && nextColor !== '') {
    loadPairings(nextAppellationId, nextColor as Color)
  }
})

onMounted(() => {
  loadAppellations()
  loadMeals()
  if (selectionReady.value) loadPairings(appellationId.value as number, color.value as Color)
})

async function addMeal() {
  if (!selectionReady.value || selectedMealId.value === null) return
  await addPairing(appellationId.value as number, color.value as Color, selectedMealId.value)
  if (!mutateError.value) selectedMealId.value = null
}

async function removeMeal(mealId: number) {
  if (!selectionReady.value) return
  await removePairing(appellationId.value as number, color.value as Color, mealId)
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
  <section class="px-6 py-4">
    <h2 class="font-serif text-xl text-stone-900">Meal pairings</h2>

    <p v-if="loading" role="status" class="text-stone-600">Loading…</p>
    <p v-else-if="hasLoadError" role="alert" class="text-red-700">Couldn't load: {{ loadError }}</p>
    <template v-else>
      <div class="mt-4 flex max-w-md flex-col gap-3">
        <label class="flex flex-col text-sm text-stone-700">
          Appellation
          <AutocompleteField
            testid="meal-pairing-appellation"
            :items="appellations"
            :model-value="appellationId"
            placeholder="Pick an appellation"
            @update:model-value="(v) => (appellationId = v)"
          />
        </label>

        <label class="flex flex-col text-sm text-stone-700">
          Color
          <select v-model="color" data-testid="meal-pairing-color-input">
            <option value="">Choose a color</option>
            <option v-for="c in colors" :key="c" :value="c">{{ c }}</option>
          </select>
        </label>
      </div>

      <template v-if="selectionReady">
        <p v-if="pairingsLoading" role="status" class="mt-4 text-stone-600">Loading pairings…</p>
        <p v-else-if="pairingsError" role="alert" class="mt-4 text-red-700">
          Couldn't load pairings: {{ pairingsError }}
        </p>
        <section v-else class="mt-6">
          <h3 class="font-serif text-lg text-stone-900">Currently paired</h3>
          <p v-if="pairedMeals.length === 0" class="text-stone-600">No meals paired yet.</p>
          <ul v-else data-testid="paired-meals">
            <li
              v-for="meal in pairedMeals"
              :key="meal.id"
              data-testid="paired-meal"
              class="flex items-center gap-2"
            >
              <span>{{ meal.name }}</span>
              <button
                type="button"
                data-testid="remove-meal-button"
                :disabled="mutating"
                class="text-xs text-stone-600 underline disabled:opacity-50"
                @click="removeMeal(meal.id)"
              >
                Remove
              </button>
            </li>
          </ul>

          <div class="mt-4 flex flex-col gap-2 max-w-md">
            <AutocompleteField
              testid="add-meal-autocomplete"
              :items="meals"
              :model-value="selectedMealId"
              placeholder="Add a meal"
              @update:model-value="(v) => (selectedMealId = v)"
            />
            <button
              type="button"
              data-testid="add-meal-button"
              :disabled="mutating || selectedMealId === null"
              class="self-start rounded bg-stone-800 px-3 py-1 text-sm text-white disabled:opacity-50"
              @click="addMeal"
            >
              Add meal
            </button>

            <button
              type="button"
              data-testid="new-meal-toggle"
              class="self-start text-xs text-stone-600 underline"
              @click="toggleNewMeal"
            >
              {{ showNewMeal ? 'Cancel' : "Can't find it? Create new meal" }}
            </button>
            <div v-if="showNewMeal" class="flex items-center gap-2">
              <input
                v-model="newMealName"
                data-testid="new-meal-name-input"
                type="text"
                placeholder="New meal name"
                class="rounded border border-stone-300 px-2 py-1 text-sm"
              />
              <button
                type="button"
                data-testid="new-meal-submit"
                :disabled="creatingMeal"
                class="rounded bg-stone-800 px-2 py-1 text-xs text-white disabled:opacity-50"
                @click="submitNewMeal"
              >
                Create
              </button>
            </div>
            <p v-if="mealCreateError" data-testid="new-meal-error" class="text-xs text-red-700">
              {{ mealCreateError }}
            </p>
            <p v-if="mutateError" role="alert" class="text-xs text-red-700">{{ mutateError }}</p>
          </div>
        </section>
      </template>
    </template>
  </section>
</template>
