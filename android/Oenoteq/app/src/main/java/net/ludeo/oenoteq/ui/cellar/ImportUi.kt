package net.ludeo.oenoteq.ui.cellar

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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.data.snapshot.ImportSummary
import net.ludeo.oenoteq.data.snapshot.SnapshotImportError

/** No Wine in stock. While nothing at all is recorded, the one-time import is offered too. */
@Composable
fun EmptyCellar(onAddWine: () -> Unit, onImport: (() -> Unit)?, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
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
                stringResource(R.string.cellar_empty_add_hint),
                style = MaterialTheme.typography.bodyMedium,
                textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Button(onClick = onAddWine, modifier = Modifier.testTag("empty-add-wine")) {
                Text(stringResource(R.string.cellar_add))
            }
            if (onImport != null) {
                Spacer(Modifier.height(12.dp))
                Text(
                    stringResource(R.string.cellar_empty_import_hint),
                    style = MaterialTheme.typography.bodyMedium,
                    textAlign = TextAlign.Center,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                OutlinedButton(onClick = onImport, modifier = Modifier.testTag("import-cellar")) {
                    Text(stringResource(R.string.import_action))
                }
            }
        }
    }
}

@Composable
fun ImportRunning(modifier: Modifier = Modifier, text: Int = R.string.import_running) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            CircularProgressIndicator()
            Text(stringResource(text))
        }
    }
}

/** What an import or an export moved, one line per kind of row. */
@Composable
fun ImportDoneDialog(summary: ImportSummary, onDismiss: () -> Unit, title: Int = R.string.import_done_title) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_ok)) } },
        title = { Text(stringResource(title)) },
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

/** Asked before a file replaces a cellar that holds something: the button says what it does. */
@Composable
fun ReplaceCellarDialog(wineCount: Int, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(onClick = onConfirm, modifier = Modifier.testTag("replace-confirm")) {
                Text(stringResource(R.string.backup_replace_confirm))
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.action_cancel)) } },
        title = { Text(stringResource(R.string.backup_replace_title)) },
        text = { Text(pluralStringResource(R.plurals.backup_replace_message, wineCount, wineCount)) },
    )
}

@Composable
private fun SummaryLine(plural: Int, count: Int) {
    Text(pluralStringResource(plural, count, count))
}

@Composable
fun ImportFailedDialog(error: SnapshotImportError?, onDismiss: () -> Unit) {
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
    is SnapshotImportError.UnsupportedBackup -> stringResource(R.string.import_error_unsupported_backup, error.found)
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
