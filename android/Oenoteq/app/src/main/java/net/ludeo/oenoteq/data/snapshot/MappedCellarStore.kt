package net.ludeo.oenoteq.data.snapshot

import androidx.room.withTransaction
import net.ludeo.oenoteq.data.CellarDatabase

/** Every row of the cellar, read in one transaction so the copy is consistent. */
suspend fun CellarDatabase.readAll(): MappedCellar = withTransaction {
    MappedCellar(
        appellations = appellationDao().all(),
        producers = producerDao().all(),
        meals = mealDao().all(),
        wines = wineDao().all(),
        mealPairings = mealPairingDao().all(),
        consumptions = consumptionDao().all(),
        adjustments = quantityAdjustmentDao().all(),
    )
}

/**
 * Replaces everything the cellar holds with [cellar], ids preserved, in one
 * transaction: a failure rolls the old cellar back.
 */
suspend fun CellarDatabase.replaceAll(cellar: MappedCellar) = withTransaction {
    val cellarDao = cellarDao()
    cellarDao.deleteQuantityAdjustments()
    cellarDao.deleteConsumptions()
    cellarDao.deleteMealPairings()
    cellarDao.deleteWines()
    cellarDao.deleteMeals()
    cellarDao.deleteProducers()
    cellarDao.deleteAppellations()
    appellationDao().insertAll(cellar.appellations)
    producerDao().insertAll(cellar.producers)
    mealDao().insertAll(cellar.meals)
    wineDao().insertAll(cellar.wines)
    mealPairingDao().insertAll(cellar.mealPairings)
    consumptionDao().insertAll(cellar.consumptions)
    quantityAdjustmentDao().insertAll(cellar.adjustments)
}

fun MappedCellar.summary() = ImportSummary(
    wines = wines.size,
    producers = producers.size,
    appellations = appellations.size,
    meals = meals.size,
    mealPairings = mealPairings.size,
    consumptions = consumptions.size,
)
