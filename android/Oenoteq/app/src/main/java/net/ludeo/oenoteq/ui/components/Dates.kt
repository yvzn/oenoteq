package net.ludeo.oenoteq.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CalendarMonth
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.os.ConfigurationCompat
import net.ludeo.oenoteq.R
import net.ludeo.oenoteq.domain.MAX_RATING
import net.ludeo.oenoteq.domain.MIN_RATING
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeParseException
import java.time.format.FormatStyle

/** An ISO `YYYY-MM-DD` day in the app's language, long style as the PWA's `formatDate`; as is when unreadable. */
@Composable
fun formatDate(isoDate: String): String {
    val locale = ConfigurationCompat.getLocales(LocalConfiguration.current)[0]
    return try {
        LocalDate.parse(isoDate).format(DateTimeFormatter.ofLocalizedDate(FormatStyle.LONG).withLocale(locale))
    } catch (_: DateTimeParseException) {
        isoDate
    }
}

/** A day typed as `YYYY-MM-DD`, or picked from a calendar. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateField(value: String, onChange: (String) -> Unit, testTag: String, modifier: Modifier = Modifier) {
    var picking by remember { mutableStateOf(false) }
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(stringResource(R.string.consumption_date)) },
        placeholder = { Text("YYYY-MM-DD") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        trailingIcon = {
            IconButton(onClick = { picking = true }) { Icon(Icons.Outlined.CalendarMonth, contentDescription = null) }
        },
        modifier = modifier.testTag(testTag),
    )
    if (picking) {
        val initial = runCatching { LocalDate.parse(value) }.getOrNull()
        // The picker works in UTC midnight millis.
        val state = rememberDatePickerState(initial?.atStartOfDay(ZoneOffset.UTC)?.toInstant()?.toEpochMilli())
        DatePickerDialog(
            onDismissRequest = { picking = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let {
                        onChange(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate().toString())
                    }
                    picking = false
                }) { Text(stringResource(R.string.action_ok)) }
            },
            dismissButton = {
                TextButton(onClick = { picking = false }) { Text(stringResource(R.string.action_cancel)) }
            },
        ) { DatePicker(state) }
    }
}

/** 1 to 5; tapping the chosen value again clears it, since a rating is optional. */
@Composable
fun RatingField(value: Int?, onChange: (Int?) -> Unit, testTag: String) {
    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        for (rating in MIN_RATING..MAX_RATING) {
            FilterChip(
                selected = value == rating,
                onClick = { onChange(if (value == rating) null else rating) },
                label = { Text(rating.toString()) },
                modifier = Modifier.testTag("$testTag-$rating"),
            )
        }
    }
}
