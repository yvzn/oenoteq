package net.ludeo.oenoteq.data

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import net.ludeo.oenoteq.domain.CellarError
import net.ludeo.oenoteq.domain.ConsumptionInput
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.domain.WineColor
import net.ludeo.oenoteq.domain.WineInput
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

// Consumptions, stock corrections and Meal Pairings, as the Go `db` layer rules them.
@RunWith(AndroidJUnit4::class)
class DrinkingRepositoriesTest {
    private lateinit var database: CellarDatabase
    private lateinit var wines: WineRepository
    private lateinit var consumptions: ConsumptionRepository
    private lateinit var pairings: MealPairingRepository
    private lateinit var meals: ReferentialRepository
    private var appellationId = 0L
    private var wineId = 0L

    @Before
    fun setUp() = runBlocking {
        val context = ApplicationProvider.getApplicationContext<Context>()
        database = Room.inMemoryDatabaseBuilder(context, CellarDatabase::class.java).build()
        wines = WineRepository(database, clock = { 1_000 })
        consumptions = ConsumptionRepository(database, clock = { 2_000 })
        pairings = MealPairingRepository(database)
        meals = ReferentialRepository(database, Referential.MEAL)
        appellationId = ReferentialRepository(database, Referential.APPELLATION).create("Chablis").id
        val producerId = ReferentialRepository(database, Referential.PRODUCER).create("Laroche").id
        wineId = wines.create(WineInput(2020, appellationId, producerId, WineColor.BLANC, 2021, 2026), initialQuantity = 1)
    }

    @After
    fun tearDown() = database.close()

    private suspend fun quantity() = database.wineDao().find(wineId)?.quantity

    @Test
    fun `recording a consumption takes a bottle off, and is refused once none is left`() = runBlocking<Unit> {
        consumptions.create(wineId, ConsumptionInput("2026-03-15", 4, "Minéral"))

        assertEquals(0, quantity())
        refused(CellarError.Code.QUANTITY_ZERO) { consumptions.create(wineId, ConsumptionInput("2026-03-16", null, null)) }
        assertEquals(1, consumptions.observeForWine(wineId).first().size)
        refused(CellarError.Code.WINE_NOT_FOUND) { consumptions.create(404, ConsumptionInput("2026-03-16", null, null)) }
    }

    @Test
    fun `an invalid consumption changes nothing`() = runBlocking<Unit> {
        refused(CellarError.Code.INVALID_RATING) { consumptions.create(wineId, ConsumptionInput("2026-03-15", 9, null)) }

        assertEquals(1, quantity())
        assertEquals(0, consumptions.observeForWine(wineId).first().size)
    }

    @Test
    fun `editing a consumption changes date, rating and notes, never the stock`() = runBlocking<Unit> {
        wines.adjustQuantity(wineId, +1)
        val id = consumptions.create(wineId, ConsumptionInput("2026-03-15", 4, "Minéral"))

        consumptions.update(id, ConsumptionInput("2026-03-14", null, " "))

        val edited = consumptions.observeForWine(wineId).first().single()
        assertEquals(listOf("2026-03-14", null, null), listOf(edited.date, edited.rating, edited.notes))
        assertEquals(1, quantity())
        refused(CellarError.Code.CONSUMPTION_NOT_FOUND) { consumptions.update(404, ConsumptionInput("2026-03-14", null, null)) }
    }

    @Test
    fun `deleting a consumption gives the bottle back`() = runBlocking<Unit> {
        val id = consumptions.create(wineId, ConsumptionInput("2026-03-15", null, null))

        consumptions.delete(id)

        assertEquals(1, quantity())
        refused(CellarError.Code.CONSUMPTION_NOT_FOUND) { consumptions.delete(id) }
    }

    @Test
    fun `a wine's consumptions are listed oldest first`() = runBlocking<Unit> {
        wines.adjustQuantity(wineId, +2)
        consumptions.create(wineId, ConsumptionInput("2026-05-01", null, null))
        consumptions.create(wineId, ConsumptionInput("2025-12-24", null, null))
        consumptions.create(wineId, ConsumptionInput("2026-05-01", null, null))

        assertEquals(
            listOf("2025-12-24", "2026-05-01", "2026-05-01"),
            consumptions.observeForWine(wineId).first().map { it.date },
        )
    }

    @Test
    fun `the history keeps consumptions of wines now out of stock`() = runBlocking<Unit> {
        consumptions.create(wineId, ConsumptionInput("2026-03-15", null, null))

        val entry = consumptions.observeHistory().first().single()

        assertEquals(0, quantity())
        assertEquals(listOf("Laroche", "Chablis"), listOf(entry.producerName, entry.appellationName))
    }

    @Test
    fun `a stock correction is logged, and never takes the quantity below zero`() = runBlocking<Unit> {
        wines.adjustQuantity(wineId, +3)
        wines.adjustQuantity(wineId, -4)

        assertEquals(0, quantity())
        assertEquals(listOf(1, 3, -4), database.quantityAdjustmentDao().forWine(wineId).map { it.delta })
        refused(CellarError.Code.QUANTITY_ZERO) { wines.adjustQuantity(wineId, -1) }
        refused(CellarError.Code.WINE_NOT_FOUND) { wines.adjustQuantity(404, 1) }
    }

    @Test
    fun `pairing a meal twice keeps one pairing, and suggestions are sorted by name`() = runBlocking<Unit> {
        val oysters = meals.create("Huîtres").id
        val asparagus = meals.create("Asperges").id

        pairings.add(appellationId, WineColor.BLANC, oysters)
        pairings.add(appellationId, WineColor.BLANC, oysters)
        pairings.add(appellationId, WineColor.BLANC, asparagus)

        assertEquals(listOf("Asperges", "Huîtres"), pairings.observeMeals(appellationId, WineColor.BLANC).first().map { it.name })
        assertEquals(emptyList<String>(), pairings.observeMeals(appellationId, WineColor.ROUGE).first().map { it.name })

        pairings.remove(appellationId, WineColor.BLANC, oysters)
        assertEquals(listOf("Asperges"), pairings.observeMeals(appellationId, WineColor.BLANC).first().map { it.name })
    }

    @Test
    fun `pairings need an existing appellation and meal`() = runBlocking<Unit> {
        val oysters = meals.create("Huîtres").id

        refused(CellarError.Code.APPELLATION_NOT_FOUND) { pairings.add(404, WineColor.BLANC, oysters) }
        refused(CellarError.Code.MEAL_NOT_FOUND) { pairings.add(appellationId, WineColor.BLANC, 404) }
    }

    private suspend fun refused(code: CellarError.Code, block: suspend () -> Unit) {
        try {
            block()
            fail("expected $code")
        } catch (e: CellarError) {
            assertEquals(code, e.code)
        }
    }
}
