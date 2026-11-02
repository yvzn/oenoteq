package net.ludeo.oenoteq.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.domain.GardeStatus
import net.ludeo.oenoteq.domain.WineColor

// The PWA's status and swatch colors (web/src/style.css, ColorSwatch.vue).
private val StatusReady = Color(0xFF2F7A3D)
private val StatusYoung = Color(0xFFA3690F)
private val StatusPast = Color(0xFFA83D2E)
private val Bordeaux = Color(0xFF6E1F2E)
private val Gold = Color(0xFFC9A227)
private val Rose = Color(0xFFFDA4AF)

private fun WineColor.swatch(): Color = when (this) {
    WineColor.ROUGE -> Bordeaux
    WineColor.BLANC -> Gold
    WineColor.ROSE -> Rose
}

/** The colored bar at the start of a Wine row. */
@Composable
fun ColorRail(color: WineColor, height: Dp = 44.dp) {
    Box(Modifier.size(width = 5.dp, height = height).clip(RoundedCornerShape(3.dp)).background(color.swatch()))
}

@Composable
fun ColorDot(color: WineColor) {
    Box(
        Modifier.size(12.dp).clip(CircleShape).background(color.swatch())
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, CircleShape),
    )
}

@Composable
fun GardeStatusBadge(status: GardeStatus, modifier: Modifier = Modifier) {
    val color = when (status) {
        GardeStatus.TOO_YOUNG -> StatusYoung
        GardeStatus.READY -> StatusReady
        GardeStatus.PAST_PEAK -> StatusPast
        GardeStatus.UNASSESSED -> MaterialTheme.colorScheme.onSurfaceVariant
    }
    Row(modifier, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        Box(Modifier.size(7.dp).clip(CircleShape).background(color))
        Text(
            stringResource(status.label()),
            color = color,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

/**
 * A screen below the bottom bar: a top app bar with an optional back arrow.
 * The bar takes the status bar inset; the bottom bar already takes the
 * navigation bar's, so the content gets none.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScreenScaffold(
    title: String,
    onBack: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
    floatingActionButton: @Composable () -> Unit = {},
    content: @Composable (Modifier) -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, modifier = Modifier.testTag("screen-title")) },
                navigationIcon = {
                    if (onBack != null) {
                        IconButton(onClick = onBack, modifier = Modifier.testTag("back")) {
                            Icon(Icons.AutoMirrored.Outlined.ArrowBack, stringResource(R.string.action_back))
                        }
                    }
                },
                actions = actions,
            )
        },
        floatingActionButton = floatingActionButton,
        contentWindowInsets = WindowInsets(0),
    ) { padding -> content(Modifier.padding(padding)) }
}

@Composable
fun Loading(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
}

/** A short centered message, for empty lists and missing records. */
@Composable
fun StatusMessage(text: String, modifier: Modifier = Modifier, action: @Composable () -> Unit = {}) {
    Box(modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(text, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
            action()
        }
    }
}

@Composable
fun ConfirmDialog(message: String, confirmLabel: String, onConfirm: () -> Unit, onDismiss: () -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        text = { Text(message) },
        confirmButton = {
            TextButton(onClick = onConfirm, modifier = Modifier.testTag("confirm")) { Text(confirmLabel) }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, modifier = Modifier.testTag("cancel")) {
                Text(stringResource(R.string.action_cancel))
            }
        },
    )
}
