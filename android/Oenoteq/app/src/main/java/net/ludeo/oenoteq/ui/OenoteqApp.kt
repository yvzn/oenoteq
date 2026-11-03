package net.ludeo.oenoteq.ui

import androidx.annotation.StringRes
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material.icons.outlined.WineBar
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavGraphBuilder
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.navigation
import androidx.navigation.compose.rememberNavController
import androidx.navigation.toRoute
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.serialization.Serializable
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.domain.WineColor
import net.ludeo.oenoteq.ui.cellar.CellarScreen
import net.ludeo.oenoteq.ui.history.HistoryScreen
import net.ludeo.oenoteq.ui.manage.ManageScreen
import net.ludeo.oenoteq.ui.manage.MealPairingScreen
import net.ludeo.oenoteq.ui.manage.ReferentialFormScreen
import net.ludeo.oenoteq.ui.manage.ReferentialListScreen
import net.ludeo.oenoteq.ui.wine.WineDetailScreen
import net.ludeo.oenoteq.ui.wine.WineFormScreen

// One nested graph per bottom-bar area, so each keeps its own back stack. A
// Wine opened from the cellar or from the History stays in that area: each
// area has its own route types for the Wine screens, since a route type can
// only be declared once in the graph.

@Serializable object CellarGraph

@Serializable object CellarRoute

@Serializable object WineNewRoute

@Serializable data class WineDetailRoute(val id: Long)

@Serializable data class WineEditRoute(val id: Long)

@Serializable data class CellarPairingRoute(val appellationId: Long, val color: WineColor)

@Serializable object HistoryGraph

@Serializable object HistoryRoute

@Serializable data class HistoryWineRoute(val id: Long)

@Serializable data class HistoryWineEditRoute(val id: Long)

@Serializable data class HistoryPairingRoute(val appellationId: Long, val color: WineColor)

@Serializable object ManageGraph

@Serializable object ManageRoute

@Serializable data class ReferentialListRoute(val kind: Referential)

@Serializable data class ReferentialNewRoute(val kind: Referential)

@Serializable data class ReferentialEditRoute(val kind: Referential, val id: Long)

@Serializable object MealPairingRoute

/** [home] is the area's top screen, where tapping its already selected tab returns. */
private data class TopLevelDestination(
    val route: Any,
    val home: Any,
    @StringRes val label: Int,
    val icon: ImageVector,
    val testTag: String,
)

private val topLevelDestinations = listOf(
    TopLevelDestination(CellarGraph, CellarRoute, R.string.nav_cellar, Icons.Outlined.WineBar, "nav-cellar"),
    TopLevelDestination(HistoryGraph, HistoryRoute, R.string.nav_history, Icons.Outlined.History, "nav-history"),
    TopLevelDestination(ManageGraph, ManageRoute, R.string.nav_manage, Icons.Outlined.Tune, "nav-manage"),
)

