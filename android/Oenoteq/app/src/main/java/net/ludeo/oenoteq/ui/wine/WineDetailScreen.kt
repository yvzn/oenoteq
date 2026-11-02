package net.ludeo.oenoteq.ui.wine

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.data.ConsumptionEntity
import net.ludeo.oenoteq.data.WineWithNames
import net.ludeo.oenoteq.domain.CellarError
import net.ludeo.oenoteq.domain.WineColor
import net.ludeo.oenoteq.ui.components.ColorRail
import net.ludeo.oenoteq.ui.components.ConfirmDialog
import net.ludeo.oenoteq.ui.components.DateField
import net.ludeo.oenoteq.ui.components.GardeStatusBadge
import net.ludeo.oenoteq.ui.components.Loading
import net.ludeo.oenoteq.ui.components.RatingField
import net.ludeo.oenoteq.ui.components.ScreenScaffold
import net.ludeo.oenoteq.ui.components.StatusMessage
import net.ludeo.oenoteq.ui.components.formatDate
import net.ludeo.oenoteq.ui.components.label
import net.ludeo.oenoteq.ui.components.message
import net.ludeo.oenoteq.ui.components.millesimeText

/** Everything about one Wine: fields, Garde Status, suggested Meals, Consumptions, stock correction. */
@Composable
fun WineDetailScreen(
    id: Long,
    onBack: () -> Unit,
    onEdit: (Long) -> Unit,
    onEditPairings: (appellationId: Long, color: WineColor) -> Unit,
    viewModel: WineDetailViewModel = viewModel(factory = WineDetailViewModel.factory(id)),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val adjustResult by viewModel.adjustResult.collectAsStateWithLifecycle()
    val wine = state.wine
    val editing = state.editing

    ScreenScaffold(
        title = wine?.producerName.orEmpty(),
        onBack = onBack,
        actions = {
            if (wine != null) {
                IconButton(onClick = { onEdit(wine.id) }, modifier = Modifier.testTag("edit-wine")) {
                    Icon(Icons.Outlined.Edit, stringResource(R.string.action_edit))
                }
            }
        },
    ) { modifier ->
        when {
            state.loading -> Loading(modifier)
            wine == null -> StatusMessage(stringResource(R.string.wine_detail_not_found), modifier)
            else -> Column(
                modifier.imePadding().verticalScroll(rememberScrollState()).padding(20.dp).testTag("wine-detail"),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                WineHeader(wine, state, onAdjust = viewModel::openAdjust)
                HorizontalDivider(Modifier.padding(vertical = 8.dp))
                SuggestedMeals(state, onEditPairings = { onEditPairings(wine.appellationId, wine.color) })
                HorizontalDivider(Modifier.padding(vertical = 8.dp))
                Consumptions(state, viewModel)
                HorizontalDivider(Modifier.padding(vertical = 8.dp))
                RecordConsumption(wine, editing, viewModel)
            }
        }
    }

    editing.confirmingDelete?.let { consumption ->
        ConfirmDialog(
            message = stringResource(R.string.consumption_delete_confirm, formatDate(consumption.date)),
            confirmLabel = stringResource(R.string.action_delete),
            onConfirm = viewModel::confirmDelete,
            onDismiss = viewModel::cancelDelete,
        )
    }
    if (editing.adjusting && wine != null) {
        AdjustQuantityDialog(wine.quantity, editing, adjustResult, viewModel)
    }
}

@Composable
private fun WineHeader(wine: WineWithNames, state: WineDetailState, onAdjust: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        ColorRail(wine.color, height = 40.dp)
        Text(
            wine.producerName,
            style = MaterialTheme.typography.headlineMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.testTag("wine-producer"),
        )
    }
    Text(
        listOf(stringResource(wine.color.label()), wine.appellationName, millesimeText(wine.millesime))
            .joinToString(" · "),
        style = MaterialTheme.typography.bodyLarge,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.testTag("wine-summary"),
    )
    if (wine.gardeDebut != null || wine.gardeFin != null) {
        Text(
            stringResource(
                R.string.wine_detail_garde_window,
                stringResource(R.string.label_garde_window),
                wine.gardeDebut?.toString().orEmpty(),
                wine.gardeFin?.toString().orEmpty(),
            ),
            style = MaterialTheme.typography.bodyLarge,
            modifier = Modifier.testTag("wine-garde"),
        )
    }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        GardeStatusBadge(state.gardeStatus, Modifier.testTag("wine-status"))
        // The quantity opens the stock correction, as in the PWA.
        TextButton(onClick = onAdjust, modifier = Modifier.testTag("quantity-adjust")) {
            Text(
                stringResource(R.string.quantity_short, wine.quantity),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.testTag("wine-quantity"),
            )
        }
    }
}

@Composable
private fun SuggestedMeals(state: WineDetailState, onEditPairings: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        SectionTitle(R.string.wine_detail_suggested_meals, Modifier.weight(1f))
        TextButton(onClick = onEditPairings, modifier = Modifier.testTag("edit-pairings")) {
            Text(stringResource(R.string.wine_detail_manage_pairings))
        }
    }
    if (state.suggestedMeals.isEmpty()) {
        Muted(stringResource(R.string.wine_detail_no_suggestions))
    } else {
        for (meal in state.suggestedMeals) {
            Text("• ${meal.name}", Modifier.testTag("suggested-meal"))
        }
    }
}

