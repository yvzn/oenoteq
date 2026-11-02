package net.ludeo.oenoteq.domain

/** A Producer, Appellation or Meal: all three are just a unique name. */
data class NamedItem(val id: Long, val name: String)

data class CellarWine(
    val id: Long,
    val millesime: Int?,
    val appellationId: Long,
    val producerId: Long,
    val color: WineColor,
    val gardeDebut: Int?,
    val gardeFin: Int?,
    val quantity: Int,
)

data class MealPairing(val appellationId: Long, val color: WineColor, val mealId: Long)

data class CellarSearchData(
    val wines: List<CellarWine>,
    val producers: List<NamedItem>,
    val appellations: List<NamedItem>,
    val pairings: List<MealPairing>,
)

data class WineListItem(
    val id: Long,
    val producerName: String,
    val appellationName: String,
    val millesime: Int?,
    val color: WineColor,
    val gardeDebut: Int?,
    val gardeFin: Int?,
    val quantity: Int,
    val gardeStatus: GardeStatus,
)

/**
 * The server's search (`SearchWines`) over the local data, ported from
 * `web/src/domain/localSearch.ts`: only wines in stock, filters ANDed, Garde
 * Status computed for [currentYear]. Proven against the same
 * `testdata/search-fixtures.json` as the Go and TypeScript versions.
 */
fun searchCellar(data: CellarSearchData, filters: SearchFilters, sort: WineSort, currentYear: Int): List<WineListItem> {
    val producerNames = data.producers.associate { it.id to it.name }
    val appellationNames = data.appellations.associate { it.id to it.name }
    val pairings = data.pairings.toSet()

    return data.wines.asSequence()
        .filter { it.quantity > 0 }
        .filter { filters.appellationId == null || it.appellationId == filters.appellationId }
        .filter { filters.color == null || it.color == filters.color }
        .filter { filters.mealId == null || MealPairing(it.appellationId, it.color, filters.mealId) in pairings }
        .map { w ->
            WineListItem(
                id = w.id,
                producerName = producerNames[w.producerId].orEmpty(),
                appellationName = appellationNames[w.appellationId].orEmpty(),
                millesime = w.millesime,
                color = w.color,
                gardeDebut = w.gardeDebut,
                gardeFin = w.gardeFin,
                quantity = w.quantity,
                gardeStatus = gardeStatus(w.gardeDebut, w.gardeFin, currentYear),
            )
        }
        .filter { !filters.readyNow || it.gardeStatus == GardeStatus.READY }
        .sortedWith(comparator(sort))
        .toList()
}

private fun comparator(sort: WineSort): Comparator<WineListItem> {
    val sign = if (sort.sortDir == SortDir.ASC) 1 else -1
    // Kotlin's String.compareTo is a plain UTF-16 code-unit comparison, like the server's BINARY collation.
    val byProducerThenId = compareBy<WineListItem>({ it.producerName }, { it.id })
    return when (sort.sortBy) {
        SortBy.PRODUCER -> Comparator<WineListItem> { a, b -> a.producerName.compareTo(b.producerName) * sign }
            .thenBy { it.id }
        SortBy.APPELLATION -> Comparator<WineListItem> { a, b -> a.appellationName.compareTo(b.appellationName) * sign }
            .then(byProducerThenId)
        SortBy.MILLESIME -> Comparator<WineListItem> { a, b -> compareNullsLast(a.millesime, b.millesime, sign) }
            .then(byProducerThenId)
        SortBy.STATUS -> Comparator<WineListItem> { a, b -> a.gardeStatus.compareTo(b.gardeStatus) * sign }
            .thenComparator { a, b -> compareNullsLast(a.gardeDebut, b.gardeDebut, sign) }
            .then(byProducerThenId)
    }
}

/** An absent value sorts after every present one, whatever the direction. */
private fun compareNullsLast(a: Int?, b: Int?, sign: Int): Int = when {
    a == null && b == null -> 0
    a == null -> 1
    b == null -> -1
    else -> a.compareTo(b) * sign
}
