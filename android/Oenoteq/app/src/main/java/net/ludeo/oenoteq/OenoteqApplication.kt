package net.ludeo.oenoteq

import android.app.Application

class OenoteqApplication : Application() {
    val container: AppContainer by lazy { AppContainer(this) }
}
