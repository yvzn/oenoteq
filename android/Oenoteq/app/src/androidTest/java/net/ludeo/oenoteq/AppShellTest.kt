package net.ludeo.oenoteq

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AppShellTest {
    private val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule val rules: RuleChain = RuleChain.outerRule(EmptyCellarRule()).around(compose)

    @Test
    fun emptyCellarOffersToAddAWineOrImport() {
        awaitEmptyCellar()
        compose.onNodeWithTag("empty-add-wine").assertIsDisplayed()
        compose.onNodeWithTag("import-cellar").assertIsDisplayed()
    }

    @Test
    fun bottomNavigationReachesEveryArea() {
        compose.onNodeWithTag("nav-history").performClick()
        compose.onNodeWithTag("history-screen").assertIsDisplayed()

        compose.onNodeWithTag("nav-manage").performClick()
        compose.onNodeWithTag("manage-screen").assertIsDisplayed()

        compose.onNodeWithTag("nav-cellar").performClick()
        awaitEmptyCellar()
    }

    // The cellar's state comes from a Room Flow, which Compose's idling doesn't track.
    @OptIn(ExperimentalTestApi::class)
    private fun awaitEmptyCellar() {
        compose.waitUntilAtLeastOneExists(hasTestTag("cellar-empty"), timeoutMillis = 10_000)
        compose.onNodeWithTag("cellar-empty").assertIsDisplayed()
    }
}
