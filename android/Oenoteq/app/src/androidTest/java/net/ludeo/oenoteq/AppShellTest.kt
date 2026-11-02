package net.ludeo.oenoteq

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import net.ludeo.oenoteq.data.CellarDatabase
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.rules.TestRule
import org.junit.runner.Description
import org.junit.runner.RunWith
import org.junit.runners.model.Statement

@RunWith(AndroidJUnit4::class)
class AppShellTest {
    // Fresh, empty cellar before the activity (and with it the database) starts.
    private val emptyCellar = TestRule { base: Statement, _: Description ->
        object : Statement() {
            override fun evaluate() {
                ApplicationProvider.getApplicationContext<OenoteqApplication>().deleteDatabase(CellarDatabase.FILE_NAME)
                base.evaluate()
            }
        }
    }
    private val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule val rules: RuleChain = RuleChain.outerRule(emptyCellar).around(compose)

    @Test
    fun emptyCellarOffersTheImport() {
        awaitEmptyCellar()
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
