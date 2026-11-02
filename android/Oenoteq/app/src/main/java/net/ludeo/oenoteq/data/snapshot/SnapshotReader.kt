package net.ludeo.oenoteq.data.snapshot

import android.database.Cursor
import android.database.DatabaseErrorHandler
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import java.io.File

/**
 * Reads a backend snapshot (a `sqlite3 .backup` of the Go backend's database)
 * into plain rows. Checks it is a sound cellar database at the backend schema
 * this app understands; does not judge the rows themselves (see [SnapshotMapper]).
 */
object SnapshotReader {
    /** The backend migration a snapshot must end at. A newer backend schema is refused too. */
    const val SUPPORTED_BACKEND_MIGRATION = "006_fix_consumption_wine_fk.sql"

    private val requiredTables = setOf(
        "schema_version", "appellation", "producer", "meal", "wine", "meal_pairing", "consumption", "quantity_adjustment",
    )

    // Android's default handler deletes a database it finds corrupt; the file is ours to report on, not to delete.
    private val keepCorruptFile = DatabaseErrorHandler { }

    /**
     * [file] must be a private copy: it is opened read-write, because a WAL-mode
     * snapshot (what `.backup` of the backend produces) can't be opened read-only
     * without its side files. Nothing is written to it.
     */
    fun read(file: File): SnapshotRows {
        val db = try {
            SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READWRITE, keepCorruptFile)
        } catch (_: SQLiteException) {
            throw SnapshotImportError.NotACellarDatabase()
        }
        return db.use {
            val tables = try {
                it.strings("SELECT name FROM sqlite_master WHERE type = 'table'").toSet()
            } catch (_: SQLiteException) {
                throw SnapshotImportError.NotACellarDatabase()
            }
            if (!tables.containsAll(requiredTables)) throw SnapshotImportError.NotACellarDatabase()

            val integrity = try {
                it.strings("PRAGMA integrity_check")
            } catch (_: SQLiteException) {
                throw SnapshotImportError.Corrupt()
            }
            if (integrity != listOf("ok")) throw SnapshotImportError.Corrupt()

            val lastMigration = it.strings("SELECT name FROM schema_version ORDER BY id DESC LIMIT 1").firstOrNull()
            if (lastMigration != SUPPORTED_BACKEND_MIGRATION) throw SnapshotImportError.UnsupportedSchema(lastMigration)

            readRows(it)
        }
    }

    private fun readRows(db: SQLiteDatabase) = SnapshotRows(
        appellations = db.rows("SELECT id, name FROM appellation ORDER BY id") { SnapshotNamed(long(0), string(1)) },
        producers = db.rows("SELECT id, name FROM producer ORDER BY id") { SnapshotNamed(long(0), string(1)) },
        meals = db.rows("SELECT id, name FROM meal ORDER BY id") { SnapshotNamed(long(0), string(1)) },
        wines = db.rows(
            """
            SELECT id, millesime, appellation_id, producer_id, color, garde_debut, garde_fin, quantity, created_at, updated_at
            FROM wine ORDER BY id
            """,
        ) {
            SnapshotWine(
                id = long(0),
                millesime = intOrNull(1),
                appellationId = long(2),
                producerId = long(3),
                color = string(4),
                gardeDebut = intOrNull(5),
                gardeFin = intOrNull(6),
                quantity = getInt(7),
                createdAt = raw(8),
                updatedAt = raw(9),
            )
        },
        mealPairings = db.rows(
            "SELECT appellation_id, color, meal_id FROM meal_pairing ORDER BY appellation_id, color, meal_id",
        ) { SnapshotMealPairing(long(0), string(1), long(2)) },
        consumptions = db.rows(
            "SELECT id, wine_id, date, rating, notes, created_at, updated_at FROM consumption ORDER BY id",
        ) {
            SnapshotConsumption(long(0), long(1), raw(2), intOrNull(3), string(4), raw(5), raw(6))
        },
        adjustments = db.rows(
            "SELECT id, wine_id, delta, reason, created_at FROM quantity_adjustment ORDER BY id",
        ) { SnapshotAdjustment(long(0), long(1), getInt(2), string(3), raw(4)) },
    )

    private fun SQLiteDatabase.strings(sql: String): List<String> = rows(sql) { getString(0) }

    private fun <T> SQLiteDatabase.rows(sql: String, map: Cursor.() -> T): List<T> =
        rawQuery(sql, null).use { cursor ->
            buildList { while (cursor.moveToNext()) add(cursor.map()) }
        }

    private fun Cursor.long(index: Int): Long = getLong(index)

    private fun Cursor.string(index: Int): String? = if (isNull(index)) null else getString(index)

    private fun Cursor.intOrNull(index: Int): Int? = if (isNull(index)) null else getInt(index)

    /** The value as SQLite stored it: text, integer or null. */
    private fun Cursor.raw(index: Int): Any? = when (getType(index)) {
        Cursor.FIELD_TYPE_NULL -> null
        Cursor.FIELD_TYPE_INTEGER -> getLong(index)
        else -> getString(index)
    }
}
