package net.ludeo.oenoteq.data.snapshot

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Test
import java.time.Instant

class SnapshotValuesTest {
    private fun millis(iso: String) = Instant.parse(iso).toEpochMilli()

    @Test
    fun `reads SQLite CURRENT_TIMESTAMP text as UTC`() {
        assertEquals(millis("2026-10-16T12:34:56Z"), SnapshotValues.epochMillis("2026-10-16 12:34:56"))
    }

    @Test
    fun `reads RFC 3339 with fractional seconds and zones`() {
        assertEquals(millis("2026-10-16T12:34:56Z"), SnapshotValues.epochMillis("2026-10-16T12:34:56Z"))
        assertEquals(millis("2026-10-16T12:34:56.123Z"), SnapshotValues.epochMillis("2026-10-16T12:34:56.123456789Z"))
        assertEquals(millis("2026-10-16T10:34:56Z"), SnapshotValues.epochMillis("2026-10-16T12:34:56+02:00"))
    }

    @Test
    fun `reads Go time String output`() {
        assertEquals(
            millis("2026-10-16T12:34:56.5Z"),
            SnapshotValues.epochMillis("2026-10-16 12:34:56.5 +0000 UTC"),
        )
        assertEquals(
            millis("2026-10-16T10:34:56Z"),
            SnapshotValues.epochMillis("2026-10-16 12:34:56 +0200 CEST"),
        )
    }

    @Test
    fun `reads a bare date as midnight UTC`() {
        assertEquals(millis("2026-10-16T00:00:00Z"), SnapshotValues.epochMillis("2026-10-16"))
    }

    @Test
    fun `reads integers as epoch seconds or millis`() {
        assertEquals(millis("2026-10-16T12:34:56Z"), SnapshotValues.epochMillis(millis("2026-10-16T12:34:56Z") / 1000))
        assertEquals(millis("2026-10-16T12:34:56Z"), SnapshotValues.epochMillis(millis("2026-10-16T12:34:56Z")))
    }

    @Test
    fun `keeps null as null`() {
        assertNull(SnapshotValues.epochMillis(null))
        assertNull(SnapshotValues.isoDate(null))
    }

    @Test
    fun `refuses unreadable values`() {
        assertThrows(IllegalArgumentException::class.java) { SnapshotValues.epochMillis("yesterday") }
        assertThrows(IllegalArgumentException::class.java) { SnapshotValues.epochMillis("2026-13-01 00:00:00") }
        assertThrows(IllegalArgumentException::class.java) { SnapshotValues.epochMillis("2026-10-16 25:00:00") }
        assertThrows(IllegalArgumentException::class.java) { SnapshotValues.isoDate("16/10/2026") }
    }

    @Test
    fun `normalises consumption dates to ISO`() {
        assertEquals("2026-10-16", SnapshotValues.isoDate("2026-10-16"))
        assertEquals("2026-10-16", SnapshotValues.isoDate("2026-10-16T00:00:00Z"))
        assertEquals("2026-10-16", SnapshotValues.isoDate("2026-10-16 00:00:00 +0000 UTC"))
    }
}
