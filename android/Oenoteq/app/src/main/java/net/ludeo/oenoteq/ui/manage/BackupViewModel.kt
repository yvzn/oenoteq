package net.ludeo.oenoteq.ui.manage

import android.net.Uri
import androidx.lifecycle.ViewModel
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
import net.ludeo.oenoteq.data.backup.CellarBackup
import net.ludeo.oenoteq.data.backup.CellarImporter
import net.ludeo.oenoteq.data.snapshot.ImportSummary
import net.ludeo.oenoteq.data.snapshot.SnapshotImportError
import net.ludeo.oenoteq.ui.container

sealed interface BackupState {
    data object Idle : BackupState
    data object Exporting : BackupState
    data object Importing : BackupState
    data class Exported(val summary: ImportSummary) : BackupState
    data class Imported(val summary: ImportSummary) : BackupState
    data object ExportFailed : BackupState

    /** [error] is null for an unexpected failure. */
    data class ImportFailed(val error: SnapshotImportError?) : BackupState
}

data class BackupUiState(
    /** Nothing recorded at all: an import replaces nothing, so it is not asked to confirm. */
    val isEmpty: Boolean = true,
    val wineCount: Int = 0,
    val state: BackupState = BackupState.Idle,
)

/** The Manage hub's Backup section: export the cellar to a file, import a file over it. */
class BackupViewModel(
    database: CellarDatabase,
    private val backup: CellarBackup,
    private val importer: CellarImporter,
) : ViewModel() {
    private val state = MutableStateFlow<BackupState>(BackupState.Idle)

    val uiState: StateFlow<BackupUiState> = combine(
        database.cellarDao().observeIsEmpty(),
        database.wineDao().observeCount(),
        state,
    ) { isEmpty, wines, current -> BackupUiState(isEmpty, wines, current) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), BackupUiState())

    fun export(uri: Uri) = run(BackupState.Exporting, { BackupState.ExportFailed }) {
        BackupState.Exported(backup.export(uri))
    }

    fun import(uri: Uri) = run(BackupState.Importing, { BackupState.ImportFailed(it as? SnapshotImportError) }) {
        BackupState.Imported(importer.import(uri))
    }

    fun dismissResult() {
        state.value = BackupState.Idle
    }

    private fun run(running: BackupState, failed: (Exception) -> BackupState, work: suspend () -> BackupState) {
        if (state.value == BackupState.Exporting || state.value == BackupState.Importing) return
        state.value = running
        viewModelScope.launch {
            state.value = try {
                work()
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                failed(e)
            }
        }
    }

    companion object {
        val Factory = viewModelFactory {
            initializer { BackupViewModel(container.database, container.cellarBackup, container.cellarImporter) }
        }
    }
}
