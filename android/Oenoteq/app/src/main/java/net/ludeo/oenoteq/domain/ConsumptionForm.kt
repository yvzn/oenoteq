package net.ludeo.oenoteq.domain

import java.time.LocalDate
import java.time.format.DateTimeParseException

const val MIN_RATING = 1
const val MAX_RATING = 5

/** What a Consumption is saved with; the Wine it belongs to never changes. */
data class ConsumptionInput(val date: String, val rating: Int?, val notes: String?)

/**
 * The Go `validateConsumption` rules: date required and a real `YYYY-MM-DD`
 * day, rating absent or 1–5. Blank notes are stored as none, as the PWA does.
 */
fun ConsumptionInput.checked(): ConsumptionInput {
    if (date.isBlank()) throw CellarError(CellarError.Code.DATE_REQUIRED)
    if (!isIsoDate(date)) throw CellarError(CellarError.Code.INVALID_DATE)
    if (rating != null && rating !in MIN_RATING..MAX_RATING) throw CellarError(CellarError.Code.INVALID_RATING)
    return copy(notes = notes?.takeIf { it.isNotBlank() })
}

private val isoDate = Regex("""\d{4}-\d{2}-\d{2}""")

private fun isIsoDate(text: String): Boolean = isoDate.matches(text) &&
    try {
        LocalDate.parse(text)
        true
    } catch (_: DateTimeParseException) {
        false
    }

/** A signed stock correction as typed ("-1", "+3"); null when it is no whole non-zero number. */
fun parseQuantityDelta(text: String): Int? = text.trim().removePrefix("+").toIntOrNull()?.takeIf { it != 0 }
