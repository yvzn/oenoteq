package net.ludeo.oenoteq.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// The PWA's palette (web/src/style.css): bordeaux, gold, parchment, ink.
private val Bordeaux = Color(0xFF6E1F2E)
private val Gold = Color(0xFFC9A227)
private val GoldSoft = Color(0xFFF3E9D3)
private val Parchment = Color(0xFFF5F0E5)
private val ParchmentRaised = Color(0xFFFBF9F4)
private val Ink = Color(0xFF241812)
private val InkSoft = Color(0xFF4A3B2E)
private val Danger = Color(0xFFB3261E)

private val LightColors = lightColorScheme(
    primary = Bordeaux,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFF2DADF),
    onPrimaryContainer = Color(0xFF3A0E17),
    secondary = Gold,
    onSecondary = Ink,
    secondaryContainer = GoldSoft,
    onSecondaryContainer = Ink,
    background = Parchment,
    onBackground = Ink,
    surface = ParchmentRaised,
    onSurface = Ink,
    surfaceVariant = Color(0xFFEDE5D4),
    onSurfaceVariant = InkSoft,
    // Field outlines in the PWA's muted ink; dividers and chip borders a warm line.
    outline = Color(0xFF8C8171),
    outlineVariant = Color(0xFFDDD3C1),
    // Every container tone in parchment: left unset, Material's baseline lilac shows
    // on cards (Highest), bottom sheets (Low), dialogs (High) and switch tracks.
    // Sheets take the page's own parchment.
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Parchment,
    surfaceContainer = Color(0xFFF0E9DA),
    surfaceContainerHigh = Color(0xFFEBE3D2),
    surfaceContainerHighest = Color(0xFFE5DCC8),
    error = Danger,
)

private val DarkColors = darkColorScheme(
    primary = Color(0xFFE8A3AF),
    onPrimary = Color(0xFF4A1220),
    primaryContainer = Color(0xFF6E1F2E),
    onPrimaryContainer = Color(0xFFFFDDE2),
    secondary = Color(0xFFE3C35A),
    onSecondary = Color(0xFF3A2E00),
    secondaryContainer = Color(0xFF574400),
    onSecondaryContainer = Color(0xFFFFE08A),
    background = Color(0xFF1C1512),
    onBackground = Color(0xFFEDE4D3),
    surface = Color(0xFF241C18),
    onSurface = Color(0xFFEDE4D3),
    surfaceVariant = Color(0xFF3A302A),
    onSurfaceVariant = Color(0xFFD4C7B4),
    outline = Color(0xFF9E9180),
    outlineVariant = Color(0xFF4A3F37),
    surfaceContainerLowest = Color(0xFF17110E),
    surfaceContainerLow = Color(0xFF1C1512),
    surfaceContainer = Color(0xFF2C231E),
    surfaceContainerHigh = Color(0xFF362C26),
    surfaceContainerHighest = Color(0xFF41362F),
    error = Color(0xFFF2B8B5),
)

@Composable
fun OenoteqTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = if (darkTheme) DarkColors else LightColors, content = content)
}
