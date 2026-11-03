package net.ludeo.oenoteq.ui.wine

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Remove
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.domain.MIN_INITIAL_QUANTITY
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.domain.WineColor
import net.ludeo.oenoteq.domain.WineFormError
import net.ludeo.oenoteq.domain.WineFormField
import net.ludeo.oenoteq.ui.LocalNotify
import net.ludeo.oenoteq.ui.Notice
import net.ludeo.oenoteq.ui.components.AutocompleteField
import net.ludeo.oenoteq.ui.components.ColorDot
import net.ludeo.oenoteq.ui.components.Loading
import net.ludeo.oenoteq.ui.components.ScreenScaffold
import net.ludeo.oenoteq.ui.components.StatusMessage
import net.ludeo.oenoteq.ui.components.label
import net.ludeo.oenoteq.ui.components.message

@Composable
fun WineFormScreen(
    editId: Long?,
    onBack: () -> Unit,
    onSaved: (Long) -> Unit,
    viewModel: WineFormViewModel = viewModel(factory = WineFormViewModel.factory(editId)),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val appellations by viewModel.appellationOptions.collectAsStateWithLifecycle()
    val producers by viewModel.producerOptions.collectAsStateWithLifecycle()

    val notify = LocalNotify.current
    LaunchedEffect(state.savedId) {
        val id = state.savedId ?: return@LaunchedEffect
        // The message outlives this screen: it shows on the Wine it lands on.
        notify(Notice(if (viewModel.isNew) R.string.notice_wine_added else R.string.notice_wine_updated, carried = true))
        onSaved(id)
    }

    ScreenScaffold(
        title = stringResource(if (viewModel.isNew) R.string.wine_add_title else R.string.wine_edit_title),
        onBack = onBack,
    ) { modifier ->
        when {
            state.loading -> Loading(modifier)
            state.missing -> StatusMessage(stringResource(R.string.wine_detail_not_found), modifier)
            else -> Column(
                modifier.imePadding().verticalScroll(rememberScrollState()).padding(16.dp).testTag("wine-form"),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                val fields = state.fields
                AutocompleteField(
                    label = stringResource(R.string.label_appellation),
                    placeholder = stringResource(R.string.wine_pick_or_create_appellation),
                    items = appellations,
                    selectedId = fields.appellationId,
                    onSelect = { id -> viewModel.edit { it.copy(appellationId = id) } },
                    onCreate = { viewModel.create(Referential.APPELLATION, it) },
                    error = fieldError(state, WineFormField.APPELLATION),
                    testTag = "appellation-field",
                )
                AutocompleteField(
                    label = stringResource(R.string.label_producer),
                    placeholder = stringResource(R.string.wine_pick_or_create_producer),
                    items = producers,
                    selectedId = fields.producerId,
                    onSelect = { id -> viewModel.edit { it.copy(producerId = id) } },
                    onCreate = { viewModel.create(Referential.PRODUCER, it) },
                    error = fieldError(state, WineFormField.PRODUCER),
                    testTag = "producer-field",
                )

                Text(stringResource(R.string.label_color), style = MaterialTheme.typography.labelLarge)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    for (color in WineColor.entries) {
                        FilterChip(
                            selected = fields.color == color,
                            onClick = { viewModel.edit { it.copy(color = color) } },
                            label = { Text(stringResource(color.label())) },
                            leadingIcon = { ColorDot(color) },
                            modifier = Modifier.testTag("color-${color.code}"),
                        )
                    }
                }
                fieldError(state, WineFormField.COLOR)?.let { ErrorText(it, "color-error") }

                YearField(
                    label = stringResource(R.string.label_millesime),
                    value = fields.millesime,
                    onChange = { v -> viewModel.edit { it.copy(millesime = v) } },
                    error = fieldError(state, WineFormField.MILLESIME),
                    placeholder = stringResource(R.string.no_millesime),
                    testTag = "millesime-input",
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    var startFocused by remember { mutableStateOf(false) }
                    YearField(
                        label = stringResource(R.string.wine_garde_start),
                        value = fields.gardeDebut,
                        onChange = { v -> viewModel.edit { it.copy(gardeDebut = v) } },
                        error = fieldError(state, WineFormField.GARDE_DEBUT),
                        testTag = "garde-debut-input",
                        modifier = Modifier.weight(1f).onFocusChanged {
                            if (startFocused && !it.isFocused) viewModel.gardeDebutDone()
                            startFocused = it.isFocused
                        },
                    )
                    YearField(
                        label = stringResource(R.string.wine_garde_end),
                        value = fields.gardeFin,
                        onChange = { v -> viewModel.edit { it.copy(gardeFin = v) } },
                        error = fieldError(state, WineFormField.GARDE_FIN),
                        testTag = "garde-fin-input",
                        modifier = Modifier.weight(1f),
                    )
                }

                if (viewModel.isNew) {
                    QuantityStepper(
                        value = fields.quantity,
                        onChange = { v -> viewModel.edit { it.copy(quantity = v) } },
                        error = fieldError(state, WineFormField.QUANTITY),
                    )
                }

                state.saveError?.let { ErrorText(stringResource(it.message()), "wine-save-error") }
                Button(
                    onClick = viewModel::save,
                    enabled = !state.saving,
                    modifier = Modifier.align(Alignment.End).testTag("wine-save"),
                ) {
                    Text(stringResource(if (viewModel.isNew) R.string.wine_submit_add else R.string.wine_submit_edit))
                }
            }
        }
    }
}

