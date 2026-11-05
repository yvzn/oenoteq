package net.ludeo.oenoteq.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow
import net.ludeo.oenoteq.domain.CellarWine
import net.ludeo.oenoteq.domain.HistoryEntry
import net.ludeo.oenoteq.domain.MealPairing
import net.ludeo.oenoteq.domain.NamedItem
import net.ludeo.oenoteq.domain.WineColor

/**
 * What Producers, Appellations and Meals share: a table of unique names.
 * Lists are in plain `ORDER BY name` (BINARY collation), like the server and
 * the PWA (`web/src/db/sortByName.ts`).
 */
interface NamedDao {
    fun observeAll(): Flow<List<NamedItem>>

    suspend fun find(id: Long): NamedItem?

    suspend fun findByName(name: String): NamedItem?

    suspend fun insert(name: String): Long

    suspend fun rename(id: Long, name: String): Int

    suspend fun delete(id: Long): Int

    /** True while a Wine or a Meal Pairing still points at the row. */
    suspend fun isInUse(id: Long): Boolean
}

@Dao
interface AppellationDao : NamedDao {
    @Insert suspend fun insertAll(rows: List<AppellationEntity>)

    @Query("SELECT COUNT(*) FROM appellation") suspend fun count(): Int

    @Query("SELECT * FROM appellation ORDER BY id") suspend fun all(): List<AppellationEntity>

    @Query("SELECT id, name FROM appellation ORDER BY name")
    override fun observeAll(): Flow<List<NamedItem>>

    @Query("SELECT id, name FROM appellation WHERE id = :id")
    override suspend fun find(id: Long): NamedItem?

    @Query("SELECT id, name FROM appellation WHERE name = :name")
    override suspend fun findByName(name: String): NamedItem?

    @Query("INSERT INTO appellation (name) VALUES (:name)")
    override suspend fun insert(name: String): Long

    @Query("UPDATE appellation SET name = :name WHERE id = :id")
    override suspend fun rename(id: Long, name: String): Int

    @Query("DELETE FROM appellation WHERE id = :id")
    override suspend fun delete(id: Long): Int

    @Query(
        """
        SELECT EXISTS (SELECT 1 FROM wine WHERE appellation_id = :id)
            OR EXISTS (SELECT 1 FROM meal_pairing WHERE appellation_id = :id)
        """,
    )
    override suspend fun isInUse(id: Long): Boolean
}

@Dao
interface ProducerDao : NamedDao {
    @Insert suspend fun insertAll(rows: List<ProducerEntity>)

    @Query("SELECT COUNT(*) FROM producer") suspend fun count(): Int

    @Query("SELECT * FROM producer ORDER BY id") suspend fun all(): List<ProducerEntity>

    @Query("SELECT id, name FROM producer ORDER BY name")
    override fun observeAll(): Flow<List<NamedItem>>

    @Query("SELECT id, name FROM producer WHERE id = :id")
    override suspend fun find(id: Long): NamedItem?

    @Query("SELECT id, name FROM producer WHERE name = :name")
    override suspend fun findByName(name: String): NamedItem?

    @Query("INSERT INTO producer (name) VALUES (:name)")
    override suspend fun insert(name: String): Long

    @Query("UPDATE producer SET name = :name WHERE id = :id")
    override suspend fun rename(id: Long, name: String): Int

    @Query("DELETE FROM producer WHERE id = :id")
    override suspend fun delete(id: Long): Int

    @Query("SELECT EXISTS (SELECT 1 FROM wine WHERE producer_id = :id)")
    override suspend fun isInUse(id: Long): Boolean
}

@Dao
interface MealDao : NamedDao {
    @Insert suspend fun insertAll(rows: List<MealEntity>)

    @Query("SELECT COUNT(*) FROM meal") suspend fun count(): Int

    @Query("SELECT * FROM meal ORDER BY id") suspend fun all(): List<MealEntity>

