package net.ludeo.oenoteq.ui

import androidx.annotation.StringRes
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
import androidx.navigation.compose.rememberNavController
import kotlinx.serialization.Serializable
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.ui.cellar.CellarScreen
import net.ludeo.oenoteq.ui.history.HistoryScreen
import net.ludeo.oenoteq.ui.manage.ManageScreen

@Serializable object CellarRoute

@Serializable object HistoryRoute

@Serializable object ManageRoute

private data class TopLevelDestination(
    val route: Any,
    @StringRes val label: Int,
    val icon: ImageVector,
    val testTag: String,
)

private val topLevelDestinations = listOf(
    TopLevelDestination(CellarRoute, R.string.nav_cellar, Icons.Outlined.WineBar, "nav-cellar"),
    TopLevelDestination(HistoryRoute, R.string.nav_history, Icons.Outlined.History, "nav-history"),
    TopLevelDestination(ManageRoute, R.string.nav_manage, Icons.Outlined.Tune, "nav-manage"),
)

@Composable
fun OenoteqApp() {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()

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
    ) { padding ->
        NavHost(navController, startDestination = CellarRoute, modifier = Modifier.padding(padding)) {
            composable<CellarRoute> { CellarScreen() }
            composable<HistoryRoute> { HistoryScreen() }
            composable<ManageRoute> { ManageScreen() }
        }
    }
}
