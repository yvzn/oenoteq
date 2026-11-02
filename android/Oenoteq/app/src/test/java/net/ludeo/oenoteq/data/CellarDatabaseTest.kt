package net.ludeo.oenoteq.data

import android.content.Context
import android.database.sqlite.SQLiteConstraintException
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.runBlocking
import net.ludeo.oenoteq.domain.WineColor
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class CellarDatabaseTest {
    private lateinit var database: CellarDatabase

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        database = Room.inMemoryDatabaseBuilder(context, CellarDatabase::class.java).allowMainThreadQueries().build()
    }

    @After
    fun tearDown() = database.close()

    private fun wine(producerId: Long, appellationId: Long = 1) = WineEntity(
        millesime = 2015, appellationId = appellationId, producerId = producerId, color = WineColor.ROSE,
        gardeDebut = null, gardeFin = null, quantity = 1, createdAt = 0, updatedAt = 0,
    )

    @Test
    fun `stores color as the backend code and reads it back`() = runBlocking<Unit> {
        database.appellationDao().insertAll(listOf(AppellationEntity(1, "Bandol")))
        database.producerDao().insertAll(listOf(ProducerEntity(1, "Domaine Tempier")))
        database.wineDao().insertAll(listOf(wine(producerId = 1)))

        assertEquals(WineColor.ROSE, database.wineDao().all().single().color)
        database.query("SELECT color FROM wine", null).use {
            it.moveToFirst()
            assertEquals("rose", it.getString(0))
        }
    }

    @Test
    fun `enforces foreign keys`() {
        assertThrows(SQLiteConstraintException::class.java) {
            runBlocking { database.wineDao().insertAll(listOf(wine(producerId = 404, appellationId = 404))) }
        }
    }

    @Test
    fun `enforces unique names`() {
        runBlocking { database.mealDao().insertAll(listOf(MealEntity(name = "Huîtres"))) }

        assertThrows(SQLiteConstraintException::class.java) {
            runBlocking { database.mealDao().insertAll(listOf(MealEntity(name = "Huîtres"))) }
        }
    }
}
