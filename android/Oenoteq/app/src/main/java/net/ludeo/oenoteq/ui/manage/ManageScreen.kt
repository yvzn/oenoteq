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
import net.ludeo.oenoteq.ui.components.ScreenScaffold
import net.ludeo.oenoteq.ui.components.texts

/** The Manage hub: one card per kind of reference data. Meal Pairings join in milestone 3. */
@Composable
fun ManageScreen(onOpen: (Referential) -> Unit) {
    ScreenScaffold(title = stringResource(R.string.nav_manage)) { modifier ->
        Column(
            modifier.padding(16.dp).testTag("manage-screen"),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            for (kind in Referential.entries) {
                Card(
                    onClick = { onOpen(kind) },
                    modifier = Modifier.fillMaxWidth().testTag("manage-${kind.name.lowercase()}"),
                ) {
                    Column(Modifier.padding(16.dp)) {
                        Text(stringResource(kind.texts.label), style = MaterialTheme.typography.titleMedium)
                        Text(
                            stringResource(kind.texts.description),
                            style = MaterialTheme.typography.bodyMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}
