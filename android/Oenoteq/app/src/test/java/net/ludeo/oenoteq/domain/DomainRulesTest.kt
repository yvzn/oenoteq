package net.ludeo.oenoteq.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

// Cases ported from web/src/domain/{gardeStatus,pagination,wineSort,wineForm,nameForm}.test.ts.
class DomainRulesTest {
    @Test
    fun `Garde Status follows the drinking window`() {
        assertEquals(GardeStatus.UNASSESSED, gardeStatus(null, null, 2026))
        assertEquals(GardeStatus.TOO_YOUNG, gardeStatus(2027, 2030, 2026))
        assertEquals(GardeStatus.READY, gardeStatus(2026, 2026, 2026))
        assertEquals(GardeStatus.READY, gardeStatus(2020, null, 2026))
        assertEquals(GardeStatus.READY, gardeStatus(null, 2030, 2026))
        assertEquals(GardeStatus.PAST_PEAK, gardeStatus(2010, 2025, 2026))
        assertEquals(GardeStatus.PAST_PEAK, gardeStatus(null, 2025, 2026))
    }

    @Test
    fun `pagination slices ten at a time and clamps`() {
        val all = (1..23).toList()

        assertEquals(Page((1..10).toList(), 1, 3, 23), paginate(all, 1))
        assertEquals(Page(listOf(21, 22, 23), 3, 3, 23), paginate(all, 3))
        assertEquals(3, paginate(all, 99).page)
        assertEquals(1, paginate(all, 0).page)
        assertEquals(Page(emptyList<Int>(), 1, 1, 0), paginate(emptyList<Int>(), 2))
    }

    @Test
    fun `next sort switches axis ascending or flips the current one`() {
        val default = WineSort()

        assertEquals(WineSort(SortBy.APPELLATION, SortDir.ASC), default)
        assertEquals(WineSort(SortBy.PRODUCER, SortDir.ASC), default.next(SortBy.PRODUCER))
        assertEquals(WineSort(SortBy.APPELLATION, SortDir.DESC), default.next(SortBy.APPELLATION))
        assertEquals(default, default.next(SortBy.APPELLATION).next(SortBy.APPELLATION))
    }

    @Test
    fun `filters count what is active`() {
        assertEquals(0, SearchFilters().activeCount)
        assertEquals(2, SearchFilters(color = WineColor.ROUGE, readyNow = true).activeCount)
        assertEquals(4, SearchFilters(1, 2, WineColor.BLANC, true).activeCount)
    }

    @Test
    fun `wine form requires appellation, producer and color`() {
        val errors = validateWineForm(WineFormFields(), isNew = false)

        assertEquals(
            mapOf(
                WineFormField.APPELLATION to WineFormError.APPELLATION_REQUIRED,
                WineFormField.PRODUCER to WineFormError.PRODUCER_REQUIRED,
                WineFormField.COLOR to WineFormError.COLOR_REQUIRED,
            ),
            errors,
        )
    }

    @Test
    fun `wine form refuses a garde end before its start`() {
        val fields = valid.copy(gardeDebut = "2030", gardeFin = "2025")

        assertEquals(mapOf(WineFormField.GARDE_FIN to WineFormError.GARDE_END_BEFORE_START), validateWineForm(fields, false))
        assertTrue(validateWineForm(valid.copy(gardeDebut = "2030", gardeFin = "2030"), false).isEmpty())
    }

    @Test
    fun `wine form checks the initial quantity only for a new wine`() {
        val noQuantity = valid.copy(quantity = "0")

        assertEquals(mapOf(WineFormField.QUANTITY to WineFormError.QUANTITY_MIN), validateWineForm(noQuantity, true))
        assertEquals(WineFormError.QUANTITY_MIN, validateWineForm(valid.copy(quantity = ""), true)[WineFormField.QUANTITY])
        assertTrue(validateWineForm(noQuantity, false).isEmpty())
    }

    @Test
    fun `wine form refuses years that are not numbers`() {
        val errors = validateWineForm(valid.copy(millesime = "20x5", gardeDebut = " "), false)

        assertEquals(mapOf(WineFormField.MILLESIME to WineFormError.NOT_A_YEAR), errors)
    }

    @Test
    fun `wine form turns blank years into null`() {
        val input = valid.copy(millesime = " 2019 ", gardeDebut = "", gardeFin = "").toInput()

        assertEquals(WineInput(2019, 1, 2, WineColor.ROUGE, null, null), input)
        assertEquals(WineFormFields("2019", 1, 2, WineColor.ROUGE, "", "", quantity = "1"), input.toFormFields())
    }

    @Test
    fun `garde end defaults to its start only when empty`() {
        assertEquals("2028", deriveGardeFin("2028", ""))
        assertEquals("2030", deriveGardeFin("2028", "2030"))
    }

    @Test
    fun `autocomplete offers create only without an exact match, ignoring case`() {
        val names = listOf("Margaux", "Chablis")

        assertFalse(offersCreate("  margaux ", names))
        assertFalse(offersCreate("   ", names))
        assertTrue(offersCreate("Marg", names))
        assertEquals(listOf("Margaux"), matching("ARG", names) { it })
        assertEquals(names, matching("", names) { it })
    }

    private val valid = WineFormFields(
        millesime = "2015",
        appellationId = 1,
        producerId = 2,
        color = WineColor.ROUGE,
        gardeDebut = "2020",
        gardeFin = "2030",
        quantity = "3",
    )
}
