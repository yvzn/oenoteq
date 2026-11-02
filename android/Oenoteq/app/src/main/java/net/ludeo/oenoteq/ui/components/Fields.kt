package net.ludeo.oenoteq.ui.components

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.domain.NamedItem
import net.ludeo.oenoteq.domain.matching
import net.ludeo.oenoteq.domain.offersCreate

/**
 * Type-ahead over [items], with a "Create …" entry when the text matches no
 * name (ignoring case), as the PWA's `AutocompleteField`. Typing an existing
 * name exactly selects it; any other text clears the selection.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AutocompleteField(
    label: String,
    items: List<NamedItem>,
    selectedId: Long?,
    onSelect: (Long?) -> Unit,
    onCreate: (String) -> Unit,
    testTag: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    error: String? = null,
) {
    val selectedName = items.firstOrNull { it.id == selectedId }?.name
    var text by rememberSaveable { mutableStateOf(selectedName.orEmpty()) }
    var expanded by remember { mutableStateOf(false) }
    // A selection made elsewhere (prefilled form, freshly created entry) shows up in the field.
    LaunchedEffect(selectedName) { if (selectedName != null) text = selectedName }

    val options = if (text == selectedName) items else matching(text, items) { it.name }
    val canCreate = offersCreate(text, items.map { it.name })

    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }, modifier = modifier) {
        OutlinedTextField(
            value = text,
            onValueChange = { typed ->
                text = typed
                expanded = true
                onSelect(items.firstOrNull { it.name == typed.trim() }?.id)
            },
            label = { Text(label) },
            placeholder = placeholder?.let { { Text(it) } },
            isError = error != null,
            supportingText = error?.let { { Text(it, Modifier.testTag("$testTag-error")) } },
            singleLine = true,
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Words, imeAction = ImeAction.Next),
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier.fillMaxWidth().testTag(testTag)
                .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryEditable),
        )
        if (options.isNotEmpty() || canCreate) {
            ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                for (item in options) {
                    DropdownMenuItem(
                        text = { Text(item.name) },
                        onClick = {
                            text = item.name
                            expanded = false
                            onSelect(item.id)
                        },
                        modifier = Modifier.testTag("$testTag-option"),
                    )
                }
                if (canCreate) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.autocomplete_create, text.trim())) },
                        leadingIcon = { Icon(Icons.Outlined.Add, contentDescription = null) },
                        onClick = {
                            expanded = false
                            onCreate(text.trim())
                        },
                        modifier = Modifier.testTag("$testTag-create"),
                    )
                }
            }
        }
    }
}

/** A read-only pick list with an "any" first entry, for filters. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun <T> SelectField(
    label: String,
    anyLabel: String,
    options: List<T>,
    selected: T?,
    optionLabel: (T) -> String,
    onSelect: (T?) -> Unit,
    testTag: String,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = it }, modifier = modifier) {
        OutlinedTextField(
            value = selected?.let(optionLabel) ?: anyLabel,
            onValueChange = {},
            readOnly = true,
            label = { Text(label) },
            singleLine = true,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier.fillMaxWidth().testTag(testTag)
                .menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable),
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(
                text = { Text(anyLabel) },
                onClick = { expanded = false; onSelect(null) },
                modifier = Modifier.testTag("$testTag-any"),
            )
            for (option in options) {
                DropdownMenuItem(
                    text = { Text(optionLabel(option)) },
                    onClick = { expanded = false; onSelect(option) },
                    modifier = Modifier.testTag("$testTag-option"),
                )
            }
        }
    }
}
