package net.ludeo.oenoteq.ui.components

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.domain.CellarError
import net.ludeo.oenoteq.domain.GardeStatus
import net.ludeo.oenoteq.domain.HistorySortBy
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.domain.SortBy
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
    CellarError.Code.DATE_REQUIRED -> R.string.error_date_required
    CellarError.Code.INVALID_DATE -> R.string.error_invalid_date
    CellarError.Code.INVALID_RATING -> R.string.error_invalid_rating
    CellarError.Code.QUANTITY_ZERO -> R.string.error_quantity_zero
    CellarError.Code.CONSUMPTION_NOT_FOUND -> R.string.error_consumption_not_found
    CellarError.Code.INTERNAL_ERROR -> R.string.error_generic
}

/** The texts of a Manage list and its form, per kind of reference data. */
data class ReferentialTexts(
    @StringRes val label: Int,
    @StringRes val description: Int,
    @StringRes val add: Int,
    @StringRes val empty: Int,
    @StringRes val deleteConfirm: Int,
    @StringRes val renameTitle: Int,
    @StringRes val added: Int,
    @StringRes val updated: Int,
)

val Referential.texts: ReferentialTexts
    get() = when (this) {
        Referential.PRODUCER -> ReferentialTexts(
            R.string.manage_producers_label, R.string.manage_producers_description, R.string.manage_producers_add,
            R.string.manage_producers_empty, R.string.manage_producers_delete_confirm,
            R.string.manage_producers_rename_title, R.string.notice_producer_added, R.string.notice_producer_updated,
        )
        Referential.APPELLATION -> ReferentialTexts(
            R.string.manage_appellations_label, R.string.manage_appellations_description,
            R.string.manage_appellations_add, R.string.manage_appellations_empty,
            R.string.manage_appellations_delete_confirm, R.string.manage_appellations_rename_title,
            R.string.notice_appellation_added, R.string.notice_appellation_updated,
        )
        Referential.MEAL -> ReferentialTexts(
            R.string.manage_meals_label, R.string.manage_meals_description, R.string.manage_meals_add,
            R.string.manage_meals_empty, R.string.manage_meals_delete_confirm, R.string.manage_meals_rename_title,
            R.string.notice_meal_added, R.string.notice_meal_updated,
        )
    }

/** A millesime as a plain year (no grouping), or NV. */
@Composable
fun millesimeText(millesime: Int?): String = millesime?.toString() ?: stringResource(R.string.no_millesime)

/** Sort axes that are Wine vocabulary share its labels; Status is the cellar list's own column. */
@StringRes
fun SortBy.label(): Int = when (this) {
    SortBy.PRODUCER -> R.string.label_producer
    SortBy.APPELLATION -> R.string.label_appellation
    SortBy.MILLESIME -> R.string.label_millesime
    SortBy.STATUS -> R.string.label_status
}

@StringRes
fun HistorySortBy.label(): Int = when (this) {
    HistorySortBy.PRODUCER -> R.string.label_producer
    HistorySortBy.APPELLATION -> R.string.label_appellation
    HistorySortBy.MILLESIME -> R.string.label_millesime
    HistorySortBy.DATE -> R.string.history_sort_date
}
