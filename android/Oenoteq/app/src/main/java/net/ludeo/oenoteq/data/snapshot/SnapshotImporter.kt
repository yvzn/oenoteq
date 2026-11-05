package net.ludeo.oenoteq.data.snapshot

import android.content.ContentResolver
import android.net.Uri
import androidx.room.withTransaction
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import net.ludeo.oenoteq.data.CellarDatabase
import java.io.File

data class ImportSummary(
    val wines: Int,
    val producers: Int,
    val appellations: Int,
    val meals: Int,
    val mealPairings: Int,
    val consumptions: Int,
)

/**
 * Import of a backend snapshot that replaces whatever the cellar holds (the UI
 * asks for confirmation first): all or nothing, ids preserved, quantities copied as is (never recomputed from the ledger:
 * Consumptions older than backend migration 005 have no adjustment rows).
 */
class SnapshotImporter(
    private val database: CellarDatabase,
    private val resolver: ContentResolver,
    private val cacheDir: File,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    /** Copies the picked document to a private file first, and always deletes that copy. */
    suspend fun import(uri: Uri): ImportSummary {
        val copy = withContext(Dispatchers.IO) { File.createTempFile("snapshot", ".db", cacheDir) }
        return try {
            withContext(Dispatchers.IO) {
                val input = resolver.openInputStream(uri) ?: throw SnapshotImportError.NotACellarDatabase()
                input.use { stream -> copy.outputStream().use { stream.copyTo(it) } }
            }
            import(copy)
        } finally {
            withContext(Dispatchers.IO) {
                for (suffix in listOf("", "-wal", "-shm", "-journal")) File(copy.path + suffix).delete()
            }
        }
    }

    /** [file] must be a private copy the importer may open read-write (see [SnapshotReader.read]). */
    suspend fun import(file: File): ImportSummary {
        // Read and validated before anything is touched: a refused file never costs the cellar a row.
        val rows = withContext(Dispatchers.IO) { SnapshotReader.read(file) }
        val cellar = SnapshotMapper.map(rows, clock())

        database.withTransaction {
            // Same transaction as the inserts: a failure rolls the old cellar back.
            val cellarDao = database.cellarDao()
            cellarDao.deleteQuantityAdjustments()
            cellarDao.deleteConsumptions()
            cellarDao.deleteMealPairings()
            cellarDao.deleteWines()
            cellarDao.deleteMeals()
            cellarDao.deleteProducers()
            cellarDao.deleteAppellations()
            database.appellationDao().insertAll(cellar.appellations)
            database.producerDao().insertAll(cellar.producers)
            database.mealDao().insertAll(cellar.meals)
            database.wineDao().insertAll(cellar.wines)
            database.mealPairingDao().insertAll(cellar.mealPairings)
            database.consumptionDao().insertAll(cellar.consumptions)
            database.quantityAdjustmentDao().insertAll(cellar.adjustments)
        }

        return ImportSummary(
            wines = cellar.wines.size,
            producers = cellar.producers.size,
            appellations = cellar.appellations.size,
            meals = cellar.meals.size,
            mealPairings = cellar.mealPairings.size,
            consumptions = cellar.consumptions.size,
        )
    }
}
