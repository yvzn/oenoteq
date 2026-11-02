package net.ludeo.oenoteq.domain

/** The reference data the Manage hub edits: each kind is a list of unique names. */
enum class Referential { PRODUCER, APPELLATION, MEAL }

/** The name as stored: trimmed, as the PWA's name forms do (`domain/nameForm.ts`). */
fun normalizeName(name: String): String = name.trim()

/** Port of the autocomplete's "create new" rule: offered when no name matches, ignoring case. */
fun offersCreate(query: String, names: List<String>): Boolean {
    val q = query.trim().lowercase()
    return q.isNotEmpty() && names.none { it.trim().lowercase() == q }
}

/** The names the autocomplete lists for [query]: all of them when empty, else those containing it, ignoring case. */
fun <T> matching(query: String, items: List<T>, name: (T) -> String): List<T> {
    val q = query.trim().lowercase()
    return if (q.isEmpty()) items else items.filter { name(it).lowercase().contains(q) }
}
