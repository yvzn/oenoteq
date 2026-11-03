package net.ludeo.oenoteq

import androidx.appcompat.app.AppCompatDelegate
import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assert
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.core.os.LocaleListCompat
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.domain.WineColor
import net.ludeo.oenoteq.domain.WineInput
import net.ludeo.oenoteq.ui.components.Highlighted
import org.junit.After
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.runner.RunWith

/** Language switch, confirmation messages and highlights. */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class PolishTest {
    private val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule val rules: RuleChain = RuleChain.outerRule(EmptyCellarRule()).around(compose)

    // The choice outlives the test process otherwise, and every other test reads English.
    @After
    fun backToThePhoneLanguage() {
        InstrumentationRegistry.getInstrumentation().runOnMainSync {
            AppCompatDelegate.setApplicationLocales(LocaleListCompat.getEmptyLocaleList())
        }
    }

    @Test
    fun theLanguageToggleSwitchesTheWholeAppAndKeepsTheTab() {
        compose.onNodeWithTag("nav-manage").performClick()
        compose.onNodeWithTag("language-fr").performClick()

        await(hasText("Gérer"))
        compose.onNodeWithText("Producteurs").assertExists()
        compose.onNodeWithTag("manage-screen").assertExists()

        compose.onNodeWithTag("language-en").performClick()
        await(hasText("Producers"))
    }

    @Test
    fun savingAWineConfirmsItOnTheWinePage() {
        val (appellation, producer) = runBlocking {
            container.referentials(Referential.APPELLATION).create("Margaux") to
                container.referentials(Referential.PRODUCER).create("Château Palmer")
        }
        await(hasTestTag("empty-add-wine"))
        compose.onNodeWithTag("empty-add-wine").performClick()
        compose.onNodeWithTag("appellation-field").performTextInput(appellation.name)
        compose.onNodeWithTag("producer-field").performTextInput(producer.name)
        compose.onNodeWithTag("color-rouge").performClick()
        compose.onNodeWithTag("wine-save").performScrollTo().performClick()

        await(hasTestTag("wine-detail"))
        await(hasTestTag("notice"))
        compose.onNodeWithText(compose.activity.getString(R.string.notice_wine_added)).assertExists()
    }

    @Test
    fun aDeleteIsConfirmedAndTheMessageIsDroppedOnNavigation() {
        runBlocking { container.referentials(Referential.MEAL).create("Plateau de fromages") }
        compose.onNodeWithTag("nav-manage").performClick()
        compose.onNodeWithTag("manage-meal").performClick()
        await(hasTestTag("referential-delete-Plateau de fromages"))
        compose.onNodeWithTag("referential-delete-Plateau de fromages").performClick()
        compose.onNodeWithTag("confirm").performClick()

        await(hasText(compose.activity.getString(R.string.notice_deleted, "Plateau de fromages")))

        compose.onNodeWithTag("nav-cellar").performClick()
        compose.waitUntilDoesNotExist(hasTestTag("notice"), timeoutMillis = 5_000)
    }

    @Test
    fun aRecordedConsumptionIsHighlightedInsteadOfConfirmed() {
        runBlocking {
            val appellation = container.referentials(Referential.APPELLATION).create("Chablis")
            val producer = container.referentials(Referential.PRODUCER).create("Laroche")
            container.wines.create(WineInput(2020, appellation.id, producer.id, WineColor.BLANC, null, null), 2)
        }
        await(hasTestTag("wine-item"))
        compose.onNodeWithTag("wine-item").performClick()
        await(hasTestTag("wine-detail"))

        compose.onNodeWithTag("consumption-record-submit").performScrollTo().performClick()

        await(hasTestTag("consumption-entry"))
        val highlighted = SemanticsMatcher.expectValue(Highlighted, true)
        compose.onNodeWithTag("consumption-entry").assert(highlighted)
        compose.onNodeWithTag("quantity-adjust").assert(highlighted)
        compose.onNodeWithTag("wine-quantity", useUnmergedTree = true).assertTextEquals("×1")
        compose.onNodeWithTag("notice").assertDoesNotExist()
    }

    private fun await(matcher: SemanticsMatcher) = compose.waitUntilAtLeastOneExists(matcher, timeoutMillis = 10_000)
}
