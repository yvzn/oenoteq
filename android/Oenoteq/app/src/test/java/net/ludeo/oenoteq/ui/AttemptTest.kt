package net.ludeo.oenoteq.ui

import kotlinx.coroutines.runBlocking
import net.ludeo.oenoteq.domain.CellarError
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class AttemptTest {
    @Test
    fun `a write that succeeds has nothing to explain`() = runBlocking {
        assertNull(attempt {})
    }

    @Test
    fun `a refusal comes back as its own code`() = runBlocking {
        assertEquals(CellarError.Code.QUANTITY_ZERO, attempt { throw CellarError(CellarError.Code.QUANTITY_ZERO) })
    }

    @Test
    fun `anything unexpected becomes the generic error instead of a crash`() = runBlocking {
        assertEquals(CellarError.Code.INTERNAL_ERROR, attempt { error("disk full") })
    }
}
