package net.ludeo.oenoteq.data.snapshot

import android.content.Context
import android.net.Uri
import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import net.ludeo.oenoteq.data.CellarDatabase
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.io.File

/** The import on the device's own SQLite, from a content Uri as the file picker hands it over. */
@RunWith(AndroidJUnit4::class)
class SnapshotImportOnDeviceTest {
    private lateinit var context: Context
    private lateinit var database: CellarDatabase
    private lateinit var cacheDir: File

    @Before
    fun setUp() {
        context = InstrumentationRegistry.getInstrumentation().targetContext
        database = Room.inMemoryDatabaseBuilder(context, CellarDatabase::class.java).build()
        cacheDir = File(context.cacheDir, "snapshot-test").apply { deleteRecursively(); mkdirs() }
    }

    @After
    fun tearDown() {
        database.close()
        cacheDir.deleteRecursively()
    }

    @Test
    fun importsTheBackendSnapshotAndCleansUpItsCopy() = runBlocking {
        // A file:// Uri goes through the same ContentResolver.openInputStream path as a picked document.
        val picked = File(context.cacheDir, "picked.db")
        InstrumentationRegistry.getInstrumentation().context.assets.open("backend-snapshot.db").use { input ->
            picked.outputStream().use { input.copyTo(it) }
        }
        val importer = SnapshotImporter(database, context.contentResolver, cacheDir)

        val summary = importer.import(Uri.fromFile(picked))

        assertEquals(4, summary.wines)
        assertEquals(3, summary.consumptions)
        assertEquals(listOf(5, 0, 3, 1), database.wineDao().all().map { it.quantity })
        assertTrue("private copy left behind: ${cacheDir.list()?.toList()}", cacheDir.list().isNullOrEmpty())
        picked.delete()
        Unit
    }
}
