package net.ludeo.oenoteq.data.snapshot

// Rows as read from a backend snapshot, before any validation. Timestamp and
// date columns keep whatever SQLite held (text, integer or null), so the
// mapper decides what is acceptable.

data class SnapshotNamed(val id: Long, val name: String?)

data class SnapshotWine(
    val id: Long,
    val millesime: Int?,
    val appellationId: Long,
    val producerId: Long,
    val color: String?,
    val gardeDebut: Int?,
    val gardeFin: Int?,
    val quantity: Int,
    val createdAt: Any?,
    val updatedAt: Any?,
)

data class SnapshotMealPairing(val appellationId: Long, val color: String?, val mealId: Long)

data class SnapshotConsumption(
    val id: Long,
    val wineId: Long,
    val date: Any?,
    val rating: Int?,
    val notes: String?,
    val createdAt: Any?,
    val updatedAt: Any?,
)

data class SnapshotAdjustment(
    val id: Long,
    val wineId: Long,
    val delta: Int,
    val reason: String?,
    val createdAt: Any?,
)

data class SnapshotRows(
    val appellations: List<SnapshotNamed>,
    val producers: List<SnapshotNamed>,
    val meals: List<SnapshotNamed>,
    val wines: List<SnapshotWine>,
    val mealPairings: List<SnapshotMealPairing>,
    val consumptions: List<SnapshotConsumption>,
    val adjustments: List<SnapshotAdjustment>,
)
