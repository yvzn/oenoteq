package net.ludeo.oenoteq.data.snapshot

import net.ludeo.oenoteq.data.snapshot.SnapshotImportError.Reason
import net.ludeo.oenoteq.domain.WineColor
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class SnapshotMapperTest {
    private val now = 1_000L

    private val valid = SnapshotRows(
        appellations = listOf(SnapshotNamed(1, "Margaux")),
        producers = listOf(SnapshotNamed(7, "Château Palmer")),
        meals = listOf(SnapshotNamed(3, "Agneau rôti")),
        wines = listOf(
            SnapshotWine(
                id = 10, millesime = 2015, appellationId = 1, producerId = 7, color = "rouge",
                gardeDebut = 2022, gardeFin = null, quantity = 2,
                createdAt = "2026-01-01 00:00:00", updatedAt = null,
            ),
        ),
        mealPairings = listOf(SnapshotMealPairing(1, "rouge", 3)),
        consumptions = listOf(SnapshotConsumption(20, 10, "2026-02-01", 4, "Bien", null, null)),
        adjustments = listOf(SnapshotAdjustment(30, 10, 3, "manual", "2026-01-01 00:00:00")),
    )

    @Test
    fun `keeps ids and values and fills missing timestamps`() {
        val cellar = SnapshotMapper.map(valid, now)

        val wine = cellar.wines.single()
        assertEquals(10L, wine.id)
        assertEquals(7L, wine.producerId)
        assertEquals(WineColor.ROUGE, wine.color)
        assertEquals(2, wine.quantity)
        assertEquals(wine.createdAt, wine.updatedAt) // null updated_at falls back to created_at
        val consumption = cellar.consumptions.single()
        assertEquals(20L, consumption.id)
        assertEquals("2026-02-01", consumption.date)
        assertEquals(now, consumption.createdAt) // null created_at falls back to import time
        assertEquals(3, cellar.adjustments.single().delta)
        assertEquals(WineColor.ROUGE, cellar.mealPairings.single().color)
    }

    @Test
    fun `refuses orphan rows with a count per table`() {
        val rows = valid.copy(
            consumptions = valid.consumptions + SnapshotConsumption(21, 99, "2026-02-01", null, null, null, null),
            mealPairings = valid.mealPairings + SnapshotMealPairing(1, "blanc", 42),
            adjustments = valid.adjustments + SnapshotAdjustment(31, 98, 1, "manual", null),
        )

        val error = assertThrows(SnapshotImportError.OrphanRows::class.java) { SnapshotMapper.map(rows, now) }

        assertEquals(mapOf("meal_pairing" to 1, "consumption" to 1, "quantity_adjustment" to 1), error.countsByTable)
    }

    @Test
    fun `refuses a wine whose producer is missing`() {
        val rows = valid.copy(producers = emptyList(), wines = valid.wines)

        val error = assertThrows(SnapshotImportError.OrphanRows::class.java) { SnapshotMapper.map(rows, now) }

        assertEquals(mapOf("wine" to 1), error.countsByTable)
    }

    @Test
    fun `refuses rows breaking the app's rules`() {
        assertInvalid("producer", 8, Reason.BLANK_NAME, valid.copy(producers = valid.producers + SnapshotNamed(8, " ")))
        assertInvalid("meal", 4, Reason.DUPLICATE_NAME, valid.copy(meals = valid.meals + SnapshotNamed(4, "Agneau rôti")))
        assertInvalid("wine", 10, Reason.INVALID_COLOR, valid.copy(wines = listOf(valid.wines[0].copy(color = "orange"))))
        assertInvalid("wine", 10, Reason.NEGATIVE_QUANTITY, valid.copy(wines = listOf(valid.wines[0].copy(quantity = -1))))
        assertInvalid(
            "wine", 10, Reason.INVALID_TIMESTAMP,
            valid.copy(wines = listOf(valid.wines[0].copy(createdAt = "not a time"))),
        )
        assertInvalid(
            "consumption", 20, Reason.INVALID_RATING,
            valid.copy(consumptions = listOf(valid.consumptions[0].copy(rating = 6))),
        )
        assertInvalid(
            "consumption", 20, Reason.INVALID_DATE,
            valid.copy(consumptions = listOf(valid.consumptions[0].copy(date = null))),
        )
        assertInvalid(
            "meal_pairing", 1, Reason.INVALID_COLOR,
            valid.copy(mealPairings = listOf(SnapshotMealPairing(1, "vert", 3))),
        )
    }

    @Test
    fun `names are unique byte for byte, as on the backend`() {
        val rows = valid.copy(meals = valid.meals + SnapshotNamed(4, "agneau rôti"))

        assertEquals(2, SnapshotMapper.map(rows, now).meals.size)
    }

    private fun assertInvalid(table: String, id: Long, reason: Reason, rows: SnapshotRows) {
        val error = assertThrows(SnapshotImportError.InvalidRow::class.java) { SnapshotMapper.map(rows, now) }
        assertEquals(table, error.table)
        assertEquals(id, error.id)
        assertEquals(reason, error.reason)
    }
}
