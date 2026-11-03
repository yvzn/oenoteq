package net.ludeo.oenoteq.ui.components

import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.selected
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.core.os.ConfigurationCompat
import androidx.core.os.LocaleListCompat

/** Each language named in its own words, without flags (languages aren't countries). */
private val languages = listOf("fr" to "Français", "en" to "English")

/**
 * The PWA's plain `FR | EN` toggle (ADR 0011), in the top bar of the three
 * main screens so it is never more than a tab away. The active language is
 * bold. Android keeps the choice for the app across restarts.
 */
@Composable
fun LanguageToggle() {
    // The language the app shows now: the user's choice, else the phone's when it is French, else English.
    val current = ConfigurationCompat.getLocales(LocalConfiguration.current)[0]?.language.takeIf { it == "fr" } ?: "en"
    Row(verticalAlignment = Alignment.CenterVertically) {
        languages.forEachIndexed { index, (tag, name) ->
            if (index > 0) Text("|", color = MaterialTheme.colorScheme.outline)
            val active = current == tag
            TextButton(
                // Recreates the activity in the new language; ViewModels, and with them half-filled forms, survive.
                onClick = { if (!active) AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag)) },
                modifier = Modifier.testTag("language-$tag").semantics {
                    contentDescription = name
                    selected = active
                },
            ) {
                Text(tag.uppercase(), fontWeight = if (active) FontWeight.Bold else FontWeight.Normal)
            }
        }
    }
}
