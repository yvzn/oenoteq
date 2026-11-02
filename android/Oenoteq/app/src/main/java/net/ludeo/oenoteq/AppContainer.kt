package net.ludeo.oenoteq

import android.content.Context
import net.ludeo.oenoteq.data.CellarDatabase
import net.ludeo.oenoteq.data.ConsumptionRepository
import net.ludeo.oenoteq.data.MealPairingRepository
import net.ludeo.oenoteq.data.ReferentialRepository
import net.ludeo.oenoteq.data.WineRepository
import net.ludeo.oenoteq.data.snapshot.SnapshotImporter
import net.ludeo.oenoteq.domain.Referential

/** Manual dependency wiring: one instance per app process, created by [OenoteqApplication]. */
class AppContainer(context: Context) {
    val database: CellarDatabase = CellarDatabase.create(context)
    val snapshotImporter = SnapshotImporter(database, context.contentResolver, context.cacheDir)
    val wines = WineRepository(database)
    val consumptions = ConsumptionRepository(database)
    val mealPairings = MealPairingRepository(database)
    private val referentials = Referential.entries.associateWith { ReferentialRepository(database, it) }

    fun referentials(kind: Referential): ReferentialRepository = referentials.getValue(kind)
}