@Composable
fun OenoteqApp() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val back: () -> Unit = { navController.popBackStack() }
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val resources = LocalContext.current.resources
    // As the PWA's toast: one at a time, the next ones queued, each kept until dismissed (no timer).
    // Each shown or waiting message is a job; navigating cancels all but the one carried across.
    val messages = remember { mutableListOf<Pair<Job, Boolean>>() }
    val notify: (Notice) -> Unit = { notice ->
        val text = if (notice.arg == null) resources.getString(notice.text) else resources.getString(notice.text, notice.arg)
        val job = scope.launch { snackbar.showSnackbar(text, withDismissAction = true, duration = SnackbarDuration.Indefinite) }
        messages += job to notice.carried
        job.invokeOnCompletion { messages.removeAll { it.first == job } }
    }
    LaunchedEffect(backStackEntry?.id) {
        val (keep, drop) = messages.partition { (_, carried) -> carried }
        drop.forEach { (job, _) -> job.cancel() }
        // Carried only into the very next screen.
        messages.clear()
        messages += keep.map { (job, _) -> job to false }
    }

    CompositionLocalProvider(LocalNotify provides notify) {
        Scaffold(
            snackbarHost = {
                SnackbarHost(snackbar) { data ->
                    Snackbar(data, modifier = Modifier.testTag("notice"))
                }
            },
            bottomBar = {
                NavigationBar {
                    for (destination in topLevelDestinations) {
                        val selected = backStackEntry?.destination?.hierarchy
                            ?.any { it.hasRoute(destination.route::class) } == true
                        NavigationBarItem(
                            selected = selected,
                            onClick = {
                                // Material pattern: another tab restores where it was left; the
                                // selected tab returns to its top screen.
                                if (selected) {
                                    navController.popBackStack(destination.home, inclusive = false)
                                } else navController.navigate(destination.route) {
                                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(destination.icon, contentDescription = null) },
                            label = { Text(stringResource(destination.label)) },
                            modifier = Modifier.testTag(destination.testTag),
                        )
                    }
                }
            },
            // Each screen's top app bar takes the status bar inset itself.
            contentWindowInsets = WindowInsets(0),
        ) { padding ->
            NavHost(navController, startDestination = CellarGraph, modifier = Modifier.padding(padding)) {
                navigation<CellarGraph>(startDestination = CellarRoute) {
                    composable<CellarRoute> {
                        CellarScreen(
                            onAddWine = { navController.navigate(WineNewRoute) },
                            onOpenWine = { navController.navigate(WineDetailRoute(it)) },
                        )
                    }
                    composable<WineNewRoute> {
                        WineFormScreen(
                            editId = null,
                            onBack = back,
                            onSaved = { id ->
                                navController.navigate(WineDetailRoute(id)) {
                                    popUpTo<WineNewRoute> { inclusive = true }
                                }
                            },
                        )
                    }
                    wineScreens<WineDetailRoute, WineEditRoute, CellarPairingRoute>(
                        navController,
                        detailId = { it.id },
                        editId = { it.id },
                        editRoute = ::WineEditRoute,
                        pairing = { it.appellationId to it.color },
                        pairingRoute = ::CellarPairingRoute,
                    )
                }
                navigation<HistoryGraph>(startDestination = HistoryRoute) {
                    composable<HistoryRoute> { HistoryScreen(onOpenWine = { navController.navigate(HistoryWineRoute(it)) }) }
                    wineScreens<HistoryWineRoute, HistoryWineEditRoute, HistoryPairingRoute>(
                        navController,
                        detailId = { it.id },
                        editId = { it.id },
                        editRoute = ::HistoryWineEditRoute,
                        pairing = { it.appellationId to it.color },
                        pairingRoute = ::HistoryPairingRoute,
                    )
                }
                navigation<ManageGraph>(startDestination = ManageRoute) {
                    composable<ManageRoute> {
                        ManageScreen(
                            onOpen = { navController.navigate(ReferentialListRoute(it)) },
                            onOpenPairings = { navController.navigate(MealPairingRoute) },
                        )
                    }
                    composable<ReferentialListRoute> {
                        ReferentialListScreen(
                            onBack = back,
                            onAdd = { navController.navigate(ReferentialNewRoute(it)) },
                            onRename = { kind, id -> navController.navigate(ReferentialEditRoute(kind, id)) },
                        )
                    }
                    composable<ReferentialNewRoute> { ReferentialFormScreen(onBack = back) }
                    composable<ReferentialEditRoute> { ReferentialFormScreen(onBack = back) }
                    composable<MealPairingRoute> { MealPairingScreen(appellationId = null, color = null, onBack = back) }
                }
            }
        }
    }
}

/** A Wine's detail, edit and pairing screens, inside one area's graph with that area's route types. */
private inline fun <reified Detail : Any, reified Edit : Any, reified Pairing : Any> NavGraphBuilder.wineScreens(
    navController: NavHostController,
    crossinline detailId: (Detail) -> Long,
    crossinline editId: (Edit) -> Long,
    crossinline editRoute: (Long) -> Edit,
    crossinline pairing: (Pairing) -> Pair<Long, WineColor>,
    crossinline pairingRoute: (Long, WineColor) -> Pairing,
) {
    composable<Detail> { entry ->
        WineDetailScreen(
            id = detailId(entry.toRoute<Detail>()),
            onBack = { navController.popBackStack() },
            onEdit = { navController.navigate(editRoute(it)) },
            onEditPairings = { appellationId, color -> navController.navigate(pairingRoute(appellationId, color)) },
        )
    }
    composable<Edit> { entry ->
        WineFormScreen(
            editId = editId(entry.toRoute<Edit>()),
            onBack = { navController.popBackStack() },
            onSaved = { navController.popBackStack() },
        )
    }
    composable<Pairing> { entry ->
        val (appellationId, color) = pairing(entry.toRoute<Pairing>())
        MealPairingScreen(appellationId = appellationId, color = color, onBack = { navController.popBackStack() })
    }
}
