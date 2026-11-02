package net.ludeo.oenoteq.data

import androidx.room.withTransaction
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.combine
import net.ludeo.oenoteq.domain.CellarError
import net.ludeo.oenoteq.domain.CellarSearchData
import net.ludeo.oenoteq.domain.MIN_INITIAL_QUANTITY
import net.ludeo.oenoteq.domain.WineInput

/** Wines, with the rules of the Go `db` layer (`CreateWine`, `UpdateWine`). */
class WineRepository(
    private val database: CellarDatabase,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    private val wines = database.wineDao()

    /** Everything the cellar search needs, re-emitted whenever any of it changes. */
    fun observeSearchData(): Flow<CellarSearchData> = combine(
        wines.observeAllForSearch(),
        database.producerDao().observeAll(),
        database.appellationDao().observeAll(),
        database.mealPairingDao().observeAll(),
        ::CellarSearchData,
    )

    fun observe(id: Long): Flow<WineWithNames?> = wines.observeWithNames(id)

    suspend fun find(id: Long): WineInput? = wines.find(id)?.let {
        WineInput(it.millesime, it.appellationId, it.producerId, it.color, it.gardeDebut, it.gardeFin)
    }

    /**
     * A new Wine always starts in stock (ADR 0007): its initial quantity is
     * written together with the first quantity adjustment that records it.
     */
    suspend fun create(input: WineInput, initialQuantity: Int): Long {
        if (initialQuantity < MIN_INITIAL_QUANTITY) throw CellarError(CellarError.Code.INITIAL_QUANTITY_REQUIRED)
        return database.withTransaction {
            checkReferences(input)
            val now = clock()
            val id = wines.insert(
                WineEntity(
                    millesime = input.millesime,
                    appellationId = input.appellationId,
                    producerId = input.producerId,
                    color = input.color,
                    gardeDebut = input.gardeDebut,
                    gardeFin = input.gardeFin,
                    quantity = initialQuantity,
                    createdAt = now,
                    updatedAt = now,
                ),
            )
            database.quantityAdjustmentDao().insert(
                QuantityAdjustmentEntity(wineId = id, delta = initialQuantity, createdAt = now),
            )
            id
        }
    }

    /** Never touches the quantity, which only Consumptions and adjustments change. */
    suspend fun update(id: Long, input: WineInput): Unit = database.withTransaction {
        if (wines.find(id) == null) throw CellarError(CellarError.Code.WINE_NOT_FOUND)
        checkReferences(input)
        wines.updateFields(
            id, input.millesime, input.appellationId, input.producerId, input.color,
            input.gardeDebut, input.gardeFin, clock(),
        )
    }

    private suspend fun checkReferences(input: WineInput) {
        if (database.appellationDao().find(input.appellationId) == null) {
            throw CellarError(CellarError.Code.APPELLATION_NOT_FOUND)
        }
        if (database.producerDao().find(input.producerId) == null) {
            throw CellarError(CellarError.Code.PRODUCER_NOT_FOUND)
        }
    }
}
