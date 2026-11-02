package net.ludeo.oenoteq.data

import androidx.room.withTransaction
import kotlinx.coroutines.flow.Flow
import net.ludeo.oenoteq.domain.CellarError
import net.ludeo.oenoteq.domain.NamedItem
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.domain.normalizeName

/**
 * Producers, Appellations and Meals, with the rules of the Go `db` layer:
 * name required and unique (compared byte for byte, as SQLite's UNIQUE does),
 * delete refused while a Wine or a Meal Pairing still uses the row.
 */
class ReferentialRepository(private val database: CellarDatabase, val kind: Referential) {
    private val dao: NamedDao = when (kind) {
        Referential.PRODUCER -> database.producerDao()
        Referential.APPELLATION -> database.appellationDao()
        Referential.MEAL -> database.mealDao()
    }

    /** The refusal for an id that no longer exists. */
    val notFound = when (kind) {
        Referential.PRODUCER -> CellarError.Code.PRODUCER_NOT_FOUND
        Referential.APPELLATION -> CellarError.Code.APPELLATION_NOT_FOUND
        Referential.MEAL -> CellarError.Code.MEAL_NOT_FOUND
    }

    private val inUse = when (kind) {
        Referential.PRODUCER -> CellarError.Code.PRODUCER_IN_USE
        Referential.APPELLATION -> CellarError.Code.APPELLATION_IN_USE
        Referential.MEAL -> CellarError.Code.MEAL_IN_USE
    }

    fun observeAll(): Flow<List<NamedItem>> = dao.observeAll()

    suspend fun find(id: Long): NamedItem? = dao.find(id)

    suspend fun create(name: String): NamedItem = database.withTransaction {
        val stored = checkedName(name)
        if (dao.findByName(stored) != null) throw CellarError(CellarError.Code.ALREADY_EXISTS)
        NamedItem(dao.insert(stored), stored)
    }

    suspend fun rename(id: Long, name: String): NamedItem = database.withTransaction {
        val stored = checkedName(name)
        if (dao.find(id) == null) throw CellarError(notFound)
        val holder = dao.findByName(stored)
        if (holder != null && holder.id != id) throw CellarError(CellarError.Code.ALREADY_EXISTS)
        dao.rename(id, stored)
        NamedItem(id, stored)
    }

    suspend fun delete(id: Long): Unit = database.withTransaction {
        if (dao.find(id) == null) throw CellarError(notFound)
        if (dao.isInUse(id)) throw CellarError(inUse)
        dao.delete(id)
    }

    private fun checkedName(name: String): String =
        normalizeName(name).ifEmpty { throw CellarError(CellarError.Code.NAME_REQUIRED) }
}
