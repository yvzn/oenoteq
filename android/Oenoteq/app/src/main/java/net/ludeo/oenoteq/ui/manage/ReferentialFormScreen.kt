package net.ludeo.oenoteq.ui.manage

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.toRoute
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.data.ReferentialRepository
import net.ludeo.oenoteq.domain.CellarError
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.ui.ReferentialEditRoute
import net.ludeo.oenoteq.ui.ReferentialNewRoute
import net.ludeo.oenoteq.ui.components.Loading
import net.ludeo.oenoteq.ui.components.ScreenScaffold
import net.ludeo.oenoteq.ui.components.StatusMessage
import net.ludeo.oenoteq.ui.components.message
import net.ludeo.oenoteq.ui.components.texts
import net.ludeo.oenoteq.ui.container

data class ReferentialFormState(
    val loading: Boolean,
    val name: String = "",
    val error: CellarError.Code? = null,
    val saving: Boolean = false,
    val saved: Boolean = false,
    val missing: Boolean = false,
)

/** Adds a name, or renames the row [id] points at. */
class ReferentialFormViewModel(private val repository: ReferentialRepository, val id: Long?) : ViewModel() {
    val kind: Referential = repository.kind
    val notFound: CellarError.Code = repository.notFound
    private val mutableState = MutableStateFlow(ReferentialFormState(loading = id != null))
    val state: StateFlow<ReferentialFormState> = mutableState.asStateFlow()

    init {
        if (id != null) {
            viewModelScope.launch {
                val item = repository.find(id)
                mutableState.value = ReferentialFormState(loading = false, name = item?.name.orEmpty(), missing = item == null)
            }
        }
    }

    fun edit(name: String) = mutableState.update { it.copy(name = name, error = null) }

    fun save() {
        val current = mutableState.value
        if (current.saving) return
        mutableState.value = current.copy(saving = true, error = null)
        viewModelScope.launch {
            mutableState.value = try {
                if (id == null) repository.create(current.name) else repository.rename(id, current.name)
                mutableState.value.copy(saving = false, saved = true)
            } catch (e: CellarError) {
                mutableState.value.copy(saving = false, error = e.code)
            }
        }
    }

    companion object {
        val Factory = viewModelFactory {
            initializer {
                val handle = createSavedStateHandle()
                val (kind, id) = if (handle.contains("id")) {
                    handle.toRoute<ReferentialEditRoute>().let { it.kind to it.id }
                } else {
                    handle.toRoute<ReferentialNewRoute>().kind to null
                }
                ReferentialFormViewModel(container.referentials(kind), id)
            }
        }
    }
}

@Composable
fun ReferentialFormScreen(
    onBack: () -> Unit,
    viewModel: ReferentialFormViewModel = viewModel(factory = ReferentialFormViewModel.Factory),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val texts = viewModel.kind.texts
    val isNew = viewModel.id == null

    LaunchedEffect(state.saved) { if (state.saved) onBack() }

    ScreenScaffold(title = stringResource(if (isNew) texts.add else texts.renameTitle), onBack = onBack) { modifier ->
        when {
            state.loading -> Loading(modifier)
            state.missing -> StatusMessage(stringResource(viewModel.notFound.message()), modifier)
            else -> Column(modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                OutlinedTextField(
                    value = state.name,
                    onValueChange = viewModel::edit,
                    label = { Text(stringResource(R.string.manage_name)) },
                    isError = state.error != null,
                    supportingText = state.error?.let { { Text(stringResource(it.message()), Modifier.testTag("name-error")) } },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        capitalization = KeyboardCapitalization.Sentences,
                        imeAction = ImeAction.Done,
                    ),
                    keyboardActions = KeyboardActions(onDone = { viewModel.save() }),
                    modifier = Modifier.fillMaxWidth().testTag("name-input"),
                )
                Button(
                    onClick = viewModel::save,
                    enabled = !state.saving,
                    modifier = Modifier.align(Alignment.End).testTag("name-save"),
                ) {
                    Text(stringResource(if (isNew) texts.add else R.string.manage_save_changes))
                }
            }
        }
    }
}
