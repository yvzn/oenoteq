package net.ludeo.oenoteq

import android.content.Context
import net.ludeo.oenoteq.data.CellarDatabase
import net.ludeo.oenoteq.data.snapshot.SnapshotImporter

/** Manual dependency wiring: one instance per app process, created by [OenoteqApplication]. */
class AppContainer(context: Context) {
    val database: CellarDatabase = CellarDatabase.create(context)
    val snapshotImporter = SnapshotImporter(database, context.contentResolver, context.cacheDir)
}
