package net.ludeo.oenoteq.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import net.ludeo.oenoteq.domain.WineColor
import java.io.File

class Converters {
    @TypeConverter fun colorToCode(color: WineColor): String = color.code

    @TypeConverter
    fun codeToColor(code: String): WineColor =
        requireNotNull(WineColor.fromCode(code)) { "Unknown color code: $code" }
}

// Every schema change from here on ships a Migration and a migration test;
// never fallbackToDestructiveMigration: real cellars live in this file.
@Database(
    version = CellarDatabase.SCHEMA_VERSION,
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

        /** What `PRAGMA user_version` holds; an exported file from a higher one is refused. */
        const val SCHEMA_VERSION = 1

        fun create(context: Context): CellarDatabase =
            Room.databaseBuilder(context, CellarDatabase::class.java, FILE_NAME).build()

        /**
         * A cellar database in [file], which must sit in the app's databases dir (Room opens by
         * name). No write-ahead log: once closed, the file is the whole database.
         */
        fun openFile(context: Context, file: File): CellarDatabase =
            Room.databaseBuilder(context, CellarDatabase::class.java, file.name)
                .setJournalMode(RoomDatabase.JournalMode.TRUNCATE)
                .build()
    }
}
