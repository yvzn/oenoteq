package net.ludeo.oenoteq.data.snapshot

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneOffset
import java.time.format.DateTimeParseException

/**
 * Lenient parsing of the backend's SQLite date/time values. The Go driver and
 * SQLite's CURRENT_TIMESTAMP have written several shapes over time:
 * `2026-10-16 12:34:56`, RFC 3339 with or without fractional seconds and zone,
 * Go's `time.String()` (`2026-10-16 12:34:56.123 +0000 UTC`), or a bare date.
 * A value without a zone is UTC, as CURRENT_TIMESTAMP is.
 */
object SnapshotValues {
    private val dateTime = Regex(
        """^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,9}))?\s*(Z|[+-]\d{2}:?\d{2})?(?:\s+[A-Za-z][A-Za-z0-9_/+-]*)?)?$""",
    )

    /** Epoch millis, or null for a null value. Throws [IllegalArgumentException] when unreadable. */
    fun epochMillis(value: Any?): Long? = when (value) {
        null -> null
        is Long -> if (value < 100_000_000_000L) value * 1000 else value
        is Int -> value * 1000L
        is String -> parseText(value.trim())
        else -> throw IllegalArgumentException("unsupported timestamp: $value")
    }

    /** ISO `YYYY-MM-DD`, or null for a null value. Throws [IllegalArgumentException] when unreadable. */
    fun isoDate(value: Any?): String? = when (value) {
        null -> null
        is String -> {
            val match = dateTime.matchEntire(value.trim()) ?: throw IllegalArgumentException("unreadable date: $value")
            parseDate(match.groupValues[1]).toString()
        }
        else -> epochMillis(value)?.let {
            LocalDate.ofEpochDay(Math.floorDiv(it, 86_400_000L)).toString()
        }
    }

    private fun parseText(text: String): Long {
        val match = dateTime.matchEntire(text) ?: throw IllegalArgumentException("unreadable timestamp: $text")
        val (date, hour, minute, second, fraction, zone) = match.destructured
        val time = if (hour.isEmpty()) {
            LocalTime.MIDNIGHT
        } else {
            try {
                LocalTime.of(
                    hour.toInt(),
                    minute.toInt(),
                    second.ifEmpty { "0" }.toInt(),
                    fraction.padEnd(9, '0').ifEmpty { "0" }.toInt(),
                )
            } catch (e: java.time.DateTimeException) {
                throw IllegalArgumentException("unreadable timestamp: $text", e)
            }
        }
        val offset = when {
            zone.isEmpty() || zone == "Z" -> ZoneOffset.UTC
            else -> ZoneOffset.of(if (zone.length == 5) zone.substring(0, 3) + ":" + zone.substring(3) else zone)
        }
        return LocalDateTime.of(parseDate(date), time).toInstant(offset).toEpochMilli()
    }

    private fun parseDate(text: String): LocalDate = try {
        LocalDate.parse(text)
    } catch (e: DateTimeParseException) {
        throw IllegalArgumentException("unreadable date: $text", e)
    }
}
