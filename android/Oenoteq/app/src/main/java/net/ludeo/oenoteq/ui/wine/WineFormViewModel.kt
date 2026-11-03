package net.ludeo.oenoteq.ui.wine

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.initializer
import androidx.lifecycle.viewmodel.viewModelFactory
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import net.ludeo.oenoteq.data.ReferentialRepository
import net.ludeo.oenoteq.data.WineRepository
import net.ludeo.oenoteq.domain.CellarError
import net.ludeo.oenoteq.domain.NamedItem
import net.ludeo.oenoteq.domain.Referential
import net.ludeo.oenoteq.domain.WineFormError
import net.ludeo.oenoteq.domain.WineFormField
import net.ludeo.oenoteq.domain.WineFormFields
import net.ludeo.oenoteq.domain.deriveGardeFin
import net.ludeo.oenoteq.domain.initialQuantity
import net.ludeo.oenoteq.domain.toFormFields
import net.ludeo.oenoteq.domain.toInput
import net.ludeo.oenoteq.domain.validateWineForm
import net.ludeo.oenoteq.ui.attempt
import net.ludeo.oenoteq.ui.container

data class WineFormState(
    val loading: Boolean,
    val fields: WineFormFields = WineFormFields(),
    val errors: Map<WineFormField, WineFormError> = emptyMap(),
    /** A refusal from the repository: on save, or when creating an Appellation or Producer inline. */
    val refusals: Map<WineFormField, CellarError.Code> = emptyMap(),
    val saveError: CellarError.Code? = null,
    val missing: Boolean = false,
    val saving: Boolean = false,
    val savedId: Long? = null,
)

/** Adds a Wine, or edits the one [editId] points at (never its quantity, ADR 0007). */
class WineFormViewModel(
    val editId: Long?,
    private val wines: WineRepository,
    private val producers: ReferentialRepository,
    private val appellations: ReferentialRepository,
) : ViewModel() {
    val isNew = editId == null
    private val form = MutableStateFlow(WineFormState(loading = editId != null))

    val state: StateFlow<WineFormState> = form.asStateFlow()
    val appellationOptions: StateFlow<List<NamedItem>> = appellations.observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())
    val producerOptions: StateFlow<List<NamedItem>> = producers.observeAll()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    init {
        if (editId != null) {
            viewModelScope.launch {
                val wine = wines.find(editId)
                form.value = WineFormState(loading = false, fields = wine?.toFormFields() ?: WineFormFields(), missing = wine == null)
            }
        }
    }

    fun edit(change: (WineFormFields) -> WineFormFields) = form.update { state ->
        val next = change(state.fields)
        // A choice clears the "required" error it answers, as the PWA does.
        val cleared = state.errors.filterKeys { field ->
            when (field) {
                WineFormField.APPELLATION -> next.appellationId == null
                WineFormField.PRODUCER -> next.producerId == null
                WineFormField.COLOR -> next.color == null
                else -> true
            }
        }
        state.copy(fields = next, errors = cleared, saveError = null)
    }

    /** Leaving the start year fills an empty end year with it. */
    fun gardeDebutDone() = edit { it.copy(gardeFin = deriveGardeFin(it.gardeDebut, it.gardeFin)) }

    fun create(kind: Referential, name: String) {
        val field = if (kind == Referential.APPELLATION) WineFormField.APPELLATION else WineFormField.PRODUCER
        val repository = if (kind == Referential.APPELLATION) appellations else producers
        form.update { it.copy(refusals = it.refusals - field) }
        viewModelScope.launch {
            val refusal = attempt {
                val created = repository.create(name)
                edit { if (kind == Referential.APPELLATION) it.copy(appellationId = created.id) else it.copy(producerId = created.id) }
            }
            if (refusal != null) form.update { it.copy(refusals = it.refusals + (field to refusal)) }
        }
    }

    fun save() {
        val current = form.value
        if (current.saving) return
        val errors = validateWineForm(current.fields, isNew)
        form.value = current.copy(errors = errors, saveError = null)
        if (errors.isNotEmpty()) return

        form.update { it.copy(saving = true) }
        viewModelScope.launch {
            var id: Long? = null
            val refusal = attempt {
                val input = current.fields.toInput()
                id = if (editId == null) {
                    wines.create(input, current.fields.initialQuantity())
                } else {
                    wines.update(editId, input).let { editId }
                }
            }
            form.update { it.copy(saving = false, savedId = id, saveError = refusal) }
        }
    }

    companion object {
        /** [editId] null adds a new Wine. */
        fun factory(editId: Long?) = viewModelFactory {
            initializer {
                WineFormViewModel(
                    editId,
                    container.wines,
                    container.referentials(Referential.PRODUCER),
                    container.referentials(Referential.APPELLATION),
                )
            }
        }
    }
}
