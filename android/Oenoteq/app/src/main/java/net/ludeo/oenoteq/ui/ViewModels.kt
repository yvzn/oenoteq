package net.ludeo.oenoteq.ui

import androidx.lifecycle.ViewModelProvider.AndroidViewModelFactory.Companion.APPLICATION_KEY
import androidx.lifecycle.viewmodel.CreationExtras
import net.ludeo.oenoteq.AppContainer
import net.ludeo.oenoteq.OenoteqApplication

/** The app's dependencies, from inside a `viewModelFactory { initializer { … } }`. */
val CreationExtras.container: AppContainer
    get() = (this[APPLICATION_KEY] as OenoteqApplication).container
