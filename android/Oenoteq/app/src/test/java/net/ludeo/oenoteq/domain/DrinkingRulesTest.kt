package net.ludeo.oenoteq.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.fail
import org.junit.Test

// The Consumption History order follows the Go `sortConsumptionHistorySQL`; the form rules `validateConsumption`.
class DrinkingRulesTest {
    private val margaux = 1L
    private val chablis = 2L

    private fun entry(id: Long, date: String, producer: String, appellation: Long, color: WineColor, millesime: Int?) =
        HistoryEntry(
            id = id,
            wineId = id * 10,
            date = date,
            producerName = producer,
            appellationId = appellation,
            appellationName = if (appellation == margaux) "Margaux" else "Chablis",
            color = color,
            millesime = millesime,
        )

    private val entries = listOf(
        entry(1, "2025-12-24", "Palmer", margaux, WineColor.ROUGE, 2015),
        entry(2, "2026-03-15", "Palmer", margaux, WineColor.ROUGE, 2015),
        entry(3, "2026-03-15", "Laroche", chablis, WineColor.BLANC, 2020),
        entry(4, "2026-05-01", "Bollinger", chablis, WineColor.BLANC, null),
        entry(5, "2024-01-10", "Zeta", margaux, WineColor.ROUGE, 2010),
    )

    private fun ids(filters: SearchFilters = SearchFilters(), sort: HistorySort = HistorySort(), pairings: List<MealPairing> = emptyList()) =
        consumptionHistory(entries, pairings, filters, sort).map { it.id }

    @Test
    fun `newest first by default, the later recorded first on the same day`() {
        assertEquals(listOf(4L, 3, 2, 1, 5), ids())
        assertEquals(listOf(5L, 1, 3, 2, 4), ids(sort = HistorySort(HistorySortBy.DATE, SortDir.ASC)))
    }

    @Test
    fun `other axes fall back to newest first`() {
        assertEquals(listOf(4L, 3, 2, 1, 5), ids(sort = HistorySort(HistorySortBy.PRODUCER, SortDir.ASC)))
        assertEquals(listOf(5L, 2, 1, 3, 4), ids(sort = HistorySort(HistorySortBy.PRODUCER, SortDir.DESC)))
        assertEquals(listOf(4L, 3, 2, 1, 5), ids(sort = HistorySort(HistorySortBy.APPELLATION, SortDir.ASC)))
    }

    @Test
    fun `wines without a millesime come last in both directions`() {
        assertEquals(listOf(5L, 2, 1, 3, 4), ids(sort = HistorySort(HistorySortBy.MILLESIME, SortDir.ASC)))
        assertEquals(listOf(3L, 2, 1, 5, 4), ids(sort = HistorySort(HistorySortBy.MILLESIME, SortDir.DESC)))
    }

    @Test
    fun `filters work on the consumed wine, meal through the current pairings`() {
        assertEquals(listOf(4L, 3), ids(SearchFilters(appellationId = chablis)))
        assertEquals(listOf(2L, 1, 5), ids(SearchFilters(color = WineColor.ROUGE)))
        val oysters = 7L
        assertEquals(
            listOf(4L, 3),
            ids(SearchFilters(mealId = oysters), pairings = listOf(MealPairing(chablis, WineColor.BLANC, oysters))),
        )
        assertEquals(emptyList<Long>(), ids(SearchFilters(mealId = oysters)))
    }

    @Test
    fun `a consumption needs a real ISO date and a rating from 1 to 5`() {
        refused(CellarError.Code.DATE_REQUIRED) { ConsumptionInput(" ", null, null).checked() }
        refused(CellarError.Code.INVALID_DATE) { ConsumptionInput("24/12/2025", null, null).checked() }
        refused(CellarError.Code.INVALID_DATE) { ConsumptionInput("2026-02-30", null, null).checked() }
        refused(CellarError.Code.INVALID_RATING) { ConsumptionInput("2026-02-28", 6, null).checked() }
        refused(CellarError.Code.INVALID_RATING) { ConsumptionInput("2026-02-28", 0, null).checked() }
        assertEquals(ConsumptionInput("2026-02-28", 5, "Superbe"), ConsumptionInput("2026-02-28", 5, "Superbe").checked())
    }

    @Test
    fun `blank notes are stored as none`() {
        assertNull(ConsumptionInput("2026-02-28", null, "  ").checked().notes)
    }

    @Test
    fun `a quantity correction is a whole non-zero number, signed or not`() {
        assertEquals(-1, parseQuantityDelta("-1"))
        assertEquals(3, parseQuantityDelta(" +3 "))
        assertEquals(2, parseQuantityDelta("2"))
        assertNull(parseQuantityDelta("0"))
        assertNull(parseQuantityDelta("1.5"))
        assertNull(parseQuantityDelta(""))
    }

    private fun refused(code: CellarError.Code, block: () -> Unit) {
        try {
            block()
            fail("expected $code")
        } catch (e: CellarError) {
            assertEquals(code, e.code)
        }
    }
}
