package net.ludeo.oenoteq.ui.wine

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import net.ludeo.oenoteq.data.ConsumptionEntity
import net.ludeo.oenoteq.data.ConsumptionRepository
import net.ludeo.oenoteq.data.MealPairingRepository
import net.ludeo.oenoteq.data.WineRepository
import net.ludeo.oenoteq.data.WineWithNames
import net.ludeo.oenoteq.domain.CellarError
import net.ludeo.oenoteq.domain.ConsumptionInput
import net.ludeo.oenoteq.domain.GardeStatus
import net.ludeo.oenoteq.domain.NamedItem
import net.ludeo.oenoteq.domain.gardeStatus
import net.ludeo.oenoteq.domain.parseQuantityDelta
import net.ludeo.oenoteq.ui.attempt
import net.ludeo.oenoteq.ui.container
import java.time.LocalDate

/** A Consumption as typed in the record or edit form. */
data class ConsumptionDraft(val date: String, val rating: Int? = null, val notes: String = "") {
    fun toInput() = ConsumptionInput(date.trim(), rating, notes)
}

/** What the user is doing on the page, apart from the data it shows. */
data class WineDetailEditing(
    val record: ConsumptionDraft,
    val recordError: CellarError.Code? = null,
    val editingId: Long? = null,
    val edit: ConsumptionDraft = ConsumptionDraft(""),
    val editError: CellarError.Code? = null,
    val confirmingDelete: ConsumptionEntity? = null,
    val deleteError: CellarError.Code? = null,
    val adjusting: Boolean = false,
    val adjustText: String = "",
    val adjustError: CellarError.Code? = null,
    val busy: Boolean = false,
    /** What the last changes touched (`quantity`, `consumption-<id>`), shown highlighted until the user leaves. */
    val highlights: Set<String> = emptySet(),
)

data class WineDetailState(
    val loading: Boolean = true,
    val wine: WineWithNames? = null,
    val gardeStatus: GardeStatus = GardeStatus.UNASSESSED,
    val suggestedMeals: List<NamedItem> = emptyList(),
    val consumptions: List<ConsumptionEntity> = emptyList(),
    val editing: WineDetailEditing,
)

@OptIn(ExperimentalCoroutinesApi::class)
class WineDetailViewModel(
    val id: Long,
    private val wines: WineRepository,
    private val consumptions: ConsumptionRepository,
    pairings: MealPairingRepository,
    private val today: () -> LocalDate = LocalDate::now,
) : ViewModel() {
    private val editing = MutableStateFlow(WineDetailEditing(record = ConsumptionDraft(today().toString())))

    private val wine = wines.observe(id)
    private val suggestedMeals = wine.flatMapLatest { w ->
        if (w == null) flowOf(emptyList()) else pairings.observeMeals(w.appellationId, w.color)
    }

    val state: StateFlow<WineDetailState> = combine(
        wine,
        suggestedMeals,
        consumptions.observeForWine(id),
        editing,
    ) { w, meals, list, e ->
        WineDetailState(
            loading = false,
            wine = w,
            gardeStatus = w?.let { gardeStatus(it.gardeDebut, it.gardeFin, today().year) } ?: GardeStatus.UNASSESSED,
            suggestedMeals = meals,
            consumptions = list,
            editing = e,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), WineDetailState(editing = editing.value))

    /** The quantity a typed correction would lead to, or null while it isn't a whole non-zero number. */
    val adjustResult: StateFlow<Int?> = combine(wine, editing) { w, e ->
        parseQuantityDelta(e.adjustText)?.let { delta -> w?.quantity?.plus(delta) }
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), null)

    fun editRecord(draft: ConsumptionDraft) = editing.update { it.copy(record = draft, recordError = null) }

    fun record() = run(
        action = { setOf(QUANTITY, consumptionKey(consumptions.create(id, editing.value.record.toInput()))) },
        // A fresh form for the next bottle, dated today again.
        done = { it.copy(record = ConsumptionDraft(today().toString())) },
        failed = { e, code -> e.copy(recordError = code) },
    )

    fun startEdit(consumption: ConsumptionEntity) = editing.update {
        it.copy(
            editingId = consumption.id,
            edit = ConsumptionDraft(consumption.date, consumption.rating, consumption.notes.orEmpty()),
            editError = null,
        )
    }

    fun editConsumption(draft: ConsumptionDraft) = editing.update { it.copy(edit = draft, editError = null) }

    fun cancelEdit() = editing.update { it.copy(editingId = null, editError = null) }

    fun saveEdit() {
        val consumptionId = editing.value.editingId ?: return
        run(
            action = {
                consumptions.update(consumptionId, editing.value.edit.toInput())
                setOf(consumptionKey(consumptionId))
            },
            done = { it.copy(editingId = null) },
            failed = { e, code -> e.copy(editError = code) },
        )
    }

    fun askDelete(consumption: ConsumptionEntity) =
        editing.update { it.copy(confirmingDelete = consumption, deleteError = null) }

    fun cancelDelete() = editing.update { it.copy(confirmingDelete = null) }

    fun confirmDelete() {
        val consumption = editing.value.confirmingDelete ?: return
        editing.update { it.copy(confirmingDelete = null) }
        run(
            action = {
                consumptions.delete(consumption.id)
                setOf(QUANTITY)
            },
            done = { if (it.editingId == consumption.id) it.copy(editingId = null) else it },
            failed = { e, code -> e.copy(deleteError = code) },
        )
    }

    fun openAdjust() = editing.update { it.copy(adjusting = true, adjustText = "", adjustError = null) }

    fun editAdjust(text: String) = editing.update { it.copy(adjustText = text, adjustError = null) }

    fun closeAdjust() = editing.update { it.copy(adjusting = false) }

    fun adjust() {
        val delta = parseQuantityDelta(editing.value.adjustText) ?: return
        run(
            action = {
                wines.adjustQuantity(id, delta)
                setOf(QUANTITY)
            },
            done = { it.copy(adjusting = false) },
            failed = { e, code -> e.copy(adjustError = code) },
        )
    }

    /** Leaving the page forgets what was highlighted, as the PWA does on navigation. */
    fun clearHighlights() = editing.update { it.copy(highlights = emptySet()) }

    /**
     * One write at a time. On success the keys [action] returns are
     * highlighted: the change is on screen, so no message confirms it (as the
     * PWA's `useHighlight`). A refusal lands next to the form that asked for it.
     */
    private fun run(
        action: suspend () -> Set<String>,
        done: (WineDetailEditing) -> WineDetailEditing,
        failed: (WineDetailEditing, CellarError.Code) -> WineDetailEditing,
    ) {
        if (editing.value.busy) return
        editing.update { it.copy(busy = true) }
        viewModelScope.launch {
            var changed = emptySet<String>()
            val refusal = attempt { changed = action() }
            if (refusal == null) {
                editing.update { done(it).copy(busy = false, highlights = it.highlights + changed) }
            } else {
                editing.update { failed(it, refusal).copy(busy = false) }
            }
        }
    }

    companion object {
        const val QUANTITY = "quantity"

        fun consumptionKey(id: Long) = "consumption-$id"

        fun factory(id: Long) = viewModelFactory {
            initializer {
                WineDetailViewModel(id, container.wines, container.consumptions, container.mealPairings)
            }
        }
    }
}
