package net.ludeo.oenoteq.ui.wine

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.createSavedStateHandle
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import androidx.navigation.toRoute
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.data.WineRepository
import net.ludeo.oenoteq.data.WineWithNames
import net.ludeo.oenoteq.domain.GardeStatus
import net.ludeo.oenoteq.domain.gardeStatus
import net.ludeo.oenoteq.ui.WineDetailRoute
import net.ludeo.oenoteq.ui.components.ColorRail
import net.ludeo.oenoteq.ui.components.GardeStatusBadge
import net.ludeo.oenoteq.ui.components.Loading
import net.ludeo.oenoteq.ui.components.ScreenScaffold
import net.ludeo.oenoteq.ui.components.StatusMessage
import net.ludeo.oenoteq.ui.components.label
import net.ludeo.oenoteq.ui.components.millesimeText
import net.ludeo.oenoteq.ui.container
import java.time.Year

data class WineDetailState(
    val loading: Boolean = true,
    val wine: WineWithNames? = null,
    val gardeStatus: GardeStatus = GardeStatus.UNASSESSED,
)

class WineDetailViewModel(val id: Long, wines: WineRepository, currentYear: () -> Int = { Year.now().value }) : ViewModel() {
    val state: StateFlow<WineDetailState> = wines.observe(id).map { wine ->
        WineDetailState(
            loading = false,
            wine = wine,
            gardeStatus = wine?.let { gardeStatus(it.gardeDebut, it.gardeFin, currentYear()) } ?: GardeStatus.UNASSESSED,
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), WineDetailState())

    companion object {
        val Factory = viewModelFactory {
            initializer {
                WineDetailViewModel(createSavedStateHandle().toRoute<WineDetailRoute>().id, container.wines)
            }
        }
    }
}

/** A Wine's fields and Garde Status. Suggested Meals and Consumptions join in milestone 3. */
@Composable
fun WineDetailScreen(
    onBack: () -> Unit,
    onEdit: (Long) -> Unit,
    viewModel: WineDetailViewModel = viewModel(factory = WineDetailViewModel.Factory),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val wine = state.wine

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
            else -> WineDetail(wine, state.gardeStatus, modifier)
        }
    }
}

@Composable
private fun WineDetail(wine: WineWithNames, status: GardeStatus, modifier: Modifier) {
    Column(
        modifier.verticalScroll(rememberScrollState()).padding(20.dp).testTag("wine-detail"),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
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
            GardeStatusBadge(status, Modifier.testTag("wine-status"))
            Text(
                stringResource(R.string.quantity_short, wine.quantity),
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.testTag("wine-quantity"),
            )
        }
    }
}
