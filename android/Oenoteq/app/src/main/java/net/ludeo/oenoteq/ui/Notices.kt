package net.ludeo.oenoteq.ui

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.staticCompositionLocalOf
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.Flow
import net.ludeo.oenoteq.domain.CellarError

/**
 * A short confirmation after a change, as the PWA's success message: [arg]
 * fills a `%s` in [text]. Navigating drops every message except one sent
 * with [carried] just before the navigation it confirms (ADR 0003).
 */
data class Notice(@StringRes val text: Int, val arg: String? = null, val carried: Boolean = false)

/** Shows a [Notice] in the app-wide snackbar, which outlives the screen that sent it. */
val LocalNotify = staticCompositionLocalOf<(Notice) -> Unit> { {} }

/** Shows the notices a screen's ViewModel sends while the screen is on display. */
@Composable
fun CollectNotices(notices: Flow<Notice>) {
    val notify = LocalNotify.current
    LaunchedEffect(notices) { notices.collect(notify) }
}

/**
 * Runs a write and returns null, or the reason it failed: a rule the
 * repositories refuse to break, or [CellarError.Code.INTERNAL_ERROR] for
 * anything unexpected, so the screen explains it instead of the app crashing.
 */
suspend fun attempt(write: suspend () -> Unit): CellarError.Code? = try {
    write()
    null
} catch (e: CancellationException) {
    throw e
} catch (e: CellarError) {
    e.code
} catch (_: Exception) {
    CellarError.Code.INTERNAL_ERROR
}
