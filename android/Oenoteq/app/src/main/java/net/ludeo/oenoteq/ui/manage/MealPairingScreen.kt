package net.ludeo.oenoteq.ui.manage

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flatMapLatest
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.receiveAsFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.data.MealPairingRepository
import net.ludeo.oenoteq.data.ReferentialRepository
import net.ludeo.oenoteq.domain.CellarError
import net.ludeo.oenoteq.domain.NamedItem
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.domain.WineColor
import net.ludeo.oenoteq.ui.CollectNotices
import net.ludeo.oenoteq.ui.Notice
import net.ludeo.oenoteq.ui.attempt
import net.ludeo.oenoteq.ui.components.AutocompleteField
import net.ludeo.oenoteq.ui.components.ColorDot
import net.ludeo.oenoteq.ui.components.ScreenScaffold
import net.ludeo.oenoteq.ui.components.highlight
import net.ludeo.oenoteq.ui.components.label
import net.ludeo.oenoteq.ui.components.message
import net.ludeo.oenoteq.ui.components.selectedChipBorder
import net.ludeo.oenoteq.ui.components.selectedChipColors
import net.ludeo.oenoteq.ui.container

data class PairingSelection(
    val appellationId: Long? = null,
    val color: WineColor? = null,
    /** The Meal picked in "Add meal", not paired yet. */
    val mealId: Long? = null,
    /** Bumped after each add, to empty the "Add meal" field. */
    val addCount: Int = 0,
    val error: CellarError.Code? = null,
    val busy: Boolean = false,
    /** Meals just paired, shown highlighted until the selection changes or the user leaves. */
    val highlighted: Set<Long> = emptySet(),
)

data class MealPairingState(
    val appellations: List<NamedItem> = emptyList(),
    val meals: List<NamedItem> = emptyList(),
    val paired: List<NamedItem> = emptyList(),
    val selection: PairingSelection = PairingSelection(),
) {
    val ready: Boolean get() = selection.appellationId != null && selection.color != null
}

/** Pick an Appellation and a Color, then see, add and remove their Meals (`MealPairingView`). */
@OptIn(ExperimentalCoroutinesApi::class)
class MealPairingViewModel(
    appellationId: Long?,
    color: WineColor?,
    appellations: ReferentialRepository,
    private val meals: ReferentialRepository,
    private val pairings: MealPairingRepository,
) : ViewModel() {
    private val selection = MutableStateFlow(PairingSelection(appellationId, color))
    private val noticeChannel = Channel<Notice>(Channel.BUFFERED)
    val notices: Flow<Notice> = noticeChannel.receiveAsFlow()

    private val paired = selection.flatMapLatest { s ->
        if (s.appellationId == null || s.color == null) flowOf(emptyList()) else pairings.observeMeals(s.appellationId, s.color)
    }

    val state: StateFlow<MealPairingState> = combine(appellations.observeAll(), meals.observeAll(), paired, selection) { a, m, p, s ->
        MealPairingState(a, m, p, s)
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), MealPairingState(selection = selection.value))

    fun selectAppellation(id: Long?) = selection.update { it.copy(appellationId = id, error = null, highlighted = emptySet()) }

    fun selectColor(color: WineColor) = selection.update { it.copy(color = color, error = null, highlighted = emptySet()) }

    fun clearHighlights() = selection.update { it.copy(highlighted = emptySet()) }

    fun pickMeal(id: Long?) = selection.update { it.copy(mealId = id, error = null) }

    fun addPicked() {
        val mealId = selection.value.mealId ?: return
        change { appellationId, color ->
            pairings.add(appellationId, color, mealId)
            mealId
        }
    }

    /** A Meal created here is paired at once with the current Appellation and Color. */
    fun createAndAdd(name: String) = change { appellationId, color ->
        val meal = meals.create(name)
        pairings.add(appellationId, color, meal.id)
        meal.id
    }

    fun remove(mealId: Long) = change(notice = R.string.notice_pairing_removed, clearsPick = false) { appellationId, color ->
        pairings.remove(appellationId, color, mealId)
        null
    }

    /**
     * [action] returns the Meal it paired, highlighted in the list; a change
     * that leaves nothing to highlight is confirmed by [notice] instead.
     */
    private fun change(@StringRes notice: Int? = null, clearsPick: Boolean = true, action: suspend (Long, WineColor) -> Long?) {
        val current = selection.value
        val appellationId = current.appellationId ?: return
        val color = current.color ?: return
        if (current.busy) return
        selection.update { it.copy(busy = true, error = null) }
        viewModelScope.launch {
            var paired: Long? = null
            val refusal = attempt { paired = action(appellationId, color) }
            if (refusal != null) {
                selection.update { it.copy(error = refusal, busy = false) }
                return@launch
            }
            selection.update {
                val done = it.copy(busy = false, highlighted = it.highlighted + setOfNotNull(paired))
                if (clearsPick) done.copy(mealId = null, addCount = it.addCount + 1) else done
            }
            if (notice != null) noticeChannel.send(Notice(notice))
        }
    }

    companion object {
        fun factory(appellationId: Long?, color: WineColor?) = viewModelFactory {
            initializer {
                MealPairingViewModel(
                    appellationId,
                    color,
                    container.referentials(Referential.APPELLATION),
                    container.referentials(Referential.MEAL),
                    container.mealPairings,
                )
            }
        }
    }
}

