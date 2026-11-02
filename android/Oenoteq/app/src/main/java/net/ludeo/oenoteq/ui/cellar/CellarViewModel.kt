package net.ludeo.oenoteq.ui.cellar

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
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
import net.ludeo.oenoteq.OenoteqApplication
import net.ludeo.oenoteq.data.CellarDatabase
import net.ludeo.oenoteq.data.snapshot.ImportSummary
import net.ludeo.oenoteq.data.snapshot.SnapshotImportError
import net.ludeo.oenoteq.data.snapshot.SnapshotImporter

sealed interface ImportState {
    data object Idle : ImportState
    data object Running : ImportState
    data class Done(val summary: ImportSummary) : ImportState

    /** [error] is null for an unexpected failure. */
    data class Failed(val error: SnapshotImportError?) : ImportState
}

data class CellarUiState(
    val loading: Boolean = true,
    val isEmpty: Boolean = false,
    val inStockCount: Int = 0,
    val importState: ImportState = ImportState.Idle,
)

class CellarViewModel(
    database: CellarDatabase,
    private val importer: SnapshotImporter,
) : ViewModel() {
    private val importState = MutableStateFlow<ImportState>(ImportState.Idle)

    val uiState: StateFlow<CellarUiState> = combine(
        database.cellarDao().observeIsEmpty(),
        database.wineDao().observeInStockCount(),
        importState,
    ) { isEmpty, inStock, import ->
        CellarUiState(loading = false, isEmpty = isEmpty, inStockCount = inStock, importState = import)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), CellarUiState())

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
        val Factory = viewModelFactory {
            initializer {
                val container = (this[APPLICATION_KEY] as OenoteqApplication).container
                CellarViewModel(container.database, container.snapshotImporter)
            }
        }
    }
}
