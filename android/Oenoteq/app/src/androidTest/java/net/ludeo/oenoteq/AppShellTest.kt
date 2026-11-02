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

@OptIn(ExperimentalTestApi::class)
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
        compose.onNodeWithTag("history-empty").assertIsDisplayed()

        compose.onNodeWithTag("nav-manage").performClick()
        compose.onNodeWithTag("manage-screen").assertIsDisplayed()

        compose.onNodeWithTag("nav-cellar").performClick()
        awaitEmptyCellar()
    }

    @Test
    fun tappingTheSelectedTabReturnsToItsTopScreen() {
        awaitEmptyCellar()
        compose.onNodeWithTag("empty-add-wine").performClick()
        compose.onNodeWithTag("wine-form").assertIsDisplayed()

        compose.onNodeWithTag("nav-cellar").performClick()
        awaitEmptyCellar()

        compose.onNodeWithTag("nav-manage").performClick()
        compose.onNodeWithTag("manage-producer").performClick()
        compose.waitUntilAtLeastOneExists(hasTestTag("referential-add"), timeoutMillis = 10_000)
        compose.onNodeWithTag("nav-manage").performClick()
        compose.onNodeWithTag("manage-screen").assertIsDisplayed()
    }

    @Test
    fun anotherTabComesBackWhereItWasLeft() {
        awaitEmptyCellar()
        compose.onNodeWithTag("empty-add-wine").performClick()

        compose.onNodeWithTag("nav-manage").performClick()
        compose.onNodeWithTag("nav-cellar").performClick()

        compose.onNodeWithTag("wine-form").assertIsDisplayed()
    }

    // The cellar's state comes from a Room Flow, which Compose's idling doesn't track.
    private fun awaitEmptyCellar() {
        compose.waitUntilAtLeastOneExists(hasTestTag("cellar-empty"), timeoutMillis = 10_000)
        compose.onNodeWithTag("cellar-empty").assertIsDisplayed()
    }
}
