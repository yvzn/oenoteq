package net.ludeo.oenoteq.data

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.ForeignKey
import androidx.room.Index
import androidx.room.PrimaryKey
import net.ludeo.oenoteq.domain.WineColor

// Schema v1: the backend schema after migration 006, without the sync-only
// columns (client_id), with every foreign key enforced (RESTRICT) and indexed.
// Room can't express the backend's CHECK constraints; repositories enforce them.
// Timestamps are epoch millis.

@Entity(tableName = "appellation", indices = [Index(value = ["name"], unique = true)])
data class AppellationEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
)

@Entity(tableName = "producer", indices = [Index(value = ["name"], unique = true)])
data class ProducerEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
)

@Entity(tableName = "meal", indices = [Index(value = ["name"], unique = true)])
data class MealEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val name: String,
)

@Entity(
    tableName = "wine",
    foreignKeys = [
        ForeignKey(
            entity = AppellationEntity::class,
            parentColumns = ["id"],
            childColumns = ["appellation_id"],
            onDelete = ForeignKey.RESTRICT,
        ),
        ForeignKey(
            entity = ProducerEntity::class,
            parentColumns = ["id"],
            childColumns = ["producer_id"],
            onDelete = ForeignKey.RESTRICT,
        ),
    ],
    indices = [Index("appellation_id"), Index("producer_id")],
)
data class WineEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val millesime: Int?,
    @ColumnInfo(name = "appellation_id") val appellationId: Long,
    @ColumnInfo(name = "producer_id") val producerId: Long,
    val color: WineColor,
    @ColumnInfo(name = "garde_debut") val gardeDebut: Int?,
    @ColumnInfo(name = "garde_fin") val gardeFin: Int?,
    @ColumnInfo(defaultValue = "0") val quantity: Int,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
)

@Entity(
    tableName = "meal_pairing",
    primaryKeys = ["appellation_id", "color", "meal_id"],
    foreignKeys = [
        ForeignKey(
            entity = AppellationEntity::class,
            parentColumns = ["id"],
            childColumns = ["appellation_id"],
            onDelete = ForeignKey.RESTRICT,
        ),
        ForeignKey(
            entity = MealEntity::class,
            parentColumns = ["id"],
            childColumns = ["meal_id"],
            onDelete = ForeignKey.RESTRICT,
        ),
    ],
    indices = [Index("meal_id")],
)
data class MealPairingEntity(
    @ColumnInfo(name = "appellation_id") val appellationId: Long,
    val color: WineColor,
    @ColumnInfo(name = "meal_id") val mealId: Long,
)

@Entity(
    tableName = "consumption",
    foreignKeys = [
        ForeignKey(
            entity = WineEntity::class,
            parentColumns = ["id"],
            childColumns = ["wine_id"],
            onDelete = ForeignKey.RESTRICT,
        ),
    ],
    indices = [Index("wine_id"), Index("date")],
)
data class ConsumptionEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "wine_id") val wineId: Long,
    /** ISO `YYYY-MM-DD`. */
    val date: String,
    val rating: Int?,
    val notes: String?,
    @ColumnInfo(name = "created_at") val createdAt: Long,
    @ColumnInfo(name = "updated_at") val updatedAt: Long,
)

/** Manual stock correction ledger; a Wine's initial quantity is its first row (ADR 0007). */
@Entity(
    tableName = "quantity_adjustment",
    foreignKeys = [
        ForeignKey(
            entity = WineEntity::class,
            parentColumns = ["id"],
            childColumns = ["wine_id"],
            onDelete = ForeignKey.RESTRICT,
        ),
    ],
    indices = [Index("wine_id")],
)
data class QuantityAdjustmentEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    @ColumnInfo(name = "wine_id") val wineId: Long,
    val delta: Int,
    @ColumnInfo(defaultValue = "manual") val reason: String = "manual",
    @ColumnInfo(name = "created_at") val createdAt: Long,
)
