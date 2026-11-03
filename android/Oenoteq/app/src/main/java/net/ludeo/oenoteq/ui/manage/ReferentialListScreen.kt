package net.ludeo.oenoteq.ui.manage

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Delete
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.toRoute
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.data.ReferentialRepository
import net.ludeo.oenoteq.domain.CellarError
import net.ludeo.oenoteq.domain.NamedItem
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.ui.CollectNotices
import net.ludeo.oenoteq.ui.Notice
import net.ludeo.oenoteq.ui.ReferentialListRoute
import net.ludeo.oenoteq.ui.attempt
import net.ludeo.oenoteq.ui.components.ConfirmDialog
import net.ludeo.oenoteq.ui.components.Loading
import net.ludeo.oenoteq.ui.components.ScreenScaffold
import net.ludeo.oenoteq.ui.components.StatusMessage
import net.ludeo.oenoteq.ui.components.message
import net.ludeo.oenoteq.ui.components.texts
import net.ludeo.oenoteq.ui.container

data class ReferentialListState(
    val loading: Boolean = true,
    val items: List<NamedItem> = emptyList(),
    val confirming: NamedItem? = null,
    val deleteError: CellarError.Code? = null,
)

class ReferentialListViewModel(private val repository: ReferentialRepository) : ViewModel() {
    val kind: Referential = repository.kind
    private val confirming = MutableStateFlow<NamedItem?>(null)
    private val deleteError = MutableStateFlow<CellarError.Code?>(null)
    private val noticeChannel = Channel<Notice>(Channel.BUFFERED)
    val notices: Flow<Notice> = noticeChannel.receiveAsFlow()

    val state: StateFlow<ReferentialListState> = combine(repository.observeAll(), confirming, deleteError) { items, c, e ->
        ReferentialListState(loading = false, items = items, confirming = c, deleteError = e)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), ReferentialListState())

    fun askDelete(item: NamedItem) {
        deleteError.value = null
        confirming.value = item
    }

    fun cancelDelete() {
        confirming.value = null
    }

    fun confirmDelete() {
        val item = confirming.value ?: return
        confirming.value = null
        viewModelScope.launch {
            val refusal = attempt { repository.delete(item.id) }
            if (refusal == null) noticeChannel.send(Notice(R.string.notice_deleted, item.name)) else deleteError.value = refusal
        }
    }

    companion object {
        val Factory = viewModelFactory {
            initializer {
                val route = createSavedStateHandle().toRoute<ReferentialListRoute>()
                ReferentialListViewModel(container.referentials(route.kind))
            }
        }
    }
}

@Composable
fun ReferentialListScreen(
    onBack: () -> Unit,
    onAdd: (Referential) -> Unit,
    onRename: (Referential, Long) -> Unit,
    viewModel: ReferentialListViewModel = viewModel(factory = ReferentialListViewModel.Factory),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val texts = viewModel.kind.texts
    CollectNotices(viewModel.notices)

    ScreenScaffold(
        title = stringResource(texts.label),
        onBack = onBack,
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { onAdd(viewModel.kind) },
                // Bordeaux like the app's other main actions; pink marks what is selected.
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = MaterialTheme.colorScheme.onPrimary,
                icon = { Icon(Icons.Outlined.Add, contentDescription = null) },
                text = { Text(stringResource(texts.add)) },
                modifier = Modifier.testTag("referential-add"),
            )
        },
    ) { modifier ->
        Column(modifier.fillMaxSize()) {
            state.deleteError?.let {
                Text(
                    stringResource(it.message()),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.padding(16.dp).testTag("referential-error"),
                )
            }
            when {
                state.loading -> Loading()
                state.items.isEmpty() -> StatusMessage(stringResource(texts.empty))
                else -> LazyColumn(Modifier.testTag("referential-list")) {
                    items(state.items, key = { it.id }) { item ->
                        ListItem(
                            headlineContent = { Text(item.name) },
                            modifier = Modifier.testTag("referential-item"),
                            // On the page's parchment, like the cellar and history rows.
                            colors = ListItemDefaults.colors(containerColor = Color.Transparent),
                            trailingContent = {
                                Row {
                                    IconButton(
                                        onClick = { onRename(viewModel.kind, item.id) },
                                        modifier = Modifier.testTag("referential-rename-${item.name}"),
                                    ) { Icon(Icons.Outlined.Edit, stringResource(R.string.manage_rename)) }
                                    IconButton(
                                        onClick = { viewModel.askDelete(item) },
                                        modifier = Modifier.testTag("referential-delete-${item.name}"),
                                    ) { Icon(Icons.Outlined.Delete, stringResource(R.string.action_delete)) }
                                }
                            },
                        )
                        HorizontalDivider()
                    }
                }
            }
        }
    }

    state.confirming?.let { item ->
        ConfirmDialog(
            message = stringResource(texts.deleteConfirm, item.name),
            confirmLabel = stringResource(R.string.action_delete),
            onConfirm = viewModel::confirmDelete,
            onDismiss = viewModel::cancelDelete,
        )
    }
}
