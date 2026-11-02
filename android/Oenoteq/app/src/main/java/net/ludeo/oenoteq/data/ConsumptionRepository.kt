package net.ludeo.oenoteq.data

import androidx.room.withTransaction
import kotlinx.coroutines.flow.Flow
import net.ludeo.oenoteq.domain.CellarError
import net.ludeo.oenoteq.domain.ConsumptionInput
import net.ludeo.oenoteq.domain.HistoryEntry
import net.ludeo.oenoteq.domain.checked

/**
 * Consumptions, with the rules of the Go `db` layer: recording one takes a
 * bottle off its Wine and is refused at quantity 0; deleting one gives the
 * bottle back. Both happen in the same transaction as the stock change.
 */
class ConsumptionRepository(
    private val database: CellarDatabase,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    private val consumptions = database.consumptionDao()
    private val wines = database.wineDao()

    fun observeForWine(wineId: Long): Flow<List<ConsumptionEntity>> = consumptions.observeForWine(wineId)

    /** Unfiltered and unsorted: see `consumptionHistory`. */
    fun observeHistory(): Flow<List<HistoryEntry>> = consumptions.observeHistory()

    suspend fun create(wineId: Long, input: ConsumptionInput): Long {
        val valid = input.checked()
        return database.withTransaction {
            val wine = wines.find(wineId) ?: throw CellarError(CellarError.Code.WINE_NOT_FOUND)
            if (wine.quantity <= 0) throw CellarError(CellarError.Code.QUANTITY_ZERO)
            val now = clock()
            val id = consumptions.insert(
                ConsumptionEntity(
                    wineId = wineId,
                    date = valid.date,
                    rating = valid.rating,
                    notes = valid.notes,
                    createdAt = now,
                    updatedAt = now,
                ),
            )
            wines.addToQuantity(wineId, -1, now)
            id
        }
    }

    /** Date, rating and notes only: a Consumption never moves to another Wine. */
    suspend fun update(id: Long, input: ConsumptionInput) {
        val valid = input.checked()
        database.withTransaction {
            if (consumptions.find(id) == null) throw CellarError(CellarError.Code.CONSUMPTION_NOT_FOUND)
            consumptions.update(id, valid.date, valid.rating, valid.notes, clock())
        }
    }

    suspend fun delete(id: Long): Unit = database.withTransaction {
        val consumption = consumptions.find(id) ?: throw CellarError(CellarError.Code.CONSUMPTION_NOT_FOUND)
        consumptions.delete(id)
        wines.addToQuantity(consumption.wineId, +1, clock())
    }
}
