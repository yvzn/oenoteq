package net.ludeo.oenoteq.ui.cellar

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.WineBar
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.data.snapshot.ImportSummary
import net.ludeo.oenoteq.data.snapshot.SnapshotImportError

@Composable
fun CellarScreen(viewModel: CellarViewModel = viewModel(factory = CellarViewModel.Factory)) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    // SQLite snapshots carry no reliable MIME type across file providers, so any file can be picked.
    val pickSnapshot = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) viewModel.importSnapshot(uri)
    }

    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        when {
            state.loading -> CircularProgressIndicator()
            state.importState == ImportState.Running -> ImportRunning()
            state.isEmpty -> EmptyCellar(onImport = { pickSnapshot.launch(arrayOf("*/*")) })
            // Placeholder until the cellar list lands (milestone 2).
            else -> Text(
                pluralStringResource(R.plurals.cellar_in_stock_count, state.inStockCount, state.inStockCount),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.testTag("cellar-in-stock-count"),
            )
        }
    }

    when (val import = state.importState) {
        is ImportState.Done -> ImportDoneDialog(import.summary, viewModel::dismissImportResult)
        is ImportState.Failed -> ImportFailedDialog(import.error, viewModel::dismissImportResult)
        else -> Unit
    }
}

@Composable
private fun EmptyCellar(onImport: () -> Unit) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.testTag("cellar-empty"),
    ) {
        Icon(
            Icons.Outlined.WineBar,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(48.dp),
        )
        Text(stringResource(R.string.cellar_empty_title), style = MaterialTheme.typography.titleLarge)
        Text(
            stringResource(R.string.cellar_empty_import_hint),
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(4.dp))
        Button(onClick = onImport, modifier = Modifier.testTag("import-cellar")) {
            Text(stringResource(R.string.import_action))
        }
    }
}

@Composable
private fun ImportRunning() {
    Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
        CircularProgressIndicator()
        Text(stringResource(R.string.import_running))
    }
}

@Composable
private fun ImportDoneDialog(summary: ImportSummary, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_ok)) } },
        title = { Text(stringResource(R.string.import_done_title)) },
        text = {
            Column(Modifier.testTag("import-summary"), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                SummaryLine(R.plurals.import_summary_wines, summary.wines)
                SummaryLine(R.plurals.import_summary_producers, summary.producers)
                SummaryLine(R.plurals.import_summary_appellations, summary.appellations)
                SummaryLine(R.plurals.import_summary_meals, summary.meals)
                SummaryLine(R.plurals.import_summary_meal_pairings, summary.mealPairings)
                SummaryLine(R.plurals.import_summary_consumptions, summary.consumptions)
            }
        },
    )
}

@Composable
private fun SummaryLine(plural: Int, count: Int) {
    Text(pluralStringResource(plural, count, count))
}

@Composable
private fun ImportFailedDialog(error: SnapshotImportError?, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_ok)) } },
        title = { Text(stringResource(R.string.import_failed_title)) },
        text = { Text(importErrorMessage(error), Modifier.testTag("import-error")) },
    )
}

@Composable
private fun importErrorMessage(error: SnapshotImportError?): String = when (error) {
    is SnapshotImportError.NotACellarDatabase -> stringResource(R.string.import_error_not_cellar)
    is SnapshotImportError.Corrupt -> stringResource(R.string.import_error_corrupt)
    is SnapshotImportError.UnsupportedSchema ->
        stringResource(R.string.import_error_unsupported_schema, error.found ?: "—")
    is SnapshotImportError.CellarNotEmpty -> stringResource(R.string.import_error_not_empty)
    is SnapshotImportError.OrphanRows -> stringResource(
        R.string.import_error_orphans,
        error.countsByTable.values.sum(),
        error.countsByTable.entries.joinToString { (table, count) -> "$table: $count" },
    )
    is SnapshotImportError.InvalidRow -> stringResource(
        R.string.import_error_invalid_row,
        error.table,
        error.id,
        stringResource(reasonText(error.reason)),
    )
    null -> stringResource(R.string.import_error_unexpected)
}

private fun reasonText(reason: SnapshotImportError.Reason): Int = when (reason) {
    SnapshotImportError.Reason.BLANK_NAME -> R.string.import_reason_blank_name
    SnapshotImportError.Reason.DUPLICATE_NAME -> R.string.import_reason_duplicate_name
    SnapshotImportError.Reason.INVALID_COLOR -> R.string.import_reason_invalid_color
    SnapshotImportError.Reason.INVALID_RATING -> R.string.import_reason_invalid_rating
    SnapshotImportError.Reason.NEGATIVE_QUANTITY -> R.string.import_reason_negative_quantity
    SnapshotImportError.Reason.INVALID_DATE -> R.string.import_reason_invalid_date
    SnapshotImportError.Reason.INVALID_TIMESTAMP -> R.string.import_reason_invalid_timestamp
}
