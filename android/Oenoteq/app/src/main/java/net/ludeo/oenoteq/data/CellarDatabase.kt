package net.ludeo.oenoteq.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import net.ludeo.oenoteq.domain.WineColor

class Converters {
    @TypeConverter fun colorToCode(color: WineColor): String = color.code

    @TypeConverter
    fun codeToColor(code: String): WineColor =
        requireNotNull(WineColor.fromCode(code)) { "Unknown color code: $code" }
}

// Every schema change from here on ships a Migration and a migration test;
// never fallbackToDestructiveMigration: real cellars live in this file.
@Database(
    version = 1,
    entities = [
        AppellationEntity::class,
        ProducerEntity::class,
        MealEntity::class,
        WineEntity::class,
        MealPairingEntity::class,
        ConsumptionEntity::class,
        QuantityAdjustmentEntity::class,
    ],
)
@TypeConverters(Converters::class)
abstract class CellarDatabase : RoomDatabase() {
    abstract fun appellationDao(): AppellationDao
    abstract fun producerDao(): ProducerDao
    abstract fun mealDao(): MealDao
    abstract fun wineDao(): WineDao
    abstract fun mealPairingDao(): MealPairingDao
    abstract fun consumptionDao(): ConsumptionDao
    abstract fun quantityAdjustmentDao(): QuantityAdjustmentDao
    abstract fun cellarDao(): CellarDao

    companion object {
        /** File name under the app's databases dir; the backup rules name it too. */
        const val FILE_NAME = "cellar.db"

        fun create(context: Context): CellarDatabase =
            Room.databaseBuilder(context, CellarDatabase::class.java, FILE_NAME).build()
    }
}
