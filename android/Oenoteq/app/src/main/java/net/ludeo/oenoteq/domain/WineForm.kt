package net.ludeo.oenoteq.domain

/** What the Wine form holds as typed; ported from `web/src/domain/wineForm.ts`. */
data class WineFormFields(
    val millesime: String = "",
    val appellationId: Long? = null,
    val producerId: Long? = null,
    val color: WineColor? = null,
    val gardeDebut: String = "",
    val gardeFin: String = "",
    val quantity: String = "1",
)

enum class WineFormField { MILLESIME, APPELLATION, PRODUCER, COLOR, GARDE_DEBUT, GARDE_FIN, QUANTITY }

enum class WineFormError { APPELLATION_REQUIRED, PRODUCER_REQUIRED, COLOR_REQUIRED, GARDE_END_BEFORE_START, QUANTITY_MIN, NOT_A_YEAR }

/** What a Wine is saved with; quantity is set only on create (ADR 0007). */
data class WineInput(
    val millesime: Int?,
    val appellationId: Long,
    val producerId: Long,
    val color: WineColor,
    val gardeDebut: Int?,
    val gardeFin: Int?,
)

const val MIN_INITIAL_QUANTITY = 1

/** [isNew] adds the initial quantity check: editing a Wine never touches its quantity. */
fun validateWineForm(fields: WineFormFields, isNew: Boolean): Map<WineFormField, WineFormError> = buildMap {
    if (fields.appellationId == null) put(WineFormField.APPELLATION, WineFormError.APPELLATION_REQUIRED)
    if (fields.producerId == null) put(WineFormField.PRODUCER, WineFormError.PRODUCER_REQUIRED)
    if (fields.color == null) put(WineFormField.COLOR, WineFormError.COLOR_REQUIRED)

    // The PWA gets this from <input type="number">; here a non-number has to be caught by hand.
    for ((field, text) in listOf(
        WineFormField.MILLESIME to fields.millesime,
        WineFormField.GARDE_DEBUT to fields.gardeDebut,
        WineFormField.GARDE_FIN to fields.gardeFin,
    )) {
        if (text.isNotBlank() && text.trim().toIntOrNull() == null) put(field, WineFormError.NOT_A_YEAR)
    }

    val debut = parseNumber(fields.gardeDebut)
    val fin = parseNumber(fields.gardeFin)
    if (debut != null && fin != null && debut > fin) put(WineFormField.GARDE_FIN, WineFormError.GARDE_END_BEFORE_START)

    if (isNew) {
        val quantity = parseNumber(fields.quantity)
        if (quantity == null || quantity < MIN_INITIAL_QUANTITY) put(WineFormField.QUANTITY, WineFormError.QUANTITY_MIN)
    }
}

/** Call only once [validateWineForm] found nothing. */
fun WineFormFields.toInput() = WineInput(
    millesime = parseNumber(millesime),
    appellationId = checkNotNull(appellationId),
    producerId = checkNotNull(producerId),
    color = checkNotNull(color),
    gardeDebut = parseNumber(gardeDebut),
    gardeFin = parseNumber(gardeFin),
)

fun WineFormFields.initialQuantity(): Int = checkNotNull(parseNumber(quantity))

fun WineInput.toFormFields() = WineFormFields(
    millesime = millesime?.toString().orEmpty(),
    appellationId = appellationId,
    producerId = producerId,
    color = color,
    gardeDebut = gardeDebut?.toString().orEmpty(),
    gardeFin = gardeFin?.toString().orEmpty(),
)

/** Leaving the start field fills an empty end with the same year (`deriveGardeFin`). */
fun deriveGardeFin(gardeDebut: String, gardeFin: String): String = gardeFin.ifEmpty { gardeDebut }

private fun parseNumber(value: String): Int? = value.trim().toIntOrNull()
