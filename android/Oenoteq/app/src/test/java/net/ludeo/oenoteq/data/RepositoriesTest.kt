package net.ludeo.oenoteq.data

import android.content.Context
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import net.ludeo.oenoteq.domain.CellarError
import net.ludeo.oenoteq.domain.NamedItem
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.domain.WineColor
import net.ludeo.oenoteq.domain.WineInput
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

// The rules of the Go `db` layer, as the repositories enforce them (cases ported from internal/handlers tests).
@RunWith(AndroidJUnit4::class)
class RepositoriesTest {
    private lateinit var database: CellarDatabase
    private lateinit var producers: ReferentialRepository
    private lateinit var appellations: ReferentialRepository
    private lateinit var meals: ReferentialRepository
    private lateinit var wines: WineRepository

    @Before
    fun setUp() {
        val context = ApplicationProvider.getApplicationContext<Context>()
        database = Room.inMemoryDatabaseBuilder(context, CellarDatabase::class.java).build()
        producers = ReferentialRepository(database, Referential.PRODUCER)
        appellations = ReferentialRepository(database, Referential.APPELLATION)
        meals = ReferentialRepository(database, Referential.MEAL)
        wines = WineRepository(database, clock = { 1_000 })
    }

    @After
    fun tearDown() = database.close()

    @Test
    fun `names are stored trimmed and listed in binary order`() = runBlocking<Unit> {
        producers.create("  Zeta ")
        producers.create("château Gamma")
        producers.create("Émile")
        producers.create("Domaine Alpha")

        assertEquals(
            listOf("Domaine Alpha", "Zeta", "château Gamma", "Émile"),
            producers.observeAll().first().map { it.name },
        )
    }

    @Test
    fun `a blank name is refused`() = runBlocking<Unit> {
        refused(CellarError.Code.NAME_REQUIRED) { meals.create("   ") }
    }

    @Test
    fun `a duplicate name is refused, but a different case is another name`() = runBlocking<Unit> {
        meals.create("Huîtres")

        refused(CellarError.Code.ALREADY_EXISTS) { meals.create(" Huîtres") }
        meals.create("huîtres")
        assertEquals(2, meals.observeAll().first().size)
    }

    @Test
    fun `renaming keeps the id, allows the same name and refuses another row's name`() = runBlocking<Unit> {
        val margaux = appellations.create("Margaux")
        appellations.create("Chablis")

        assertEquals(NamedItem(margaux.id, "Margaux"), appellations.rename(margaux.id, "Margaux "))
        refused(CellarError.Code.ALREADY_EXISTS) { appellations.rename(margaux.id, "Chablis") }
        assertEquals(NamedItem(margaux.id, "Pauillac"), appellations.rename(margaux.id, "Pauillac"))
        refused(CellarError.Code.APPELLATION_NOT_FOUND) { appellations.rename(404, "Bandol") }
    }

    @Test
    fun `deleting an unused row works, a missing one is refused`() = runBlocking<Unit> {
        val meal = meals.create("Plateau de fromages")

        meals.delete(meal.id)

        assertNull(meals.find(meal.id))
        refused(CellarError.Code.MEAL_NOT_FOUND) { meals.delete(meal.id) }
    }

    @Test
    fun `deleting a producer or appellation used by a wine is refused`() = runBlocking<Unit> {
        val wine = newWine()
        wines.create(wine, initialQuantity = 1)

        refused(CellarError.Code.PRODUCER_IN_USE) { producers.delete(wine.producerId) }
        refused(CellarError.Code.APPELLATION_IN_USE) { appellations.delete(wine.appellationId) }
    }

    @Test
    fun `deleting an appellation or meal used by a meal pairing is refused`() = runBlocking<Unit> {
        val appellation = appellations.create("Chablis")
        val meal = meals.create("Huîtres")
        database.mealPairingDao().insertAll(listOf(MealPairingEntity(appellation.id, WineColor.BLANC, meal.id)))

        refused(CellarError.Code.APPELLATION_IN_USE) { appellations.delete(appellation.id) }
        refused(CellarError.Code.MEAL_IN_USE) { meals.delete(meal.id) }
    }

    @Test
    fun `a new wine starts at its initial quantity, recorded as its first adjustment`() = runBlocking<Unit> {
        val input = newWine()

        val id = wines.create(input, initialQuantity = 6)

        assertEquals(6, database.wineDao().find(id)?.quantity)
        val adjustment = database.quantityAdjustmentDao().forWine(id).single()
        assertEquals(6, adjustment.delta)
        assertEquals("manual", adjustment.reason)
        assertEquals(input, wines.find(id))
    }

    @Test
    fun `a new wine needs at least one bottle and existing references`() = runBlocking<Unit> {
        val input = newWine()

        refused(CellarError.Code.INITIAL_QUANTITY_REQUIRED) { wines.create(input, initialQuantity = 0) }
        refused(CellarError.Code.APPELLATION_NOT_FOUND) { wines.create(input.copy(appellationId = 404), 1) }
        refused(CellarError.Code.PRODUCER_NOT_FOUND) { wines.create(input.copy(producerId = 404), 1) }
        assertEquals(0, database.wineDao().count())
    }

    @Test
    fun `updating a wine changes its fields but never its quantity`() = runBlocking<Unit> {
        val input = newWine()
        val id = wines.create(input, initialQuantity = 3)
        val other = producers.create("Laroche")
        val edited = input.copy(millesime = null, producerId = other.id, color = WineColor.ROSE, gardeDebut = 2027, gardeFin = 2030)

        wines.update(id, edited)

        assertEquals(edited, wines.find(id))
        assertEquals(3, database.wineDao().find(id)?.quantity)
        val shown = wines.observe(id).first()
        assertEquals("Laroche", shown?.producerName)
        assertEquals("Margaux", shown?.appellationName)
        refused(CellarError.Code.WINE_NOT_FOUND) { wines.update(404, edited) }
    }

    @Test
    fun `search data lists every wine with the current names and pairings`() = runBlocking<Unit> {
        val input = newWine()
        wines.create(input, initialQuantity = 2)
        val meal = meals.create("Agneau")
        database.mealPairingDao().insertAll(listOf(MealPairingEntity(input.appellationId, WineColor.ROUGE, meal.id)))

        val data = wines.observeSearchData().first()

        assertEquals(2, data.wines.single().quantity)
        assertEquals(listOf("Château Palmer"), data.producers.map { it.name })
        assertEquals(meal.id, data.pairings.single().mealId)
    }

    private suspend fun newWine(): WineInput = WineInput(
        millesime = 2015,
        appellationId = appellations.create("Margaux").id,
        producerId = producers.create("Château Palmer").id,
        color = WineColor.ROUGE,
        gardeDebut = 2022,
        gardeFin = 2040,
    )

    private suspend fun refused(code: CellarError.Code, block: suspend () -> Unit) {
        try {
            block()
            fail("expected $code")
        } catch (e: CellarError) {
            assertEquals(code, e.code)
        }
    }
}
