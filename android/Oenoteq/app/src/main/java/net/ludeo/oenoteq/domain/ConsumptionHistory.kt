package net.ludeo.oenoteq.domain

import java.io.Serializable

enum class HistorySortBy { PRODUCER, APPELLATION, MILLESIME, DATE }

/** Defaults to newest first, as `defaultConsumptionHistorySort`. */
data class HistorySort(val sortBy: HistorySortBy = HistorySortBy.DATE, val sortDir: SortDir = SortDir.DESC) : Serializable

/** One row of the Consumption History: a Consumption with its Wine's current names. */
data class HistoryEntry(
    val id: Long,
    val wineId: Long,
    /** ISO `YYYY-MM-DD`, so text order is date order. */
    val date: String,
    val producerName: String,
    val appellationId: Long,
    val appellationName: String,
    val color: WineColor,
    val millesime: Int?,
)

/**
 * The server's `ListConsumptionHistory`: every Consumption, Wines at quantity
 * 0 included, filtered on its Wine like the cellar (no "ready now"), sorted as
 * `sortConsumptionHistorySQL`: newest first (higher id first on the same day)
 * breaks every tie, and Wines without a millesime come last.
 */
fun consumptionHistory(
    entries: List<HistoryEntry>,
    pairings: List<MealPairing>,
    filters: SearchFilters,
    sort: HistorySort,
): List<HistoryEntry> {
    val paired = pairings.toSet()
    val sign = if (sort.sortDir == SortDir.ASC) 1 else -1
    val newestFirst = compareByDescending<HistoryEntry> { it.date }.thenByDescending { it.id }
    val order = when (sort.sortBy) {
        HistorySortBy.PRODUCER -> Comparator<HistoryEntry> { a, b -> a.producerName.compareTo(b.producerName) * sign }
            .then(newestFirst)
        HistorySortBy.APPELLATION -> Comparator<HistoryEntry> { a, b -> a.appellationName.compareTo(b.appellationName) * sign }
            .then(newestFirst)
        HistorySortBy.MILLESIME -> Comparator<HistoryEntry> { a, b ->
            when {
                a.millesime == null || b.millesime == null -> compareValues(a.millesime == null, b.millesime == null)
                else -> a.millesime.compareTo(b.millesime) * sign
            }
        }.then(newestFirst)
        HistorySortBy.DATE -> Comparator<HistoryEntry> { a, b -> a.date.compareTo(b.date) * sign }
            .thenByDescending { it.id }
    }
    return entries
        .filter { filters.appellationId == null || it.appellationId == filters.appellationId }
        .filter { filters.color == null || it.color == filters.color }
        .filter { filters.mealId == null || MealPairing(it.appellationId, it.color, filters.mealId) in paired }
        .sortedWith(order)
}
