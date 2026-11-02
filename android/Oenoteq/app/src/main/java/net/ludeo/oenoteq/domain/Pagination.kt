package net.ludeo.oenoteq.domain

const val PAGE_SIZE = 10

data class Page<T>(val items: List<T>, val page: Int, val pageCount: Int, val total: Int)

/** Port of `web/src/domain/pagination.ts`: slices the full list; a page past either end clamps. */
fun <T> paginate(all: List<T>, requestedPage: Int): Page<T> {
    val pageCount = maxOf(1, (all.size + PAGE_SIZE - 1) / PAGE_SIZE)
    val page = requestedPage.coerceIn(1, pageCount)
    val start = (page - 1) * PAGE_SIZE
    return Page(all.subList(start, minOf(start + PAGE_SIZE, all.size)), page, pageCount, all.size)
}
