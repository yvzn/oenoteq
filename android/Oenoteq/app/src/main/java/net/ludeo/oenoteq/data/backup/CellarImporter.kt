package net.ludeo.oenoteq.data.backup

import android.content.ContentResolver
import android.net.Uri
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import net.ludeo.oenoteq.data.snapshot.ImportSummary
import net.ludeo.oenoteq.data.snapshot.SnapshotImportError
import net.ludeo.oenoteq.data.snapshot.SnapshotImporter
import java.io.File

/**
 * The one import the UI offers: looks inside the picked file to tell a backend
 * snapshot from a file exported by this app, then sends it to the right path.
 * Either replaces the whole cellar, all or nothing.
 */
class CellarImporter(
    private val snapshots: SnapshotImporter,
    private val backup: CellarBackup,
    private val resolver: ContentResolver,
    private val cacheDir: File,
) {
    /** Copies the picked document to a private file first, and always deletes that copy. */
    suspend fun import(uri: Uri): ImportSummary {
        val copy = withContext(Dispatchers.IO) { File.createTempFile("picked", ".db", cacheDir) }
        try {
            val kind = withContext(Dispatchers.IO) {
                val input = resolver.openInputStream(uri) ?: throw SnapshotImportError.NotACellarDatabase()
                input.use { stream -> copy.outputStream().use { stream.copyTo(it) } }
                CellarFiles.kind(copy)
            }
            return when (kind) {
                CellarFileKind.BACKEND_SNAPSHOT -> snapshots.import(copy)
                CellarFileKind.APP_BACKUP -> backup.restore(copy)
            }
        } finally {
            withContext(Dispatchers.IO) { CellarFiles.delete(copy) }
        }
    }
}
