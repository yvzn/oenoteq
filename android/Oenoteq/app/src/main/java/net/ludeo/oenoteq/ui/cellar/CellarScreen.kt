package net.ludeo.oenoteq.ui.cellar

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.domain.Page
import net.ludeo.oenoteq.domain.SortBy
import net.ludeo.oenoteq.domain.WineSort
import net.ludeo.oenoteq.domain.WineListItem
import net.ludeo.oenoteq.ui.components.ColorRail
import net.ludeo.oenoteq.ui.components.FilterBar
import net.ludeo.oenoteq.ui.components.FiltersSheet
import net.ludeo.oenoteq.ui.components.Pagination
import net.ludeo.oenoteq.ui.components.SortSheet
import net.ludeo.oenoteq.ui.components.rememberFromTop
import net.ludeo.oenoteq.ui.components.GardeStatusBadge
import net.ludeo.oenoteq.ui.components.LanguageToggle
import net.ludeo.oenoteq.ui.components.Loading
import net.ludeo.oenoteq.ui.components.ScreenScaffold
import net.ludeo.oenoteq.ui.components.StatusMessage
import net.ludeo.oenoteq.ui.components.label
import net.ludeo.oenoteq.ui.components.millesimeText

@Composable
fun CellarScreen(
    onAddWine: () -> Unit,
    onOpenWine: (Long) -> Unit,
    viewModel: CellarViewModel = viewModel(factory = CellarViewModel.Factory),
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    // Saved with this destination, so coming back from a Wine lands on the same row.
    val listState = rememberLazyListState()
    val fromTop = rememberFromTop(listState, state.page)
    var filtersOpen by rememberSaveable { mutableStateOf(false) }
    var sortOpen by rememberSaveable { mutableStateOf(false) }
    // SQLite snapshots carry no reliable MIME type across file providers, so any file can be picked.
    val pickSnapshot = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) viewModel.importSnapshot(uri)
    }
    val hasList = !state.loading && state.page.total > 0

    ScreenScaffold(
        title = if (hasList) pluralStringResource(R.plurals.cellar_count, state.page.total, state.page.total)
        else stringResource(R.string.nav_cellar),
        actions = { LanguageToggle() },
        floatingActionButton = {
            if (hasList || state.filters.activeCount > 0) {
                ExtendedFloatingActionButton(
                    onClick = onAddWine,
                    icon = { Icon(Icons.Outlined.Add, contentDescription = null) },
                    text = { Text(stringResource(R.string.cellar_add)) },
                    modifier = Modifier.testTag("add-wine"),
                )
            }
        },
    ) { modifier ->
        when {
            state.loading -> Loading(modifier)
            state.importState == ImportState.Running -> ImportRunning(modifier)
            state.page.total == 0 && state.filters.activeCount == 0 -> EmptyCellar(
                onAddWine = onAddWine,
                onImport = if (state.databaseIsEmpty) ({ pickSnapshot.launch(arrayOf("*/*")) }) else null,
                modifier = modifier,
            )
            else -> Column(modifier.fillMaxSize()) {
                FilterBar(
                    filters = state.filters,
                    sortLabel = state.sort.sortBy.label(),
                    sortDir = state.sort.sortDir,
                    onOpenFilters = { filtersOpen = true },
                    onOpenSort = { sortOpen = true },
                    onClear = { fromTop(viewModel::clearFilters) },
                )
                if (state.page.total == 0) {
                    StatusMessage(stringResource(R.string.cellar_no_match), Modifier.testTag("cellar-no-match"))
                } else {
                    WineList(
                        page = state.page,
                        listState = listState,
                        onOpenWine = onOpenWine,
                        onGoToPage = { page -> fromTop { viewModel.goToPage(page) } },
                    )
                }
            }
        }
    }

    if (filtersOpen) {
        FiltersSheet(
            filters = state.filters,
            appellations = state.appellations,
            meals = state.meals,
            showReadyNow = true,
            onChange = { next -> fromTop { viewModel.updateFilters(next) } },
            onClear = { fromTop(viewModel::clearFilters) },
            onDismiss = { filtersOpen = false },
        )
    }
    if (sortOpen) {
        SortSheet(
            axes = SortBy.entries,
            sortBy = state.sort.sortBy,
            sortDir = state.sort.sortDir,
            axisLabel = { it.label() },
            axisTag = { it.name.lowercase() },
            onChange = { axis, dir -> fromTop { viewModel.updateSort(WineSort(axis, dir)) } },
            onDismiss = { sortOpen = false },
        )
    }

    when (val import = state.importState) {
        is ImportState.Done -> ImportDoneDialog(import.summary, viewModel::dismissImportResult)
        is ImportState.Failed -> ImportFailedDialog(import.error, viewModel::dismissImportResult)
        else -> Unit
    }
}

@Composable
private fun WineList(
    page: Page<WineListItem>,
    listState: LazyListState,
    onOpenWine: (Long) -> Unit,
    onGoToPage: (Int) -> Unit,
) {
    // Room under the FAB for the last row and the pager.
    LazyColumn(state = listState, contentPadding = PaddingValues(bottom = 88.dp), modifier = Modifier.testTag("wine-list")) {
        items(page.items, key = { it.id }) { wine ->
            WineRow(wine, onClick = { onOpenWine(wine.id) })
            HorizontalDivider()
        }
        if (page.pageCount > 1) {
            item(key = "pagination") { Pagination(page, onGoToPage) }
        }
    }
}

@Composable
private fun WineRow(wine: WineListItem, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 12.dp)
            .testTag("wine-item"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        ColorRail(wine.color)
        Column(Modifier.weight(1f)) {
            Text(
                wine.producerName,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.testTag("wine-item-producer"),
            )
            Text(
                "${stringResource(wine.color.label())} · ${wine.appellationName}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Row(
                Modifier.padding(top = 4.dp),
                horizontalArrangement = Arrangement.spacedBy(14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(millesimeText(wine.millesime), style = MaterialTheme.typography.bodyMedium)
                Text(stringResource(R.string.quantity_short, wine.quantity), style = MaterialTheme.typography.bodyMedium)
                GardeStatusBadge(wine.gardeStatus)
            }
        }
    }
}