    @Query("SELECT id, name FROM meal ORDER BY name")
    override fun observeAll(): Flow<List<NamedItem>>

    @Query("SELECT id, name FROM meal WHERE id = :id")
    override suspend fun find(id: Long): NamedItem?

    @Query("SELECT id, name FROM meal WHERE name = :name")
    override suspend fun findByName(name: String): NamedItem?

    @Query("INSERT INTO meal (name) VALUES (:name)")
    override suspend fun insert(name: String): Long

    @Query("UPDATE meal SET name = :name WHERE id = :id")
    override suspend fun rename(id: Long, name: String): Int

    @Query("DELETE FROM meal WHERE id = :id")
    override suspend fun delete(id: Long): Int

    @Query("SELECT EXISTS (SELECT 1 FROM meal_pairing WHERE meal_id = :id)")
    override suspend fun isInUse(id: Long): Boolean
}

/** A Wine with the names it points at, as its detail page shows it. */
data class WineWithNames(
    val id: Long,
    val millesime: Int?,
    val appellationId: Long,
    val appellationName: String,
    val producerId: Long,
    val producerName: String,
    val color: WineColor,
    val gardeDebut: Int?,
    val gardeFin: Int?,
    val quantity: Int,
)

@Dao
interface WineDao {
    @Insert suspend fun insertAll(rows: List<WineEntity>)

    @Insert suspend fun insert(row: WineEntity): Long

    @Query("SELECT COUNT(*) FROM wine") suspend fun count(): Int

    @Query("SELECT * FROM wine ORDER BY id") suspend fun all(): List<WineEntity>

    @Query("SELECT * FROM wine WHERE id = :id") suspend fun find(id: Long): WineEntity?

    @Query(
        """
        UPDATE wine SET millesime = :millesime, appellation_id = :appellationId, producer_id = :producerId,
            color = :color, garde_debut = :gardeDebut, garde_fin = :gardeFin, updated_at = :updatedAt
        WHERE id = :id
        """,
    )
    suspend fun updateFields(
        id: Long,
        millesime: Int?,
        appellationId: Long,
        producerId: Long,
        color: WineColor,
        gardeDebut: Int?,
        gardeFin: Int?,
        updatedAt: Long,
    ): Int

    @Query(
        """
        SELECT id, millesime, appellation_id AS appellationId, producer_id AS producerId, color,
            garde_debut AS gardeDebut, garde_fin AS gardeFin, quantity
        FROM wine
        """,
    )
    fun observeAllForSearch(): Flow<List<CellarWine>>

    @Query(
        """
        SELECT w.id, w.millesime, w.appellation_id AS appellationId, a.name AS appellationName,
            w.producer_id AS producerId, p.name AS producerName, w.color,
            w.garde_debut AS gardeDebut, w.garde_fin AS gardeFin, w.quantity
        FROM wine w JOIN appellation a ON a.id = w.appellation_id JOIN producer p ON p.id = w.producer_id
        WHERE w.id = :id
        """,
    )
    fun observeWithNames(id: Long): Flow<WineWithNames?>

    @Query("SELECT COUNT(*) FROM wine WHERE quantity > 0") fun observeInStockCount(): Flow<Int>

    @Query("SELECT COUNT(*) FROM wine") fun observeCount(): Flow<Int>

    @Query("UPDATE wine SET quantity = quantity + :delta, updated_at = :updatedAt WHERE id = :id")
    suspend fun addToQuantity(id: Long, delta: Int, updatedAt: Long): Int
}

@Dao
interface MealPairingDao {
    @Insert suspend fun insertAll(rows: List<MealPairingEntity>)

    @Insert(onConflict = OnConflictStrategy.IGNORE) suspend fun insertIfMissing(row: MealPairingEntity)

    @Query("DELETE FROM meal_pairing WHERE appellation_id = :appellationId AND color = :color AND meal_id = :mealId")
    suspend fun delete(appellationId: Long, color: WineColor, mealId: Long): Int

