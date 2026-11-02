package net.ludeo.oenoteq.domain

/** In glossary order (CONTEXT.md), which is also the status sort order. */
enum class GardeStatus { TOO_YOUNG, READY, PAST_PEAK, UNASSESSED }

/** Port of `web/src/domain/gardeStatus.ts`. */
fun gardeStatus(gardeDebut: Int?, gardeFin: Int?, currentYear: Int): GardeStatus = when {
    gardeDebut == null && gardeFin == null -> GardeStatus.UNASSESSED
    gardeDebut != null && currentYear < gardeDebut -> GardeStatus.TOO_YOUNG
    gardeFin != null && currentYear > gardeFin -> GardeStatus.PAST_PEAK
    else -> GardeStatus.READY
}
