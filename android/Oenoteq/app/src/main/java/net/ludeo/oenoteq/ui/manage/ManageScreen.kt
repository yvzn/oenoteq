package net.ludeo.oenoteq.ui.manage

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.dp
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.ui.components.LanguageToggle
import net.ludeo.oenoteq.ui.components.ScreenScaffold
import net.ludeo.oenoteq.ui.components.texts

/** The Manage hub: one card per kind of reference data, then Meal Pairings. */
@Composable
fun ManageScreen(onOpen: (Referential) -> Unit, onOpenPairings: () -> Unit) {
    ScreenScaffold(title = stringResource(R.string.nav_manage), actions = { LanguageToggle() }) { modifier ->
        Column(
            modifier.padding(16.dp).testTag("manage-screen"),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            for (kind in Referential.entries) {
                HubCard(kind.texts.label, kind.texts.description, "manage-${kind.name.lowercase()}") { onOpen(kind) }
            }
            HubCard(
                R.string.manage_meal_pairings_label,
                R.string.manage_meal_pairings_description,
                "manage-meal-pairings",
                onOpenPairings,
            )
        }
    }
}

@Composable
private fun HubCard(label: Int, description: Int, testTag: String, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth().testTag(testTag)) {
        Column(Modifier.padding(16.dp)) {
            Text(stringResource(label), style = MaterialTheme.typography.titleMedium)
            Text(
                stringResource(description),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}
