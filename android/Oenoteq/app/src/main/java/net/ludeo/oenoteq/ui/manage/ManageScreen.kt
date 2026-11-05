package net.ludeo.oenoteq.ui.manage

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.ui.cellar.ImportDoneDialog
import net.ludeo.oenoteq.ui.cellar.ImportFailedDialog
import net.ludeo.oenoteq.ui.cellar.ImportRunning
import net.ludeo.oenoteq.ui.cellar.ReplaceCellarDialog
import net.ludeo.oenoteq.ui.components.LanguageToggle
import net.ludeo.oenoteq.ui.components.ScreenScaffold
import net.ludeo.oenoteq.ui.components.texts
import java.time.LocalDate

/**
 * The Manage hub: one card per kind of reference data, then Meal Pairings,
 * then, set apart, what acts on the whole cellar as a file: its Backup.
 */
@Composable
fun ManageScreen(
    onOpen: (Referential) -> Unit,
    onOpenPairings: () -> Unit,
    viewModel: BackupViewModel = viewModel(factory = BackupViewModel.Factory),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    // The picked file waits here for the user's confirmation when it would replace something.
    var pendingImport by rememberSaveable { mutableStateOf<Uri?>(null) }
    val pickExport = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        if (uri != null) viewModel.export(uri)
    }
    // SQLite files carry no reliable MIME type across file providers, so any file can be picked.
    val pickImport = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        when {
            uri == null -> Unit
            state.isEmpty -> viewModel.import(uri)
            else -> pendingImport = uri
        }
    }

    ScreenScaffold(title = stringResource(R.string.nav_manage), actions = { LanguageToggle() }) { modifier ->
        when (state.state) {
            BackupState.Exporting -> ImportRunning(modifier, R.string.backup_export_running)
            BackupState.Importing -> ImportRunning(modifier)
            else -> Column(
                modifier.verticalScroll(rememberScrollState()).padding(16.dp).testTag("manage-screen"),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                for (kind in Referential.entries) {
                    HubCard(kind.texts.label, kind.texts.description, "manage-${kind.name.lowercase()}") { onOpen(kind) }
                }
                HubCard(
                    R.string.manage_meal_pairings_label,
                    R.string.manage_meal_pairings_description,
                    "manage-meal-pairings",
                    onOpenPairings,
                )

                // A deliberate gap: these cards act on the whole cellar, not on its data.
                HorizontalDivider(Modifier.padding(top = 12.dp))
                Text(
                    stringResource(R.string.backup_section_title),
                    style = MaterialTheme.typography.titleSmall,
                    color = MaterialTheme.colorScheme.primary,
                    modifier = Modifier.padding(top = 4.dp).testTag("backup-title"),
                )
                HubCard(R.string.backup_export_label, R.string.backup_export_description, "backup-export") {
                    pickExport.launch("oenoteq-cellar-${LocalDate.now()}.db")
                }
                HubCard(R.string.backup_import_label, R.string.backup_import_description, "backup-import") {
                    pickImport.launch(arrayOf("*/*"))
                }
            }
        }
    }

    pendingImport?.let { uri ->
        ReplaceCellarDialog(
            wineCount = state.wineCount,
            onConfirm = {
                pendingImport = null
                viewModel.import(uri)
            },
            onDismiss = { pendingImport = null },
        )
    }

    when (val result = state.state) {
        is BackupState.Imported -> ImportDoneDialog(result.summary, viewModel::dismissResult)
        is BackupState.Exported -> ImportDoneDialog(result.summary, viewModel::dismissResult, R.string.backup_export_done_title)
        is BackupState.ImportFailed -> ImportFailedDialog(result.error, viewModel::dismissResult)
        BackupState.ExportFailed -> AlertDialog(
            onDismissRequest = viewModel::dismissResult,
            confirmButton = { TextButton(onClick = viewModel::dismissResult) { Text(stringResource(R.string.action_ok)) } },
            title = { Text(stringResource(R.string.backup_export_failed_title)) },
            text = { Text(stringResource(R.string.backup_export_failed)) },
        )
        else -> Unit
    }
}

@Composable
private fun HubCard(label: Int, description: Int, testTag: String, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth().testTag(testTag)) {
        Column(Modifier.padding(16.dp)) {
            Text(stringResource(label), style = MaterialTheme.typography.titleMedium)
            Text(
                stringResource(description),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
