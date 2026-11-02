package net.ludeo.oenoteq

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertIsSelected
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import net.ludeo.oenoteq.domain.ConsumptionInput
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.domain.WineColor
import net.ludeo.oenoteq.domain.WineInput
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.runner.RunWith

/** One tracer per milestone-3 flow, on the app's real database. */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class DrinkingFlowsTest {
    private val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule val rules: RuleChain = RuleChain.outerRule(EmptyCellarRule()).around(compose)

    @Test
    fun recordingAConsumptionTakesABottleAndShowsInTheHistory() {
        seedWine(quantity = 2)
        openTheWine()

        compose.onNodeWithTag("consumption-record-rating-4").performScrollTo().performClick()
        compose.onNodeWithTag("consumption-record-notes").performScrollTo().performTextInput("Minéral")
        compose.onNodeWithTag("consumption-record-submit").performScrollTo().performClick()

        await(hasText("×1"))
        compose.onAllNodesWithTag("consumption-entry").assertCountEquals(1)

        compose.onNodeWithTag("nav-history").performClick()
        await(hasTestTag("history-item"))
        compose.onNodeWithTag("history-item-producer", useUnmergedTree = true).assertTextEquals("Laroche")

        // The Wine opens inside the History tab, and the selected tab brings the list back.
        compose.onNodeWithTag("history-item").performClick()
        await(hasTestTag("wine-detail"))
        compose.onNodeWithTag("nav-history").assertIsSelected()
        compose.onNodeWithTag("nav-history").performClick()
        await(hasTestTag("history-list"))
    }

    @Test
    fun deletingTheLastConsumptionGivesTheBottleBack() {
        seedWine(quantity = 0, consumedOn = "2026-03-15")
        openTheWine()
        compose.onNodeWithTag("consumption-blocked").performScrollTo().assertIsDisplayed()

        val consumptionId = runBlocking { container.database.consumptionDao().all().single().id }
        compose.onNodeWithTag("consumption-delete-$consumptionId").performScrollTo().performClick()
        compose.onNodeWithTag("confirm").performClick()

        await(hasText("×1"))
        compose.onAllNodesWithTag("consumption-entry").assertCountEquals(0)
    }

    @Test
    fun aStockCorrectionCannotGoBelowZero() {
        seedWine(quantity = 2)
        openTheWine()

        compose.onNodeWithTag("quantity-adjust").performClick()
        compose.onNodeWithTag("adjust-input").performTextInput("-5")
        compose.onNodeWithTag("adjust-submit").performClick()
        await(hasTestTag("adjust-error"))

        compose.onNodeWithTag("adjust-input").performTextReplacement("+3")
        compose.onNodeWithTag("adjust-submit").performClick()
        await(hasText("×5"))
    }

    @Test
    fun aMealCreatedOnThePairingScreenIsSuggestedForTheWine() {
        seedWine(quantity = 1)
        openTheWine()

        compose.onNodeWithTag("edit-pairings").performScrollTo().performClick()
        await(hasTestTag("pairing-meal"))
        compose.onNodeWithTag("pairing-meal").performTextInput("Huîtres")
        compose.onNodeWithTag("pairing-meal-create").performClick()
        await(hasTestTag("paired-meal"))
        compose.onNodeWithTag("paired-meal-name", useUnmergedTree = true).assertTextEquals("Huîtres")

        compose.onNodeWithTag("back").performClick()
        await(hasTestTag("suggested-meal"))
        compose.onNodeWithTag("suggested-meal").assertTextEquals("• Huîtres")
    }

    /** "Laroche" Chablis 2020, white, with [quantity] bottles left after an optional Consumption. */
    private fun seedWine(quantity: Int, consumedOn: String? = null) = runBlocking {
        val appellation = container.referentials(Referential.APPELLATION).create("Chablis")
        val producer = container.referentials(Referential.PRODUCER).create("Laroche")
        val bought = if (consumedOn == null) quantity else quantity + 1
        val id = container.wines.create(
            WineInput(2020, appellation.id, producer.id, WineColor.BLANC, 2021, 2030),
            initialQuantity = bought,
        )
        if (consumedOn != null) container.consumptions.create(id, ConsumptionInput(consumedOn, null, null))
    }

    private fun openTheWine() {
        await(hasTestTag("wine-item").or(hasTestTag("cellar-empty")))
        if (compose.onAllNodesWithTag("wine-item").fetchSemanticsNodes().isNotEmpty()) {
            compose.onNodeWithTag("wine-item").performClick()
        } else {
            // A Wine with no bottle left isn't in the cellar list: reach it from the History.
            compose.onNodeWithTag("nav-history").performClick()
            await(hasTestTag("history-item"))
            compose.onNodeWithTag("history-item").performClick()
        }
        await(hasTestTag("wine-detail"))
    }

    // Room Flows aren't tracked by Compose's idling, so screens fed by them are awaited.
    private fun await(matcher: SemanticsMatcher) = compose.waitUntilAtLeastOneExists(matcher, timeoutMillis = 10_000)
}
