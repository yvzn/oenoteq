package net.ludeo.oenoteq.ui.components

import androidx.annotation.StringRes
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Sort
import androidx.compose.material.icons.outlined.FilterList
import androidx.compose.material3.AssistChip
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.RadioButton
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.domain.NamedItem
import net.ludeo.oenoteq.domain.Page
import net.ludeo.oenoteq.domain.SearchFilters
import net.ludeo.oenoteq.domain.SortDir
import net.ludeo.oenoteq.domain.WineColor

// The PWA's FilterBar on a phone, shared by the cellar list and the Consumption History.

/** One chip opens the filters, one the sort, plus "clear" while filtered. */
@Composable
fun FilterBar(
    filters: SearchFilters,
    @StringRes sortLabel: Int,
    sortDir: SortDir,
    onOpenFilters: () -> Unit,
    onOpenSort: () -> Unit,
    onClear: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        FilterChip(
            selected = filters.activeCount > 0,
            onClick = onOpenFilters,
            label = {
                Text(
                    if (filters.activeCount > 0) stringResource(R.string.filters_title_count, filters.activeCount)
                    else stringResource(R.string.filters_title),
                )
            },
            leadingIcon = { Icon(Icons.Outlined.FilterList, contentDescription = null) },
            modifier = Modifier.testTag("open-filters"),
        )
        AssistChip(
            onClick = onOpenSort,
            label = { Text("${stringResource(sortLabel)} ${if (sortDir == SortDir.ASC) "↑" else "↓"}") },
            leadingIcon = { Icon(Icons.AutoMirrored.Outlined.Sort, contentDescription = stringResource(R.string.sort_title)) },
            modifier = Modifier.testTag("open-sort"),
        )
        if (filters.activeCount > 0) {
            TextButton(onClick = onClear, modifier = Modifier.testTag("clear-filters")) {
                Text(stringResource(R.string.filters_clear))
            }
        }
    }
}

/** Changes apply at once; the list behind the sheet follows. "Ready now" is the cellar's own extra. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FiltersSheet(
    filters: SearchFilters,
    appellations: List<NamedItem>,
    meals: List<NamedItem>,
    showReadyNow: Boolean,
    onChange: (SearchFilters) -> Unit,
    onClear: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss, modifier = Modifier.testTag("filters-sheet")) {
        Column(Modifier.padding(start = 20.dp, end = 20.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(stringResource(R.string.filters_title), style = MaterialTheme.typography.titleLarge)
            SelectField(
                label = stringResource(R.string.label_meal),
                anyLabel = stringResource(R.string.filters_any_meal),
                options = meals,
                selected = meals.firstOrNull { it.id == filters.mealId },
                optionLabel = { it.name },
                onSelect = { onChange(filters.copy(mealId = it?.id)) },
                testTag = "filter-meal",
            )
            SelectField(
                label = stringResource(R.string.label_appellation),
                anyLabel = stringResource(R.string.filters_any_appellation),
                options = appellations,
                selected = appellations.firstOrNull { it.id == filters.appellationId },
                optionLabel = { it.name },
                onSelect = { onChange(filters.copy(appellationId = it?.id)) },
                testTag = "filter-appellation",
            )
            Text(stringResource(R.string.label_color), style = MaterialTheme.typography.labelLarge)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(
                    selected = filters.color == null,
                    onClick = { onChange(filters.copy(color = null)) },
                    label = { Text(stringResource(R.string.filters_any_color)) },
                    modifier = Modifier.testTag("filter-color-any"),
                )
                for (color in WineColor.entries) {
                    FilterChip(
                        selected = filters.color == color,
                        onClick = { onChange(filters.copy(color = color)) },
                        label = { Text(stringResource(color.label())) },
                        modifier = Modifier.testTag("filter-color-${color.code}"),
                    )
                }
            }
            if (showReadyNow) {
                Row(
                    Modifier.fillMaxWidth().selectable(
                        selected = filters.readyNow,
                        role = Role.Switch,
                        onClick = { onChange(filters.copy(readyNow = !filters.readyNow)) },
                    ).testTag("filter-ready-now"),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(stringResource(R.string.filters_ready_now), Modifier.weight(1f))
                    Switch(checked = filters.readyNow, onCheckedChange = null)
                }
            }
            if (filters.activeCount > 0) {
                TextButton(onClick = onClear, modifier = Modifier.align(Alignment.End).testTag("sheet-clear-filters")) {
                    Text(stringResource(R.string.filters_clear))
                }
            }
        }
    }
}

/** Pick an axis, then a direction; [axisLabel] names each axis, [axisTag] tags it for tests. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun <T> SortSheet(
    axes: List<T>,
    sortBy: T,
    sortDir: SortDir,
    axisLabel: (T) -> Int,
    axisTag: (T) -> String,
    onChange: (T, SortDir) -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss, modifier = Modifier.testTag("sort-sheet")) {
        Column(Modifier.padding(start = 20.dp, end = 20.dp, bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(stringResource(R.string.sort_title), style = MaterialTheme.typography.titleLarge)
            for (axis in axes) {
                Row(
                    Modifier.fillMaxWidth()
                        .selectable(selected = sortBy == axis, role = Role.RadioButton) { onChange(axis, sortDir) }
                        .padding(vertical = 4.dp)
                        .testTag("sort-${axisTag(axis)}"),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RadioButton(selected = sortBy == axis, onClick = null)
                    Text(stringResource(axisLabel(axis)), Modifier.padding(start = 12.dp))
                }
            }
            SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth().padding(top = 8.dp)) {
                SortDir.entries.forEachIndexed { index, dir ->
                    SegmentedButton(
                        selected = sortDir == dir,
                        onClick = { onChange(sortBy, dir) },
                        shape = SegmentedButtonDefaults.itemShape(index, SortDir.entries.size),
                        modifier = Modifier.testTag("sort-dir-${dir.name.lowercase()}"),
                    ) {
                        Text(stringResource(if (dir == SortDir.ASC) R.string.sort_ascending else R.string.sort_descending))
                    }
                }
            }
        }
    }
}

/** Previous / "Page x of y" / Next, as the last row of a paged list. */
@Composable
fun Pagination(page: Page<*>, onGoToPage: (Int) -> Unit) {
    Row(
        Modifier.fillMaxWidth().padding(16.dp).testTag("pagination"),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        OutlinedButton(
            onClick = { onGoToPage(page.page - 1) },
            enabled = page.page > 1,
            modifier = Modifier.testTag("pagination-previous"),
        ) { Text(stringResource(R.string.pagination_previous)) }
        Text(
            stringResource(R.string.pagination_status, page.page, page.pageCount),
            style = MaterialTheme.typography.bodyMedium,
            modifier = Modifier.testTag("pagination-status"),
        )
        OutlinedButton(
            onClick = { onGoToPage(page.page + 1) },
            enabled = page.page < page.pageCount,
            modifier = Modifier.testTag("pagination-next"),
        ) { Text(stringResource(R.string.pagination_next)) }
    }
}

/**
 * Wraps a change of filter, sort or page so the list then starts from its
 * top; coming back from a detail page keeps the scroll instead. The scroll
 * waits for the new [rows]: a lazy list otherwise keeps its old first row in
 * view by key.
 */
@Composable
fun rememberFromTop(listState: LazyListState, rows: Any): (() -> Unit) -> Unit {
    var scrollToTop by rememberSaveable { mutableStateOf(false) }
    LaunchedEffect(rows) {
        if (scrollToTop) {
            scrollToTop = false
            listState.scrollToItem(0)
        }
    }
    return { change -> scrollToTop = true; change() }
}
