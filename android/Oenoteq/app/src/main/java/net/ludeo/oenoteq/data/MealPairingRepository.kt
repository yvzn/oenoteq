package net.ludeo.oenoteq.data

import androidx.room.withTransaction
import kotlinx.coroutines.flow.Flow
import net.ludeo.oenoteq.domain.CellarError
import net.ludeo.oenoteq.domain.MealPairing
import net.ludeo.oenoteq.domain.NamedItem
import net.ludeo.oenoteq.domain.WineColor

/** Meal Pairings: which Meals go with an Appellation in a Color (`CreateMealPairing`, `DeleteMealPairing`). */
class MealPairingRepository(private val database: CellarDatabase) {
    private val pairings = database.mealPairingDao()

    fun observeAll(): Flow<List<MealPairing>> = pairings.observeAll()

    /** Sorted by name; also a Wine's suggested Meals. */
    fun observeMeals(appellationId: Long, color: WineColor): Flow<List<NamedItem>> =
        pairings.observeMeals(appellationId, color)

    /** Adding a pairing that already exists changes nothing. */
    suspend fun add(appellationId: Long, color: WineColor, mealId: Long): Unit = database.withTransaction {
        checkReferences(appellationId, mealId)
        pairings.insertIfMissing(MealPairingEntity(appellationId, color, mealId))
    }

    suspend fun remove(appellationId: Long, color: WineColor, mealId: Long): Unit = database.withTransaction {
        checkReferences(appellationId, mealId)
        pairings.delete(appellationId, color, mealId)
    }

    private suspend fun checkReferences(appellationId: Long, mealId: Long) {
        if (database.appellationDao().find(appellationId) == null) {
            throw CellarError(CellarError.Code.APPELLATION_NOT_FOUND)
        }
        if (database.mealDao().find(mealId) == null) throw CellarError(CellarError.Code.MEAL_NOT_FOUND)
    }
}
