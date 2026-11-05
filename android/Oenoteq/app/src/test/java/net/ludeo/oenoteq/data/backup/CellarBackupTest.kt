package net.ludeo.oenoteq.data.backup

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.net.Uri
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import net.ludeo.oenoteq.data.AppellationEntity
import net.ludeo.oenoteq.data.CellarDatabase
import net.ludeo.oenoteq.data.ConsumptionEntity
import net.ludeo.oenoteq.data.MealEntity
import net.ludeo.oenoteq.data.MealPairingEntity
import net.ludeo.oenoteq.data.ProducerEntity
import net.ludeo.oenoteq.data.QuantityAdjustmentEntity
import net.ludeo.oenoteq.data.WineEntity
import net.ludeo.oenoteq.data.snapshot.ImportSummary
import net.ludeo.oenoteq.data.snapshot.SnapshotImportError
import net.ludeo.oenoteq.data.snapshot.SnapshotImporter
import net.ludeo.oenoteq.domain.WineColor
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

/** Export of the cellar to one file, and the import that tells this app's files from the backend's. */
@RunWith(AndroidJUnit4::class)
class CellarBackupTest {
    @get:Rule val temp = TemporaryFolder()

    private lateinit var context: Context
    private lateinit var dbDir: File
    private lateinit var database: CellarDatabase
    private lateinit var backup: CellarBackup
    private lateinit var importer: CellarImporter

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
        // Room opens a file by name, in the databases dir: that is where the backup works too.
        dbDir = context.getDatabasePath("probe.db").parentFile!!.apply { mkdirs() }
        database = inMemory()
        backup = CellarBackup(database, context.contentResolver, dbDir) { CellarDatabase.openFile(context, it) }
        val snapshots = SnapshotImporter(database, context.contentResolver, temp.newFolder("snapshots")) { 42L }
        importer = CellarImporter(snapshots, backup, context.contentResolver, temp.newFolder("picked"))
    }

    @After
    fun tearDown() = database.close()

    private fun inMemory() = Room.inMemoryDatabaseBuilder(context, CellarDatabase::class.java).allowMainThreadQueries().build()

    private suspend fun fill(db: CellarDatabase, tag: String) {
        db.appellationDao().insertAll(listOf(AppellationEntity(id = 3, name = "App $tag")))
        db.producerDao().insertAll(listOf(ProducerEntity(id = 4, name = "Prod $tag")))
        db.mealDao().insertAll(listOf(MealEntity(id = 5, name = "Meal $tag")))
        db.wineDao().insertAll(
            listOf(WineEntity(id = 6, millesime = 2015, appellationId = 3, producerId = 4, color = WineColor.ROUGE, gardeDebut = 2020, gardeFin = null, quantity = 2, createdAt = 10, updatedAt = 11)),
        )
        db.mealPairingDao().insertAll(listOf(MealPairingEntity(appellationId = 3, color = WineColor.ROUGE, mealId = 5)))
        db.consumptionDao().insertAll(listOf(ConsumptionEntity(id = 7, wineId = 6, date = "2026-01-02", rating = 4, notes = "Bon $tag", createdAt = 12, updatedAt = 13)))
        db.quantityAdjustmentDao().insertAll(listOf(QuantityAdjustmentEntity(id = 8, wineId = 6, delta = 3, createdAt = 14)))
    }

    private fun uriOf(file: File): Uri = Uri.fromFile(file)

    @Test
    fun `exports one self-contained file that restores into another cellar`() = runBlocking<Unit> {
        fill(database, "A")
        val target = temp.newFile("out.db")

        val summary = backup.export(uriOf(target))

        assertEquals(ImportSummary(wines = 1, producers = 1, appellations = 1, meals = 1, mealPairings = 1, consumptions = 1), summary)
        assertTrue(target.length() > 0)
        assertTrue("work files left behind: ${dbDir.list()?.toList()}", dbDir.list().orEmpty().none { it.startsWith("export") })

        val other = inMemory()
        try {
            val restored = CellarBackup(other, context.contentResolver, dbDir) { CellarDatabase.openFile(context, it) }.restore(target)
            assertEquals(summary, restored)
            assertEquals(database.wineDao().all(), other.wineDao().all())
            assertEquals(database.consumptionDao().all(), other.consumptionDao().all())
            assertEquals(1, other.quantityAdjustmentDao().count())
            assertEquals(1, other.mealPairingDao().count())
            assertEquals("App A", other.appellationDao().find(3)!!.name)
        } finally {
            other.close()
        }
    }

    @Test
    fun `an empty cellar exports and restores as empty`() = runBlocking<Unit> {
        val target = temp.newFile("empty.db")

        backup.export(uriOf(target))
        fill(database, "old")
        backup.restore(target)

        assertEquals(0, database.cellarDao().totalRows())
    }

    @Test
    fun `restore replaces what the cellar holds`() = runBlocking<Unit> {
        fill(database, "A")
        val target = temp.newFile("a.db")
        backup.export(uriOf(target))
        database.clearAllTables()
        fill(database, "B")

        backup.restore(target)

        assertEquals("App A", database.appellationDao().find(3)!!.name)
        assertNull(database.producerDao().findByName("Prod B"))
        assertEquals("Bon A", database.consumptionDao().all().single().notes)
    }

    @Test
    fun `restore refuses a file that is not a database and keeps the cellar`() = runBlocking<Unit> {
        fill(database, "A")
        val file = temp.newFile().apply { writeText("not sqlite at all") }

        assertThrows(SnapshotImportError.NotACellarDatabase::class.java) { runBlocking { backup.restore(file) } }
        assertEquals("App A", database.appellationDao().find(3)!!.name)
    }

    @Test
    fun `restore refuses a file from a newer version of the app and keeps the cellar`() = runBlocking<Unit> {
        fill(database, "A")
        val target = temp.newFile("newer.db")
        backup.export(uriOf(target))
        SQLiteDatabase.openDatabase(target.path, null, SQLiteDatabase.OPEN_READWRITE).use { it.execSQL("PRAGMA user_version = 99") }

        val error = assertThrows(SnapshotImportError.UnsupportedBackup::class.java) { runBlocking { backup.restore(target) } }

        assertEquals(99, error.found)
        assertEquals("App A", database.appellationDao().find(3)!!.name)
    }

    @Test
    fun `restore refuses a damaged file and keeps the cellar`() = runBlocking<Unit> {
        fill(database, "A")
        val target = temp.newFile("damaged.db")
        backup.export(uriOf(target))
        // Corrupt data pages, keep the 100-byte header so the file still looks like SQLite.
        val original = target.readBytes()
        target.writeBytes(original.copyOfRange(0, 100) + ByteArray(8192) { 0x7f })

        val failure = runCatching { backup.restore(target) }.exceptionOrNull()

        assertTrue("got $failure", failure is SnapshotImportError)
        assertEquals("App A", database.appellationDao().find(3)!!.name)
    }

    @Test
    fun `import sends this app's file to restore and the backend's to the snapshot import`() = runBlocking<Unit> {
        fill(database, "A")
        val own = temp.newFile("own.db")
        backup.export(uriOf(own))
        database.clearAllTables()

        val restored = importer.import(uriOf(own))
        assertEquals(ImportSummary(wines = 1, producers = 1, appellations = 1, meals = 1, mealPairings = 1, consumptions = 1), restored)

        val backend = temp.newFile("backend.db")
        javaClass.classLoader!!.getResourceAsStream("snapshot/backend-snapshot.db")!!.use { input ->
            backend.outputStream().use { input.copyTo(it) }
        }
        val imported = importer.import(uriOf(backend))
        assertEquals(4, imported.wines)
        assertEquals(listOf(1L, 2L, 3L, 4L), database.wineDao().all().map { it.id })
    }

    @Test
    fun `import refuses a database that is neither and leaves no private copy`() = runBlocking<Unit> {
        val file = temp.newFile("other.db").also { it.delete() }
        SQLiteDatabase.openOrCreateDatabase(file, null).use { it.execSQL("CREATE TABLE notes (body TEXT)") }

        assertThrows(SnapshotImportError.NotACellarDatabase::class.java) { runBlocking { importer.import(uriOf(file)) } }

        assertTrue(File(temp.root, "picked").list().isNullOrEmpty())
    }
}
