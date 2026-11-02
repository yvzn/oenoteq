package net.ludeo.oenoteq.data.snapshot

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import net.ludeo.oenoteq.data.CellarDatabase
import net.ludeo.oenoteq.data.ConsumptionRepository
import net.ludeo.oenoteq.data.MealPairingRepository
import net.ludeo.oenoteq.data.ProducerEntity
import net.ludeo.oenoteq.data.WineRepository
import net.ludeo.oenoteq.domain.HistorySort
import net.ludeo.oenoteq.domain.SearchFilters
import net.ludeo.oenoteq.domain.WineColor
import net.ludeo.oenoteq.domain.WineSort
import net.ludeo.oenoteq.domain.consumptionHistory
import net.ludeo.oenoteq.domain.searchCellar
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import org.junit.runner.RunWith
import java.io.File

/**
 * Imports `snapshot/backend-snapshot.db`, written by the real backend
 * (android/Oenoteq/tools/snapshotfixture). Expected values mirror that tool.
 */
@RunWith(AndroidJUnit4::class)
class SnapshotImporterTest {
    @get:Rule val temp = TemporaryFolder()

    private lateinit var database: CellarDatabase
    private lateinit var importer: SnapshotImporter

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        database = Room.inMemoryDatabaseBuilder(context, CellarDatabase::class.java).allowMainThreadQueries().build()
        importer = SnapshotImporter(database, context.contentResolver, temp.root) { 42L }
    }

    @After
    fun tearDown() = database.close()

    /** A private copy of the fixture, optionally altered with raw SQL before the import reads it. */
    private fun snapshot(vararg sql: String): File {
        val file = temp.newFile()
        javaClass.classLoader!!.getResourceAsStream("snapshot/backend-snapshot.db")!!.use { input ->
            file.outputStream().use { input.copyTo(it) }
        }
        if (sql.isNotEmpty()) {
            SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READWRITE).use { db ->
                db.execSQL("PRAGMA foreign_keys = OFF")
                sql.forEach(db::execSQL)
            }
        }
        return file
    }

    @Test
    fun `imports the backend cellar as is`() = runBlocking<Unit> {
        val summary = importer.import(snapshot())

        assertEquals(ImportSummary(wines = 4, producers = 4, appellations = 4, meals = 4, mealPairings = 3, consumptions = 3), summary)
        assertEquals(6, database.quantityAdjustmentDao().count())

        val wines = database.wineDao().all()
        assertEquals(listOf(1L, 2L, 3L, 4L), wines.map { it.id })
        assertEquals(listOf(5, 0, 3, 1), wines.map { it.quantity })
        assertEquals(listOf(WineColor.ROUGE, WineColor.BLANC, WineColor.ROSE, WineColor.BLANC), wines.map { it.color })
        assertEquals(listOf(2015, 2020, 2023, null), wines.map { it.millesime })
        assertNull(wines[2].gardeDebut)
        assertNull(wines[2].gardeFin)
        assertEquals(2024, wines[3].gardeDebut)
        assertTrue(wines.all { it.createdAt > 1_600_000_000_000L })

        val consumptions = database.consumptionDao().all()
        assertEquals(listOf("2025-12-24", "2026-03-15", "2026-05-01"), consumptions.map { it.date })
        assertEquals(listOf(1L, 1L, 2L), consumptions.map { it.wineId })
        assertEquals(listOf(5, null, 4), consumptions.map { it.rating })
        assertEquals("Superbe, encore jeune", consumptions[0].notes)
    }

    @Test
    fun `the imported cellar searches and lists its history as the backend does`() = runBlocking<Unit> {
        importer.import(snapshot())

        // In stock only, by appellation: Champagne, Côtes de Provence, Margaux; the finished Chablis is gone.
        val search = WineRepository(database).observeSearchData().first()
        assertEquals(listOf(4L, 3L, 1L), searchCellar(search, SearchFilters(), WineSort(), 2026).map { it.id })

        // Newest first, the finished Chablis included.
        val history = ConsumptionRepository(database).observeHistory().first()
        val pairings = MealPairingRepository(database).observeAll().first()
        assertEquals(listOf(3L, 2L, 1L), consumptionHistory(history, pairings, SearchFilters(), HistorySort()).map { it.id })
    }

    @Test
    fun `refuses when the cellar already holds anything`() = runBlocking<Unit> {
        database.producerDao().insertAll(listOf(ProducerEntity(name = "Déjà là")))

        importFails<SnapshotImportError.CellarNotEmpty>(snapshot())
        assertEquals(1, database.cellarDao().totalRows())
    }

    @Test
    fun `refuses a snapshot from an older backend`() = runBlocking<Unit> {
        val file = snapshot("DELETE FROM schema_version WHERE name = '006_fix_consumption_wine_fk.sql'")

        val error = importFails<SnapshotImportError.UnsupportedSchema>(file)
        assertEquals("005_quantity_delta_events.sql", error.found)
        assertEquals(0, database.cellarDao().totalRows())
    }

    @Test
    fun `refuses a snapshot from a newer backend`() = runBlocking<Unit> {
        val file = snapshot("INSERT INTO schema_version (name) VALUES ('007_something_new.sql')")

        importFails<SnapshotImportError.UnsupportedSchema>(file)
        assertEquals(0, database.cellarDao().totalRows())
    }

    @Test
    fun `refuses a file that is not a database`() = runBlocking<Unit> {
        val file = temp.newFile().apply { writeText("wine list\nMargaux 2015\n") }

        importFails<SnapshotImportError.NotACellarDatabase>(file)
        assertEquals(0, database.cellarDao().totalRows())
    }

    @Test
    fun `refuses a database that is not a cellar`() = runBlocking<Unit> {
        val file = temp.newFile().also { it.delete() }
        SQLiteDatabase.openOrCreateDatabase(file, null).use { it.execSQL("CREATE TABLE notes (body TEXT)") }

        importFails<SnapshotImportError.NotACellarDatabase>(file)
    }

    @Test
    fun `refuses orphan rows`() = runBlocking<Unit> {
        val file = snapshot("INSERT INTO consumption (wine_id, date) VALUES (999, '2026-01-01')")

        val error = importFails<SnapshotImportError.OrphanRows>(file)
        assertEquals(mapOf("consumption" to 1), error.countsByTable)
        assertEquals(0, database.cellarDao().totalRows())
    }

    @Test
    fun `refuses an invalid row and writes nothing`() = runBlocking<Unit> {
        // The backend's DATE column has no CHECK: a hand-edited snapshot can hold any text there.
        val file = snapshot("UPDATE consumption SET date = '01/05/2026' WHERE id = 3")

        val error = importFails<SnapshotImportError.InvalidRow>(file)
        assertEquals("consumption", error.table)
        assertEquals(3L, error.id)
        assertEquals(SnapshotImportError.Reason.INVALID_DATE, error.reason)
        assertEquals(0, database.cellarDao().totalRows())
    }

    @Test
    fun `reports a snapshot breaking the backend's own constraints as damaged`() = runBlocking<Unit> {
        val file = snapshot(
            "PRAGMA ignore_check_constraints = ON",
            "UPDATE consumption SET rating = 9 WHERE id = 3",
        )

        importFails<SnapshotImportError.Corrupt>(file)
        assertEquals(0, database.cellarDao().totalRows())
    }

    private inline fun <reified T : SnapshotImportError> importFails(file: File): T =
        assertThrows(T::class.java) { runBlocking { importer.import(file) } }
}
