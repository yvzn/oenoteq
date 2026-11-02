package net.ludeo.oenoteq.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface AppellationDao {
    @Insert suspend fun insertAll(rows: List<AppellationEntity>)

    @Query("SELECT COUNT(*) FROM appellation") suspend fun count(): Int
}

@Dao
interface ProducerDao {
    @Insert suspend fun insertAll(rows: List<ProducerEntity>)

    @Query("SELECT COUNT(*) FROM producer") suspend fun count(): Int
}

@Dao
interface MealDao {
    @Insert suspend fun insertAll(rows: List<MealEntity>)

    @Query("SELECT COUNT(*) FROM meal") suspend fun count(): Int
}

@Dao
interface WineDao {
    @Insert suspend fun insertAll(rows: List<WineEntity>)

    @Query("SELECT COUNT(*) FROM wine") suspend fun count(): Int

    @Query("SELECT * FROM wine ORDER BY id") suspend fun all(): List<WineEntity>

    @Query("SELECT COUNT(*) FROM wine WHERE quantity > 0") fun observeInStockCount(): Flow<Int>
}

@Dao
interface MealPairingDao {
    @Insert suspend fun insertAll(rows: List<MealPairingEntity>)

    @Query("SELECT COUNT(*) FROM meal_pairing") suspend fun count(): Int
}

@Dao
interface ConsumptionDao {
    @Insert suspend fun insertAll(rows: List<ConsumptionEntity>)

    @Query("SELECT COUNT(*) FROM consumption") suspend fun count(): Int

    @Query("SELECT * FROM consumption ORDER BY id") suspend fun all(): List<ConsumptionEntity>
}

@Dao
interface QuantityAdjustmentDao {
    @Insert suspend fun insertAll(rows: List<QuantityAdjustmentEntity>)

    @Query("SELECT COUNT(*) FROM quantity_adjustment") suspend fun count(): Int
}

@Dao
interface CellarDao {
    @Query(
        """
        SELECT (SELECT COUNT(*) FROM appellation) + (SELECT COUNT(*) FROM producer)
             + (SELECT COUNT(*) FROM meal) + (SELECT COUNT(*) FROM wine)
             + (SELECT COUNT(*) FROM meal_pairing) + (SELECT COUNT(*) FROM consumption)
             + (SELECT COUNT(*) FROM quantity_adjustment)
        """,
    )
    suspend fun totalRows(): Int

    /** True while nothing at all has been recorded: the only state the one-time import accepts. */
    @Query(
        """
        SELECT NOT EXISTS (SELECT 1 FROM appellation) AND NOT EXISTS (SELECT 1 FROM producer)
           AND NOT EXISTS (SELECT 1 FROM meal) AND NOT EXISTS (SELECT 1 FROM wine)
           AND NOT EXISTS (SELECT 1 FROM meal_pairing) AND NOT EXISTS (SELECT 1 FROM consumption)
           AND NOT EXISTS (SELECT 1 FROM quantity_adjustment)
        """,
    )
    fun observeIsEmpty(): Flow<Boolean>
}
