package net.ludeo.oenoteq

import androidx.compose.ui.test.ExperimentalTestApi
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.assertCountEquals
import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.assertTextContains
import androidx.compose.ui.test.assertTextEquals
import androidx.compose.ui.test.hasTestTag
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.v2.createAndroidComposeRule
import androidx.compose.ui.test.onAllNodesWithTag
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithTag
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.compose.ui.test.performTextReplacement
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.domain.WineColor
import net.ludeo.oenoteq.domain.WineInput
import org.junit.Rule
import org.junit.Test
import org.junit.rules.RuleChain
import org.junit.runner.RunWith

/** One tracer per main milestone-2 flow, on the app's real database. */
@OptIn(ExperimentalTestApi::class)
@RunWith(AndroidJUnit4::class)
class CellarFlowsTest {
    private val compose = createAndroidComposeRule<MainActivity>()

    @get:Rule val rules: RuleChain = RuleChain.outerRule(EmptyCellarRule()).around(compose)

    @Test
    fun addAWineCreatingItsAppellationAndProducerThenSeeItInTheList() {
        await(hasTestTag("empty-add-wine"))
        compose.onNodeWithTag("empty-add-wine").performClick()

        compose.onNodeWithTag("appellation-field").performTextInput("Margaux")
        compose.onNodeWithTag("appellation-field-create").performClick()
        compose.onNodeWithTag("producer-field").performTextInput("Château Palmer")
        compose.onNodeWithTag("producer-field-create").performClick()
        compose.onNodeWithTag("color-rouge").performClick()
        compose.onNodeWithTag("millesime-input").performTextInput("2015")
        compose.onNodeWithTag("garde-debut-input").performScrollTo().performTextInput("2022")
        compose.onNodeWithTag("garde-fin-input").performTextInput("2040")
        compose.onNodeWithTag("quantity-increment").performScrollTo().performClick()
        compose.onNodeWithTag("wine-save").performScrollTo().performClick()

        await(hasTestTag("wine-detail"))
        compose.onNodeWithTag("wine-producer").assertTextEquals("Château Palmer")
        compose.onNodeWithTag("wine-quantity").assertTextEquals("×2")
        compose.onNodeWithTag("wine-garde").assertTextContains("2022–2040", substring = true)

        compose.onNodeWithTag("back").performClick()
        await(hasTestTag("wine-item"))
        compose.onNodeWithTag("wine-item-producer", useUnmergedTree = true).assertTextEquals("Château Palmer")
    }

    @Test
    fun theWineFormSaysWhatIsMissing() {
        await(hasTestTag("empty-add-wine"))
        compose.onNodeWithTag("empty-add-wine").performClick()

        compose.onNodeWithTag("wine-save").performScrollTo().performClick()

        compose.onNodeWithTag("appellation-field-error", useUnmergedTree = true).performScrollTo().assertIsDisplayed()
        compose.onNodeWithTag("producer-field-error", useUnmergedTree = true).assertIsDisplayed()
        compose.onNodeWithTag("color-error").assertIsDisplayed()
    }

    @Test
    fun deletingAProducerUsedByAWineIsRefused() {
        seedWines(1)

        compose.onNodeWithTag("nav-manage").performClick()
        compose.onNodeWithTag("manage-producer").performClick()
        await(hasTestTag("referential-delete-Producer 01"))
        compose.onNodeWithTag("referential-delete-Producer 01").performClick()
        compose.onNodeWithTag("confirm").performClick()

        await(hasTestTag("referential-error"))
        compose.onNodeWithTag("referential-error")
            .assertTextEquals(compose.activity.getString(R.string.error_producer_in_use))
        compose.onAllNodesWithTag("referential-item").assertCountEquals(1)
    }

    @Test
    fun renamingAnAppellationShowsTheNewName() {
        seedWines(1)

        compose.onNodeWithTag("nav-manage").performClick()
        compose.onNodeWithTag("manage-appellation").performClick()
        await(hasTestTag("referential-rename-Appellation"))
        compose.onNodeWithTag("referential-rename-Appellation").performClick()
        compose.onNodeWithTag("name-input").performTextReplacement("Appellation Bandol")
        compose.onNodeWithTag("name-save").performClick()

        await(hasText("Appellation Bandol"))
    }

    @Test
    fun sortPageAndFilterSurviveAVisitToAWine() {
        seedWines(12)
        awaitPagination()

        compose.onNodeWithTag("open-sort").performClick()
        compose.onNodeWithTag("sort-producer").performClick()
        compose.onNodeWithTag("sort-dir-desc").performClick()
        Espresso.pressBack()
        awaitPagination()
        compose.onNodeWithTag("pagination-next").performClick()
        await(hasText(compose.activity.getString(R.string.pagination_status, 2, 2)))
        compose.onAllNodesWithTag("wine-item-producer", useUnmergedTree = true).onFirst().assertTextEquals("Producer 02")

        compose.onAllNodesWithTag("wine-item").onFirst().performClick()
        await(hasTestTag("wine-detail"))
        compose.onNodeWithTag("back").performClick()

        await(hasTestTag("pagination-status"))
        compose.onNodeWithTag("pagination-status").assertTextEquals(compose.activity.getString(R.string.pagination_status, 2, 2))
        compose.onAllNodesWithTag("wine-item-producer", useUnmergedTree = true).onFirst().assertTextEquals("Producer 02")

        compose.onNodeWithTag("open-filters").performClick()
        compose.onNodeWithTag("filter-color-blanc").performClick()
        Espresso.pressBack()
        // Wines alternate rouge / blanc: six white ones, one page, producer descending.
        await(hasTestTag("clear-filters"))
        compose.onNodeWithTag("screen-title").assertTextEquals(compose.activity.resources.getQuantityString(R.plurals.cellar_count, 6, 6))
        compose.onAllNodesWithTag("wine-item-producer", useUnmergedTree = true).onFirst().assertTextEquals("Producer 12")

        compose.onNodeWithTag("clear-filters").performClick()
        awaitPagination()
    }

    /** Wines "Producer 01"… sharing one Appellation, alternating red and white, all ready to drink. */
    private fun seedWines(count: Int) = runBlocking {
        val appellation = container.referentials(Referential.APPELLATION).create("Appellation")
        val producers = container.referentials(Referential.PRODUCER)
        for (n in 1..count) {
            val producer = producers.create("Producer %02d".format(n))
            container.wines.create(
                WineInput(
                    millesime = 2000 + n,
                    appellationId = appellation.id,
                    producerId = producer.id,
                    color = if (n % 2 == 1) WineColor.ROUGE else WineColor.BLANC,
                    gardeDebut = 2020,
                    gardeFin = 2050,
                ),
                initialQuantity = 1,
            )
        }
    }

    /** The pager is the list's last row: below the fold on a small phone. */
    private fun awaitPagination() {
        await(hasTestTag("wine-item"))
        compose.onNodeWithTag("wine-list").performScrollToNode(hasTestTag("pagination"))
    }

    // Room Flows aren't tracked by Compose's idling, so screens fed by them are awaited.
    private fun await(matcher: SemanticsMatcher) =
        compose.waitUntilAtLeastOneExists(matcher, timeoutMillis = 10_000)
}
