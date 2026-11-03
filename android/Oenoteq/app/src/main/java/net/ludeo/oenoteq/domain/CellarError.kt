package net.ludeo.oenoteq.domain

/**
 * A rule the repositories refuse to break, one per error code the Go `db`
 * layer returns (`internal/handlers/handlers.go`), minus the network ones.
 */
class CellarError(val code: Code) : Exception(code.name) {
    enum class Code {
        NAME_REQUIRED,
        ALREADY_EXISTS,
        APPELLATION_NOT_FOUND,
        PRODUCER_NOT_FOUND,
        MEAL_NOT_FOUND,
        WINE_NOT_FOUND,
        APPELLATION_IN_USE,
        PRODUCER_IN_USE,
        MEAL_IN_USE,
        INITIAL_QUANTITY_REQUIRED,
        DATE_REQUIRED,
        INVALID_DATE,
        INVALID_RATING,
        QUANTITY_ZERO,
        CONSUMPTION_NOT_FOUND,

        /** Not a rule: something failed that no rule explains (`internal_error`). */
        INTERNAL_ERROR,
    }
}
