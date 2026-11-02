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
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.navigation.NavDestination.Companion.hasRoute
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.navigation
import androidx.navigation.compose.rememberNavController
import kotlinx.serialization.Serializable
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.ui.cellar.CellarScreen
import net.ludeo.oenoteq.ui.history.HistoryScreen
import net.ludeo.oenoteq.ui.manage.ManageScreen
import net.ludeo.oenoteq.ui.manage.ReferentialFormScreen
import net.ludeo.oenoteq.ui.manage.ReferentialListScreen
import net.ludeo.oenoteq.ui.wine.WineDetailScreen
import net.ludeo.oenoteq.ui.wine.WineFormScreen

// One nested graph per bottom-bar area, so each keeps its own back stack.

@Serializable object CellarGraph

@Serializable object CellarRoute

@Serializable object WineNewRoute

@Serializable data class WineDetailRoute(val id: Long)

@Serializable data class WineEditRoute(val id: Long)

@Serializable object HistoryRoute

@Serializable object ManageGraph

@Serializable object ManageRoute

@Serializable data class ReferentialListRoute(val kind: Referential)

@Serializable data class ReferentialNewRoute(val kind: Referential)

@Serializable data class ReferentialEditRoute(val kind: Referential, val id: Long)

private data class TopLevelDestination(
    val route: Any,
    @StringRes val label: Int,
    val icon: ImageVector,
    val testTag: String,
)

private val topLevelDestinations = listOf(
    TopLevelDestination(CellarGraph, R.string.nav_cellar, Icons.Outlined.WineBar, "nav-cellar"),
    TopLevelDestination(HistoryRoute, R.string.nav_history, Icons.Outlined.History, "nav-history"),
    TopLevelDestination(ManageGraph, R.string.nav_manage, Icons.Outlined.Tune, "nav-manage"),
)

@Composable
fun OenoteqApp() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val back: () -> Unit = { navController.popBackStack() }

    Scaffold(
        bottomBar = {
            NavigationBar {
                for (destination in topLevelDestinations) {
                    val selected = backStackEntry?.destination?.hierarchy
                        ?.any { it.hasRoute(destination.route::class) } == true
                    NavigationBarItem(
                        selected = selected,
                        onClick = {
                            navController.navigate(destination.route) {
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
                        onBack = back,
                        onSaved = { id ->
                            navController.navigate(WineDetailRoute(id)) {
                                popUpTo<WineNewRoute> { inclusive = true }
                            }
                        },
                    )
                }
                composable<WineDetailRoute> {
                    WineDetailScreen(onBack = back, onEdit = { navController.navigate(WineEditRoute(it)) })
                }
                composable<WineEditRoute> { WineFormScreen(onBack = back, onSaved = { back() }) }
            }
            composable<HistoryRoute> { HistoryScreen() }
            navigation<ManageGraph>(startDestination = ManageRoute) {
                composable<ManageRoute> { ManageScreen(onOpen = { navController.navigate(ReferentialListRoute(it)) }) }
                composable<ReferentialListRoute> {
                    ReferentialListScreen(
                        onBack = back,
                        onAdd = { navController.navigate(ReferentialNewRoute(it)) },
                        onRename = { kind, id -> navController.navigate(ReferentialEditRoute(kind, id)) },
                    )
                }
                composable<ReferentialNewRoute> { ReferentialFormScreen(onBack = back) }
                composable<ReferentialEditRoute> { ReferentialFormScreen(onBack = back) }
            }
        }
    }
}