@Composable
private fun Consumptions(state: WineDetailState, viewModel: WineDetailViewModel) {
    val editing = state.editing
    SectionTitle(R.string.wine_detail_history)
    editing.deleteError?.let { ErrorLine(it, "consumption-delete-error") }
    if (state.consumptions.isEmpty()) {
        Muted(stringResource(R.string.wine_detail_no_history))
    }
    for (consumption in state.consumptions) {
        if (editing.editingId == consumption.id) {
            ConsumptionForm(
                draft = editing.edit,
                onChange = viewModel::editConsumption,
                error = editing.editError,
                testTag = "consumption-edit",
            ) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    TextButton(onClick = viewModel::cancelEdit) { Text(stringResource(R.string.action_cancel)) }
                    Button(
                        onClick = viewModel::saveEdit,
                        enabled = !editing.busy,
                        modifier = Modifier.testTag("consumption-edit-save"),
                    ) { Text(stringResource(R.string.action_save)) }
                }
            }
        } else {
            ConsumptionRow(consumption, onEdit = { viewModel.startEdit(consumption) }, onDelete = { viewModel.askDelete(consumption) })
        }
    }
}

@Composable
private fun ConsumptionRow(consumption: ConsumptionEntity, onEdit: () -> Unit, onDelete: () -> Unit) {
    Row(Modifier.fillMaxWidth().testTag("consumption-entry"), verticalAlignment = Alignment.Top) {
        Column(Modifier.weight(1f).padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(formatDate(consumption.date), fontWeight = FontWeight.SemiBold)
            consumption.rating?.let { Text(stringResource(R.string.consumption_rating_line, it)) }
            consumption.notes?.let { Muted(it) }
        }
        IconButton(onClick = onEdit, modifier = Modifier.testTag("consumption-edit-${consumption.id}")) {
            Icon(Icons.Outlined.Edit, stringResource(R.string.action_edit))
        }
        IconButton(onClick = onDelete, modifier = Modifier.testTag("consumption-delete-${consumption.id}")) {
            Icon(Icons.Outlined.Delete, stringResource(R.string.action_delete))
        }
    }
}

@Composable
private fun RecordConsumption(wine: WineWithNames, editing: WineDetailEditing, viewModel: WineDetailViewModel) {
    SectionTitle(R.string.consumption_record)
    if (wine.quantity <= 0) {
        Muted(stringResource(R.string.consumption_blocked), Modifier.testTag("consumption-blocked"))
        return
    }
    ConsumptionForm(
        draft = editing.record,
        onChange = viewModel::editRecord,
        error = editing.recordError,
        testTag = "consumption-record",
    ) {
        Button(
            onClick = viewModel::record,
            enabled = !editing.busy,
            modifier = Modifier.fillMaxWidth().testTag("consumption-record-submit"),
        ) { Text(stringResource(R.string.consumption_record_submit)) }
    }
}

@Composable
private fun ConsumptionForm(
    draft: ConsumptionDraft,
    onChange: (ConsumptionDraft) -> Unit,
    error: CellarError.Code?,
    testTag: String,
    actions: @Composable () -> Unit,
) {
    Column(Modifier.fillMaxWidth().testTag(testTag), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        DateField(draft.date, { onChange(draft.copy(date = it)) }, testTag = "$testTag-date", modifier = Modifier.fillMaxWidth())
        Text(stringResource(R.string.consumption_rating), style = MaterialTheme.typography.labelLarge)
        RatingField(draft.rating, { onChange(draft.copy(rating = it)) }, testTag = "$testTag-rating")
        OutlinedTextField(
            value = draft.notes,
            onValueChange = { onChange(draft.copy(notes = it)) },
            label = { Text(stringResource(R.string.consumption_notes)) },
            minLines = 2,
            modifier = Modifier.fillMaxWidth().testTag("$testTag-notes"),
        )
        error?.let { ErrorLine(it, "$testTag-error") }
        actions()
    }
}

@Composable
private fun AdjustQuantityDialog(quantity: Int, editing: WineDetailEditing, result: Int?, viewModel: WineDetailViewModel) {
    AlertDialog(
        onDismissRequest = viewModel::closeAdjust,
        title = { Text(stringResource(R.string.adjust_title)) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = editing.adjustText,
                    onValueChange = viewModel::editAdjust,
                    label = { Text(stringResource(R.string.adjust_by)) },
                    placeholder = { Text(stringResource(R.string.adjust_placeholder)) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                    modifier = Modifier.testTag("adjust-input"),
                )
                Text(
                    if (result == null) stringResource(R.string.adjust_current, quantity)
                    else stringResource(R.string.adjust_change, quantity, result),
                    modifier = Modifier.testTag("adjust-preview"),
                )
                editing.adjustError?.let { ErrorLine(it, "adjust-error") }
            }
        },
        confirmButton = {
            TextButton(
                onClick = viewModel::adjust,
                enabled = result != null && !editing.busy,
                modifier = Modifier.testTag("adjust-submit"),
            ) { Text(stringResource(R.string.adjust_submit)) }
        },
        dismissButton = {
            TextButton(onClick = viewModel::closeAdjust) { Text(stringResource(R.string.action_cancel)) }
        },
    )
}

@Composable
private fun SectionTitle(text: Int, modifier: Modifier = Modifier) {
    Text(stringResource(text), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, modifier = modifier)
}

@Composable
private fun Muted(text: String, modifier: Modifier = Modifier) {
    Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = modifier)
}

@Composable
private fun ErrorLine(code: CellarError.Code, testTag: String) {
    Text(
        stringResource(code.message()),
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodySmall,
        modifier = Modifier.testTag(testTag),
    )
}
