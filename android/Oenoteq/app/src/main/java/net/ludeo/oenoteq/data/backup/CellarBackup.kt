package net.ludeo.oenoteq.data.backup

import android.content.ContentResolver
import android.database.sqlite.SQLiteException
import android.net.Uri
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import net.ludeo.oenoteq.data.CellarDatabase
import net.ludeo.oenoteq.data.snapshot.ImportSummary
import net.ludeo.oenoteq.data.snapshot.MappedCellar
import net.ludeo.oenoteq.data.snapshot.SnapshotImportError
import net.ludeo.oenoteq.data.snapshot.readAll
import net.ludeo.oenoteq.data.snapshot.replaceAll
import net.ludeo.oenoteq.data.snapshot.summary
import java.io.File
import java.io.IOException

/**
 * The cellar as one SQLite file this app can write and read back: [export]
 * copies the rows into a fresh Room database with no side files, [restore]
 * reads such a file and replaces the cellar with it, all or nothing.
 *
 * [workDir] must be where [openFile] can open a database by file name (the
 * app's databases dir): temporary copies live there and are always deleted.
 */
class CellarBackup(
    private val database: CellarDatabase,
    private val resolver: ContentResolver,
    private val workDir: File,
    private val openFile: (File) -> CellarDatabase,
) {
    suspend fun export(uri: Uri): ImportSummary {
        val contents = database.readAll()
        val file = withContext(Dispatchers.IO) { File.createTempFile("export", ".db", workDir) }
        try {
            val copy = openFile(file)
            try {
                copy.replaceAll(contents)
            } finally {
                copy.close()
            }
            withContext(Dispatchers.IO) {
                // "wt": a picked file that already exists is overwritten, not appended to.
                val out = resolver.openOutputStream(uri, "wt") ?: throw IOException("cannot write $uri")
                out.use { stream -> file.inputStream().use { it.copyTo(stream) } }
            }
            return contents.summary()
        } finally {
            withContext(Dispatchers.IO) { CellarFiles.delete(file) }
        }
    }

    /** [file] is only read: it is copied first, because Room opens databases by name in [workDir]. */
    suspend fun restore(file: File): ImportSummary {
        val copy = withContext(Dispatchers.IO) { File.createTempFile("restore", ".db", workDir) }
        try {
            withContext(Dispatchers.IO) {
                file.copyTo(copy, overwrite = true)
                check(copy)
            }
            val contents = read(copy)
            database.replaceAll(contents)
            return contents.summary()
        } finally {
            withContext(Dispatchers.IO) { CellarFiles.delete(copy) }
        }
    }

    /** The raw checks Room can't make: what the file is, which version wrote it, whether it is sound. */
    private fun check(copy: File) = CellarFiles.open(copy) { db ->
        if ("room_master_table" !in CellarFiles.tables(db)) throw SnapshotImportError.NotACellarDatabase()
        val version = db.version
        if (version > CellarDatabase.SCHEMA_VERSION) throw SnapshotImportError.UnsupportedBackup(version)
        if (version < 1) throw SnapshotImportError.NotACellarDatabase()
        try {
            val integrity = db.rawQuery("PRAGMA integrity_check", null).use { c ->
                buildList { while (c.moveToNext()) add(c.getString(0)) }
            }
            val orphans = db.rawQuery("PRAGMA foreign_key_check", null).use { it.count }
            if (integrity != listOf("ok") || orphans > 0) throw SnapshotImportError.Corrupt()
        } catch (_: SQLiteException) {
            throw SnapshotImportError.Corrupt()
        }
    }

    /** Opens the copy with Room, so an older schema would be migrated, and reads every row. */
    private suspend fun read(copy: File): MappedCellar {
        val db = try {
            openFile(copy)
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            throw SnapshotImportError.Corrupt()
        }
        return try {
            db.readAll()
        } catch (e: CancellationException) {
            throw e
        } catch (_: Exception) {
            // Room refuses a file whose tables don't match the schema it claims.
            throw SnapshotImportError.Corrupt()
        } finally {
            db.close()
        }
    }
}
