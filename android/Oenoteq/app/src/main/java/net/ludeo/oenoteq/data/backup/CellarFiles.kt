package net.ludeo.oenoteq.data.backup

import android.database.DatabaseErrorHandler
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import net.ludeo.oenoteq.data.snapshot.SnapshotImportError
import java.io.File

/** What an imported file turned out to be. */
enum class CellarFileKind { BACKEND_SNAPSHOT, APP_BACKUP }

/** Looks inside a SQLite file that is a private copy: opened read-write, never written. */
internal object CellarFiles {
    // Android's default handler deletes a database it finds corrupt; the file is ours to report on, not to delete.
    private val keepCorruptFile = DatabaseErrorHandler { }

    fun <T> open(file: File, block: (SQLiteDatabase) -> T): T {
        val db = try {
            SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READWRITE, keepCorruptFile)
        } catch (_: SQLiteException) {
            throw SnapshotImportError.NotACellarDatabase()
        }
        return db.use(block)
    }

    fun tables(db: SQLiteDatabase): Set<String> = try {
        db.rawQuery("SELECT name FROM sqlite_master WHERE type = 'table'", null).use { c ->
            val names = mutableSetOf<String>()
            while (c.moveToNext()) names += c.getString(0)
            names
        }
    } catch (_: SQLiteException) {
        throw SnapshotImportError.NotACellarDatabase()
    }

    fun kind(file: File): CellarFileKind = open(file) { db ->
        val tables = tables(db)
        when {
            "room_master_table" in tables -> CellarFileKind.APP_BACKUP
            "schema_version" in tables -> CellarFileKind.BACKEND_SNAPSHOT
            else -> throw SnapshotImportError.NotACellarDatabase()
        }
    }

    /** The file and the side files SQLite may have made next to it. */
    fun delete(file: File) {
        for (suffix in listOf("", "-wal", "-shm", "-journal")) File(file.path + suffix).delete()
    }
}
