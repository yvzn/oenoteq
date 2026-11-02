package net.ludeo.oenoteq.domain

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.int
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import org.junit.Assert.assertEquals
import org.junit.Test
import java.io.File
import java.time.Year

/**
 * The same `testdata/search-fixtures.json` drives the Go search tests
 * (internal/handlers) and the PWA's local search (web/src/domain), so all
 * three implementations are held to one set of answers.
 */
class CellarSearchTest {
    private val year = Year.now().value

    // Unit tests run from the app module: android/Oenoteq/app.
    private val fixtures = Json.parseToJsonElement(File("../../../testdata/search-fixtures.json").readText()).jsonObject

    private val data = CellarSearchData(
        wines = fixtures.getValue("wines").jsonArray.map { it.jsonObject }.map { w ->
            CellarWine(
                id = w.long("id"),
                millesime = w.intOrNull("millesime"),
                appellationId = w.long("appellation_id"),
                producerId = w.long("producer_id"),
                color = color(w.string("color")),
                gardeDebut = w.intOrNull("garde_debut_offset")?.plus(year),
                gardeFin = w.intOrNull("garde_fin_offset")?.plus(year),
                quantity = w.getValue("quantity").jsonPrimitive.int,
            )
        },
        producers = named("producers"),
        appellations = named("appellations"),
        pairings = fixtures.getValue("pairings").jsonArray.map { it.jsonObject }.map {
            MealPairing(it.long("appellation_id"), color(it.string("color")), it.long("meal_id"))
        },
    )

    @Test
    fun `every shared case gives the same wines in the same order`() {
        val cases = fixtures.getValue("cases").jsonArray.map { it.jsonObject }
        for (case in cases) {
            val filters = SearchFilters(
                mealId = case.longOrNull("meal_id"),
                appellationId = case.longOrNull("appellation_id"),
                color = case["color"]?.let { color(it.jsonPrimitive.content) },
                readyNow = case["ready_now"]?.jsonPrimitive?.boolean ?: false,
            )
            val sort = WineSort(
                sortBy = case["sort_by"]?.let { SortBy.valueOf(it.jsonPrimitive.content.uppercase()) } ?: SortBy.APPELLATION,
                sortDir = case["sort_dir"]?.let { SortDir.valueOf(it.jsonPrimitive.content.uppercase()) } ?: SortDir.ASC,
            )
            val expected = case.getValue("expected").jsonArray.map { it.jsonPrimitive.long }

            val actual = searchCellar(data, filters, sort, year).map { it.id }

            assertEquals(case.string("name"), expected, actual)
        }
    }

    @Test
    fun `results carry joined names and the Garde Status of the given year`() {
        val result = searchCellar(data, SearchFilters(appellationId = 1), WineSort(SortBy.PRODUCER), year)
            .first { it.id == 12L }

        assertEquals("Domaine Alpha", result.producerName)
        assertEquals("Chinon", result.appellationName)
        assertEquals(GardeStatus.READY, result.gardeStatus)
    }

    private fun named(key: String) = fixtures.getValue(key).jsonArray.map { it.jsonObject }
        .map { NamedItem(it.long("id"), it.string("name")) }

    private fun color(code: String) = requireNotNull(WineColor.fromCode(code))

    private fun JsonObject.long(key: String) = getValue(key).jsonPrimitive.long

    private fun JsonObject.string(key: String) = getValue(key).jsonPrimitive.content

    private fun JsonObject.intOrNull(key: String) = get(key)?.jsonPrimitive?.intOrNull

    private fun JsonObject.longOrNull(key: String) = get(key)?.jsonPrimitive?.intOrNull?.toLong()
}
