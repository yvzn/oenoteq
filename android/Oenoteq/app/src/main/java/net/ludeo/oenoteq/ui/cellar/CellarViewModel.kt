package net.ludeo.oenoteq.ui.cellar

import android.net.Uri
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import net.ludeo.oenoteq.data.CellarDatabase
import net.ludeo.oenoteq.data.ReferentialRepository
import net.ludeo.oenoteq.data.WineRepository
import net.ludeo.oenoteq.data.backup.CellarImporter
import net.ludeo.oenoteq.data.snapshot.ImportSummary
import net.ludeo.oenoteq.data.snapshot.SnapshotImportError
import net.ludeo.oenoteq.domain.CellarSearchData
import net.ludeo.oenoteq.domain.NamedItem
import net.ludeo.oenoteq.domain.Page
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.domain.SearchFilters
import net.ludeo.oenoteq.domain.WineListItem
import net.ludeo.oenoteq.domain.WineSort
import net.ludeo.oenoteq.domain.paginate
import net.ludeo.oenoteq.domain.searchCellar
import net.ludeo.oenoteq.ui.container
import java.time.Year

sealed interface ImportState {
    data object Idle : ImportState
    data object Running : ImportState
    data class Done(val summary: ImportSummary) : ImportState

    /** [error] is null for an unexpected failure. */
    data class Failed(val error: SnapshotImportError?) : ImportState
}

data class CellarUiState(
    val loading: Boolean = true,
    /** Nothing recorded at all: the only state the one-time import accepts. */
    val databaseIsEmpty: Boolean = false,
    val filters: SearchFilters = SearchFilters(),
    val sort: WineSort = WineSort(),
    val page: Page<WineListItem> = paginate(emptyList(), 1),
    val appellations: List<NamedItem> = emptyList(),
    val meals: List<NamedItem> = emptyList(),
    val importState: ImportState = ImportState.Idle,
)

/**
 * The cellar list. Filters, sort and page live in the [SavedStateHandle], so
 * they survive going to a Wine and back, rotation and process death.
 */
class CellarViewModel(
    private val savedState: SavedStateHandle,
    database: CellarDatabase,
    wines: WineRepository,
    meals: ReferentialRepository,
    private val importer: CellarImporter,
    private val currentYear: () -> Int = { Year.now().value },
) : ViewModel() {
    private val importState = MutableStateFlow<ImportState>(ImportState.Idle)
    private val filters = savedState.getStateFlow(FILTERS, SearchFilters())
    private val sort = savedState.getStateFlow(SORT, WineSort())
    private val page = savedState.getStateFlow(PAGE, 1)

    /** The data the list was last built from, to count a filter draft against. */
    private var searchData: CellarSearchData? = null

    private val listing = combine(wines.observeSearchData(), filters, sort, page) { data, f, s, p ->
        searchData = data
        CellarUiState(
            loading = false,
            filters = f,
            sort = s,
            page = paginate(searchCellar(data, f, s, currentYear()), p),
            appellations = data.appellations,
        )
    }

    val uiState: StateFlow<CellarUiState> = combine(
        listing,
        meals.observeAll(),
        database.cellarDao().observeIsEmpty(),
        importState,
    ) { listed, mealList, isEmpty, import ->
        listed.copy(databaseIsEmpty = isEmpty, meals = mealList, importState = import)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), CellarUiState())

    /** A new filter or sort starts again from the first page, as the PWA's query does. */
    /** How many Wines [draft] would list: the filters sheet's "Show N wines". */
    fun count(draft: SearchFilters): Int = searchData?.let { searchCellar(it, draft, WineSort(), currentYear()).size } ?: 0

    fun updateFilters(next: SearchFilters) {
        savedState[FILTERS] = next
        savedState[PAGE] = 1
    }

    fun clearFilters() = updateFilters(SearchFilters())

    fun updateSort(next: WineSort) {
        savedState[SORT] = next
        savedState[PAGE] = 1
    }

    fun goToPage(page: Int) {
        savedState[PAGE] = page
    }

    fun importSnapshot(uri: Uri) {
        if (importState.value == ImportState.Running) return
        importState.value = ImportState.Running
        viewModelScope.launch {
            importState.value = try {
                ImportState.Done(importer.import(uri))
            } catch (e: SnapshotImportError) {
                ImportState.Failed(e)
            } catch (e: CancellationException) {
                throw e
            } catch (_: Exception) {
                ImportState.Failed(null)
            }
        }
    }

    fun dismissImportResult() {
        importState.value = ImportState.Idle
    }

    companion object {
        private const val FILTERS = "filters"
        private const val SORT = "sort"
        private const val PAGE = "page"

        val Factory = viewModelFactory {
            initializer {
                CellarViewModel(
                    createSavedStateHandle(),
                    container.database,
                    container.wines,
                    container.referentials(Referential.MEAL),
                    container.cellarImporter,
                )
            }
        }
    }
}