@Composable
fun MealPairingScreen(
    appellationId: Long?,
    color: WineColor?,
    onBack: () -> Unit,
    viewModel: MealPairingViewModel = viewModel(factory = MealPairingViewModel.factory(appellationId, color)),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val selection = state.selection
    CollectNotices(viewModel.notices)
    DisposableEffect(viewModel) { onDispose(viewModel::clearHighlights) }

    ScreenScaffold(title = stringResource(R.string.manage_meal_pairings_label), onBack = onBack) { modifier ->
        Column(
            modifier.imePadding().verticalScroll(rememberScrollState()).padding(16.dp).testTag("meal-pairing"),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            AutocompleteField(
                label = stringResource(R.string.label_appellation),
                placeholder = stringResource(R.string.pairing_pick_appellation),
                items = state.appellations,
                selectedId = selection.appellationId,
                onSelect = viewModel::selectAppellation,
                onCreate = null,
                testTag = "pairing-appellation",
            )
            Text(stringResource(R.string.label_color), style = MaterialTheme.typography.labelLarge)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for (wineColor in WineColor.entries) {
                    FilterChip(
                        selected = selection.color == wineColor,
                        onClick = { viewModel.selectColor(wineColor) },
                        label = { Text(stringResource(wineColor.label())) },
                        leadingIcon = { ColorDot(wineColor) },
                        colors = selectedChipColors(),
                        border = selectedChipBorder(selection.color == wineColor),
                        modifier = Modifier.testTag("pairing-color-${wineColor.code}"),
                    )
                }
            }

            if (!state.ready) {
                Text(stringResource(R.string.pairing_no_selection), style = MaterialTheme.typography.titleMedium)
                Text(
                    stringResource(R.string.pairing_no_selection_hint),
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.testTag("pairing-no-selection"),
                )
                return@Column
            }

            Text(
                stringResource(R.string.pairing_currently_paired),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
            )
            if (state.paired.isEmpty()) {
                Text(stringResource(R.string.pairing_none_paired), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            for (meal in state.paired) {
                Row(
                    Modifier.fillMaxWidth().highlight(meal.id in selection.highlighted).testTag("paired-meal"),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(meal.name, Modifier.weight(1f).testTag("paired-meal-name"))
                    TextButton(
                        onClick = { viewModel.remove(meal.id) },
                        enabled = !selection.busy,
                        modifier = Modifier.testTag("pairing-remove-${meal.name}"),
                    ) { Text(stringResource(R.string.pairing_remove)) }
                }
            }

            val pairedIds = state.paired.map { it.id }.toSet()
            // A fresh field after each add, so it doesn't keep the name just paired.
            key(selection.addCount) {
                AutocompleteField(
                    label = stringResource(R.string.pairing_add_meal),
                    placeholder = stringResource(R.string.pairing_add_or_create_meal),
                    items = state.meals.filter { it.id !in pairedIds },
                    selectedId = selection.mealId,
                    onSelect = viewModel::pickMeal,
                    onCreate = viewModel::createAndAdd,
                    testTag = "pairing-meal",
                )
            }
            selection.error?.let {
                Text(
                    stringResource(it.message()),
                    color = MaterialTheme.colorScheme.error,
                    modifier = Modifier.testTag("pairing-error"),
                )
            }
            Button(
                onClick = viewModel::addPicked,
                enabled = selection.mealId != null && !selection.busy,
                modifier = Modifier.align(Alignment.End).testTag("pairing-add"),
            ) { Text(stringResource(R.string.pairing_add_meal)) }
        }
    }
}
