package net.ludeo.oenoteq.ui.history

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import net.ludeo.oenoteq.data.ConsumptionRepository
import net.ludeo.oenoteq.data.MealPairingRepository
import net.ludeo.oenoteq.data.ReferentialRepository
import net.ludeo.oenoteq.domain.HistoryEntry
import net.ludeo.oenoteq.domain.HistorySort
import net.ludeo.oenoteq.domain.NamedItem
import net.ludeo.oenoteq.domain.Page
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.domain.SearchFilters
import net.ludeo.oenoteq.domain.consumptionHistory
import net.ludeo.oenoteq.domain.paginate
import net.ludeo.oenoteq.ui.container

data class HistoryUiState(
    val loading: Boolean = true,
    /** No Consumption recorded at all, whatever the filters. */
    val isEmpty: Boolean = false,
    val filters: SearchFilters = SearchFilters(),
    val sort: HistorySort = HistorySort(),
    val page: Page<HistoryEntry> = paginate(emptyList(), 1),
    val appellations: List<NamedItem> = emptyList(),
    val meals: List<NamedItem> = emptyList(),
)

/** The Consumption History; filters, sort and page survive a visit to a Wine, as on the cellar list. */
class HistoryViewModel(
    private val savedState: SavedStateHandle,
    consumptions: ConsumptionRepository,
    pairings: MealPairingRepository,
    appellations: ReferentialRepository,
    meals: ReferentialRepository,
) : ViewModel() {
    private val filters = savedState.getStateFlow(FILTERS, SearchFilters())
    private val sort = savedState.getStateFlow(SORT, HistorySort())
    private val page = savedState.getStateFlow(PAGE, 1)

    private val listing = combine(consumptions.observeHistory(), pairings.observeAll(), filters, sort, page) { all, p, f, s, n ->
        HistoryUiState(
            loading = false,
            isEmpty = all.isEmpty(),
            filters = f,
            sort = s,
            page = paginate(consumptionHistory(all, p, f, s), n),
        )
    }

    val uiState: StateFlow<HistoryUiState> = combine(listing, appellations.observeAll(), meals.observeAll()) { l, a, m ->
        l.copy(appellations = a, meals = m)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), HistoryUiState())

    fun updateFilters(next: SearchFilters) {
        // "Ready now" is the cellar list's own filter.
        savedState[FILTERS] = next.copy(readyNow = false)
        savedState[PAGE] = 1
    }

    fun clearFilters() = updateFilters(SearchFilters())

    fun updateSort(next: HistorySort) {
        savedState[SORT] = next
        savedState[PAGE] = 1
    }

    fun goToPage(page: Int) {
        savedState[PAGE] = page
    }

    companion object {
        private const val FILTERS = "filters"
        private const val SORT = "sort"
        private const val PAGE = "page"

        val Factory = viewModelFactory {
            initializer {
                HistoryViewModel(
                    createSavedStateHandle(),
                    container.consumptions,
                    container.mealPairings,
                    container.referentials(Referential.APPELLATION),
                    container.referentials(Referential.MEAL),
                )
            }
        }
    }
}