    @Query("SELECT COUNT(*) FROM meal_pairing") suspend fun count(): Int

    @Query("SELECT * FROM meal_pairing") suspend fun all(): List<MealPairingEntity>

    @Query("SELECT appellation_id AS appellationId, color, meal_id AS mealId FROM meal_pairing")
    fun observeAll(): Flow<List<MealPairing>>

    /** The Meals paired with one Appellation and Color: a Wine's suggested Meals. */
    @Query(
        """
        SELECT m.id, m.name FROM meal m
        JOIN meal_pairing mp ON mp.meal_id = m.id
        WHERE mp.appellation_id = :appellationId AND mp.color = :color
        ORDER BY m.name
        """,
    )
    fun observeMeals(appellationId: Long, color: WineColor): Flow<List<NamedItem>>
}

@Dao
interface ConsumptionDao {
    @Insert suspend fun insertAll(rows: List<ConsumptionEntity>)

    @Insert suspend fun insert(row: ConsumptionEntity): Long

    @Query("SELECT COUNT(*) FROM consumption") suspend fun count(): Int

    @Query("SELECT * FROM consumption ORDER BY id") suspend fun all(): List<ConsumptionEntity>

    @Query("SELECT * FROM consumption WHERE id = :id") suspend fun find(id: Long): ConsumptionEntity?

    @Query("UPDATE consumption SET date = :date, rating = :rating, notes = :notes, updated_at = :updatedAt WHERE id = :id")
    suspend fun update(id: Long, date: String, rating: Int?, notes: String?, updatedAt: Long): Int

    @Query("DELETE FROM consumption WHERE id = :id") suspend fun delete(id: Long): Int

    /** A Wine's Consumptions, oldest first, as its detail page lists them. */
    @Query("SELECT * FROM consumption WHERE wine_id = :wineId ORDER BY date, id")
    fun observeForWine(wineId: Long): Flow<List<ConsumptionEntity>>

    @Query(
        """
        SELECT c.id, c.wine_id AS wineId, c.date, p.name AS producerName, w.appellation_id AS appellationId,
            a.name AS appellationName, w.color, w.millesime
        FROM consumption c
        JOIN wine w ON w.id = c.wine_id
        JOIN producer p ON p.id = w.producer_id
        JOIN appellation a ON a.id = w.appellation_id
        """,
    )
    fun observeHistory(): Flow<List<HistoryEntry>>
}

@Dao
interface QuantityAdjustmentDao {
    @Insert suspend fun insertAll(rows: List<QuantityAdjustmentEntity>)

    @Insert suspend fun insert(row: QuantityAdjustmentEntity): Long

    @Query("SELECT * FROM quantity_adjustment WHERE wine_id = :wineId ORDER BY id")
    suspend fun forWine(wineId: Long): List<QuantityAdjustmentEntity>

    @Query("SELECT COUNT(*) FROM quantity_adjustment") suspend fun count(): Int

    @Query("SELECT * FROM quantity_adjustment ORDER BY id") suspend fun all(): List<QuantityAdjustmentEntity>
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

    // Children before parents: every foreign key is RESTRICT. Callers run these in one transaction.
    @Query("DELETE FROM quantity_adjustment") suspend fun deleteQuantityAdjustments()

    @Query("DELETE FROM consumption") suspend fun deleteConsumptions()

    @Query("DELETE FROM meal_pairing") suspend fun deleteMealPairings()

    @Query("DELETE FROM wine") suspend fun deleteWines()

    @Query("DELETE FROM meal") suspend fun deleteMeals()

    @Query("DELETE FROM producer") suspend fun deleteProducers()

    @Query("DELETE FROM appellation") suspend fun deleteAppellations()

    /** True while nothing at all has been recorded: the state in which an import replaces nothing. */
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
