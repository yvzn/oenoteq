package net.ludeo.oenoteq.domain

import java.io.Serializable

enum class SortBy { PRODUCER, APPELLATION, MILLESIME, STATUS }

enum class SortDir { ASC, DESC }

data class WineSort(val sortBy: SortBy = SortBy.APPELLATION, val sortDir: SortDir = SortDir.ASC) : Serializable {
    /** Switches to a new axis ascending, or flips the direction of the current one (`nextSort`). */
    fun next(axis: SortBy): WineSort =
        if (axis != sortBy) WineSort(axis, SortDir.ASC)
        else copy(sortDir = if (sortDir == SortDir.ASC) SortDir.DESC else SortDir.ASC)
}
