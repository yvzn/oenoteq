package net.ludeo.oenoteq.ui.components

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.domain.CellarError
import net.ludeo.oenoteq.domain.GardeStatus
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.domain.WineColor

// Display labels for stored values; the stored codes never change (docs/i18n-vocabulary.md).

@StringRes
fun WineColor.label(): Int = when (this) {
    WineColor.ROUGE -> R.string.color_rouge
    WineColor.BLANC -> R.string.color_blanc
    WineColor.ROSE -> R.string.color_rose
}

@StringRes
fun GardeStatus.label(): Int = when (this) {
    GardeStatus.TOO_YOUNG -> R.string.garde_status_too_young
    GardeStatus.READY -> R.string.garde_status_ready
    GardeStatus.PAST_PEAK -> R.string.garde_status_past_peak
    GardeStatus.UNASSESSED -> R.string.garde_status_unassessed
}

@StringRes
fun CellarError.Code.message(): Int = when (this) {
    CellarError.Code.NAME_REQUIRED -> R.string.error_name_required
    CellarError.Code.ALREADY_EXISTS -> R.string.error_already_exists
    CellarError.Code.APPELLATION_NOT_FOUND -> R.string.error_appellation_not_found
    CellarError.Code.PRODUCER_NOT_FOUND -> R.string.error_producer_not_found
    CellarError.Code.MEAL_NOT_FOUND -> R.string.error_meal_not_found
    CellarError.Code.WINE_NOT_FOUND -> R.string.error_wine_not_found
    CellarError.Code.APPELLATION_IN_USE -> R.string.error_appellation_in_use
    CellarError.Code.PRODUCER_IN_USE -> R.string.error_producer_in_use
    CellarError.Code.MEAL_IN_USE -> R.string.error_meal_in_use
    CellarError.Code.INITIAL_QUANTITY_REQUIRED -> R.string.error_initial_quantity_required
}

/** The texts of a Manage list and its form, per kind of reference data. */
data class ReferentialTexts(
    @StringRes val label: Int,
    @StringRes val description: Int,
    @StringRes val add: Int,
    @StringRes val empty: Int,
    @StringRes val deleteConfirm: Int,
    @StringRes val renameTitle: Int,
)

val Referential.texts: ReferentialTexts
    get() = when (this) {
        Referential.PRODUCER -> ReferentialTexts(
            R.string.manage_producers_label, R.string.manage_producers_description, R.string.manage_producers_add,
            R.string.manage_producers_empty, R.string.manage_producers_delete_confirm,
            R.string.manage_producers_rename_title,
        )
        Referential.APPELLATION -> ReferentialTexts(
            R.string.manage_appellations_label, R.string.manage_appellations_description,
            R.string.manage_appellations_add, R.string.manage_appellations_empty,
            R.string.manage_appellations_delete_confirm, R.string.manage_appellations_rename_title,
        )
        Referential.MEAL -> ReferentialTexts(
            R.string.manage_meals_label, R.string.manage_meals_description, R.string.manage_meals_add,
            R.string.manage_meals_empty, R.string.manage_meals_delete_confirm, R.string.manage_meals_rename_title,
        )
    }

/** A millesime as a plain year (no grouping), or NV. */
@Composable
fun millesimeText(millesime: Int?): String = millesime?.toString() ?: stringResource(R.string.no_millesime)
