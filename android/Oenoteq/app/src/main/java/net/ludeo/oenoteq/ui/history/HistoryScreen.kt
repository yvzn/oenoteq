package net.ludeo.oenoteq.ui.history

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material3.HorizontalDivider
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
import net.ludeo.oenoteq.domain.HistoryEntry
import net.ludeo.oenoteq.domain.HistorySort
import net.ludeo.oenoteq.domain.HistorySortBy
import net.ludeo.oenoteq.ui.components.ColorRail
import net.ludeo.oenoteq.ui.components.FilterBar
import net.ludeo.oenoteq.ui.components.FiltersSheet
import net.ludeo.oenoteq.ui.components.LanguageToggle
import net.ludeo.oenoteq.ui.components.Loading
import net.ludeo.oenoteq.ui.components.Pagination
import net.ludeo.oenoteq.ui.components.ScreenScaffold
import net.ludeo.oenoteq.ui.components.SortSheet
import net.ludeo.oenoteq.ui.components.StatusMessage
import net.ludeo.oenoteq.ui.components.formatDate
import net.ludeo.oenoteq.ui.components.label
import net.ludeo.oenoteq.ui.components.millesimeText
import net.ludeo.oenoteq.ui.components.rememberFromTop

/** Every Consumption across all Wines, Wines at quantity 0 included; a row opens its Wine. */
@Composable
fun HistoryScreen(onOpenWine: (Long) -> Unit, viewModel: HistoryViewModel = viewModel(factory = HistoryViewModel.Factory)) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()
    val fromTop = rememberFromTop(listState, state.page)
    var filtersOpen by rememberSaveable { mutableStateOf(false) }
    var sortOpen by rememberSaveable { mutableStateOf(false) }

    ScreenScaffold(
        title = if (!state.loading && state.page.total > 0) {
            pluralStringResource(R.plurals.history_count, state.page.total, state.page.total)
        } else {
            stringResource(R.string.nav_history)
        },
        actions = { LanguageToggle() },
    ) { modifier ->
        when {
            state.loading -> Loading(modifier)
            state.isEmpty -> StatusMessage(stringResource(R.string.history_empty), modifier.testTag("history-empty"))
            else -> Column(modifier.fillMaxSize().testTag("history-screen")) {
                FilterBar(
                    filters = state.filters,
                    sortLabel = state.sort.sortBy.label(),
                    sortDir = state.sort.sortDir,
                    onOpenFilters = { filtersOpen = true },
                    onOpenSort = { sortOpen = true },
                    onClear = { fromTop(viewModel::clearFilters) },
                )
                if (state.page.total == 0) {
                    StatusMessage(stringResource(R.string.history_no_match), Modifier.testTag("history-no-match"))
                } else {
                    LazyColumn(state = listState, modifier = Modifier.testTag("history-list")) {
                        items(state.page.items, key = { it.id }) { entry ->
                            HistoryRow(entry, onClick = { onOpenWine(entry.wineId) })
                            HorizontalDivider()
                        }
                        if (state.page.pageCount > 1) {
                            item(key = "pagination") {
                                Pagination(state.page) { page -> fromTop { viewModel.goToPage(page) } }
                            }
                        }
                    }
                }
            }
        }
    }

    if (filtersOpen) {
        FiltersSheet(
            filters = state.filters,
            appellations = state.appellations,
            meals = state.meals,
            showReadyNow = false,
            count = viewModel::count,
            showLabel = { pluralStringResource(R.plurals.filters_show_consumptions, it, it) },
            onApply = { next -> fromTop { viewModel.updateFilters(next) } },
            onDismiss = { filtersOpen = false },
        )
    }
    if (sortOpen) {
        SortSheet(
            axes = HistorySortBy.entries,
            sortBy = state.sort.sortBy,
            sortDir = state.sort.sortDir,
            axisLabel = { it.label() },
            axisTag = { it.name.lowercase() },
            onChange = { axis, dir -> fromTop { viewModel.updateSort(HistorySort(axis, dir)) } },
            onDismiss = { sortOpen = false },
        )
    }
}

@Composable
private fun HistoryRow(entry: HistoryEntry, onClick: () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 12.dp)
            .testTag("history-item"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        ColorRail(entry.color)
        Column(Modifier.weight(1f)) {
            Text(
                entry.producerName,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.testTag("history-item-producer"),
            )
            Text(
                "${stringResource(entry.color.label())} · ${entry.appellationName}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                "${millesimeText(entry.millesime)} · ${formatDate(entry.date)}",
                style = MaterialTheme.typography.bodyMedium,
                modifier = Modifier.padding(top = 4.dp).testTag("history-item-meta"),
            )
        }
    }
}