@Composable
private fun fieldError(state: WineFormState, field: WineFormField): String? {
    state.errors[field]?.let { return errorText(it) }
    return state.refusals[field]?.let { stringResource(it.message()) }
}

@Composable
private fun errorText(error: WineFormError): String = when (error) {
    WineFormError.APPELLATION_REQUIRED -> stringResource(R.string.wine_error_appellation_required)
    WineFormError.PRODUCER_REQUIRED -> stringResource(R.string.wine_error_producer_required)
    WineFormError.COLOR_REQUIRED -> stringResource(R.string.wine_error_color_required)
    WineFormError.GARDE_END_BEFORE_START -> stringResource(R.string.wine_error_garde_end_before_start)
    WineFormError.QUANTITY_MIN -> stringResource(R.string.wine_error_quantity_min, MIN_INITIAL_QUANTITY)
    WineFormError.NOT_A_YEAR -> stringResource(R.string.wine_error_not_a_year)
}

@Composable
private fun ErrorText(text: String, testTag: String) {
    Text(
        text,
        color = MaterialTheme.colorScheme.error,
        style = MaterialTheme.typography.bodySmall,
        modifier = Modifier.testTag(testTag),
    )
}

@Composable
private fun YearField(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    error: String?,
    testTag: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        placeholder = placeholder?.let { { Text(it) } },
        isError = error != null,
        supportingText = error?.let { { Text(it) } },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = modifier.testTag(testTag),
    )
}

@Composable
private fun QuantityStepper(value: String, onChange: (String) -> Unit, error: String?) {
    val quantity = value.trim().toIntOrNull()
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        IconButton(
            onClick = { onChange(((quantity ?: MIN_INITIAL_QUANTITY) - 1).coerceAtLeast(MIN_INITIAL_QUANTITY).toString()) },
            modifier = Modifier.testTag("quantity-decrement"),
        ) { Icon(Icons.Outlined.Remove, stringResource(R.string.stepper_decrease)) }
        OutlinedTextField(
            value = value,
            onValueChange = onChange,
            label = { Text(stringResource(R.string.wine_initial_quantity)) },
            isError = error != null,
            supportingText = error?.let { { Text(it) } },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.width(180.dp).testTag("quantity-input"),
        )
        IconButton(
            onClick = { onChange(((quantity ?: 0) + 1).coerceAtLeast(MIN_INITIAL_QUANTITY).toString()) },
            modifier = Modifier.testTag("quantity-increment"),
        ) { Icon(Icons.Outlined.Add, stringResource(R.string.stepper_increase)) }
    }
}
