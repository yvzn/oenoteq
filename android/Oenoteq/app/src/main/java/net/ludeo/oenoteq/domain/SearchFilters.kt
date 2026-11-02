package net.ludeo.oenoteq.domain

import java.io.Serializable

/** The cellar list's filters, ANDed. History reuses the first three (`CommonFilters`). */
data class SearchFilters(
    val mealId: Long? = null,
    val appellationId: Long? = null,
    val color: WineColor? = null,
    val readyNow: Boolean = false,
) : Serializable {
    val activeCount: Int
        get() = listOf(mealId != null, appellationId != null, color != null, readyNow).count { it }
}
