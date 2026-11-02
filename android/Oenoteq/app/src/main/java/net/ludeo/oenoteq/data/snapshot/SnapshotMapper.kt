package net.ludeo.oenoteq.data.snapshot

import net.ludeo.oenoteq.data.AppellationEntity
import net.ludeo.oenoteq.data.ConsumptionEntity
import net.ludeo.oenoteq.data.MealEntity
import net.ludeo.oenoteq.data.MealPairingEntity
import net.ludeo.oenoteq.data.ProducerEntity
import net.ludeo.oenoteq.data.QuantityAdjustmentEntity
import net.ludeo.oenoteq.data.WineEntity
import net.ludeo.oenoteq.data.snapshot.SnapshotImportError.InvalidRow
import net.ludeo.oenoteq.data.snapshot.SnapshotImportError.Reason
import net.ludeo.oenoteq.domain.WineColor

/** A snapshot ready to insert as is: ids preserved, every row valid. */
data class MappedCellar(
    val appellations: List<AppellationEntity>,
    val producers: List<ProducerEntity>,
    val meals: List<MealEntity>,
    val wines: List<WineEntity>,
    val mealPairings: List<MealPairingEntity>,
    val consumptions: List<ConsumptionEntity>,
    val adjustments: List<QuantityAdjustmentEntity>,
)

/**
 * Turns snapshot rows into entities, refusing the whole snapshot on the first
 * row that breaks the app's rules or on any row pointing at a missing parent.
 * Pure: no Android, no database.
 */
object SnapshotMapper {

    fun map(rows: SnapshotRows, now: Long): MappedCellar {
        checkOrphans(rows)

        val appellations = names("appellation", rows.appellations).map { (id, name) -> AppellationEntity(id, name) }
        val producers = names("producer", rows.producers).map { (id, name) -> ProducerEntity(id, name) }
        val meals = names("meal", rows.meals).map { (id, name) -> MealEntity(id, name) }

        val wines = rows.wines.map { w ->
            if (w.quantity < 0) throw InvalidRow("wine", w.id, Reason.NEGATIVE_QUANTITY)
            val createdAt = timestamp("wine", w.id, w.createdAt) ?: now
            WineEntity(
                id = w.id,
                millesime = w.millesime,
                appellationId = w.appellationId,
                producerId = w.producerId,
                color = color("wine", w.id, w.color),
                gardeDebut = w.gardeDebut,
                gardeFin = w.gardeFin,
                quantity = w.quantity,
                createdAt = createdAt,
                updatedAt = timestamp("wine", w.id, w.updatedAt) ?: createdAt,
            )
        }

        val mealPairings = rows.mealPairings.mapIndexed { index, p ->
            MealPairingEntity(p.appellationId, color("meal_pairing", index + 1L, p.color), p.mealId)
        }

        val consumptions = rows.consumptions.map { c ->
            if (c.rating != null && c.rating !in 1..5) throw InvalidRow("consumption", c.id, Reason.INVALID_RATING)
            val date = try {
                SnapshotValues.isoDate(c.date)
            } catch (_: IllegalArgumentException) {
                null
            } ?: throw InvalidRow("consumption", c.id, Reason.INVALID_DATE)
            val createdAt = timestamp("consumption", c.id, c.createdAt) ?: now
            ConsumptionEntity(
                id = c.id,
                wineId = c.wineId,
                date = date,
                rating = c.rating,
                notes = c.notes,
                createdAt = createdAt,
                updatedAt = timestamp("consumption", c.id, c.updatedAt) ?: createdAt,
            )
        }

        val adjustments = rows.adjustments.map { a ->
            QuantityAdjustmentEntity(
                id = a.id,
                wineId = a.wineId,
                delta = a.delta,
                reason = a.reason ?: "manual",
                createdAt = timestamp("quantity_adjustment", a.id, a.createdAt) ?: now,
            )
        }

        return MappedCellar(appellations, producers, meals, wines, mealPairings, consumptions, adjustments)
    }

    private fun checkOrphans(rows: SnapshotRows) {
        val appellationIds = rows.appellations.map { it.id }.toSet()
        val producerIds = rows.producers.map { it.id }.toSet()
        val mealIds = rows.meals.map { it.id }.toSet()
        val wineIds = rows.wines.map { it.id }.toSet()

        val counts = mapOf(
            "wine" to rows.wines.count { it.appellationId !in appellationIds || it.producerId !in producerIds },
            "meal_pairing" to rows.mealPairings.count { it.appellationId !in appellationIds || it.mealId !in mealIds },
            "consumption" to rows.consumptions.count { it.wineId !in wineIds },
            "quantity_adjustment" to rows.adjustments.count { it.wineId !in wineIds },
        ).filterValues { it > 0 }
        if (counts.isNotEmpty()) throw SnapshotImportError.OrphanRows(counts)
    }

    // Names stay as stored (no trimming): uniqueness is the backend's, byte for byte.
    private fun names(table: String, rows: List<SnapshotNamed>): List<Pair<Long, String>> {
        val seen = HashSet<String>()
        return rows.map { row ->
            val name = row.name
            if (name.isNullOrBlank()) throw InvalidRow(table, row.id, Reason.BLANK_NAME)
            if (!seen.add(name)) throw InvalidRow(table, row.id, Reason.DUPLICATE_NAME)
            row.id to name
        }
    }

    private fun color(table: String, id: Long, code: String?): WineColor =
        code?.let(WineColor::fromCode) ?: throw InvalidRow(table, id, Reason.INVALID_COLOR)

    private fun timestamp(table: String, id: Long, value: Any?): Long? = try {
        SnapshotValues.epochMillis(value)
    } catch (_: IllegalArgumentException) {
        throw InvalidRow(table, id, Reason.INVALID_TIMESTAMP)
    }
}
