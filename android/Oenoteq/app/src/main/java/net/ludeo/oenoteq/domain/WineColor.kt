package net.ludeo.oenoteq.domain

/** A Wine's Color (CONTEXT.md). [code] is the value stored in the database, as on the backend. */
enum class WineColor(val code: String) {
    ROUGE("rouge"),
    BLANC("blanc"),
    ROSE("rose");

    companion object {
        fun fromCode(code: String): WineColor? = entries.firstOrNull { it.code == code }
    }
}
