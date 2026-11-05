package net.ludeo.oenoteq.data.snapshot

/** Why a one-time import was refused. Nothing is ever written when one is thrown. */
sealed class SnapshotImportError(message: String) : Exception(message) {
    /** Not a SQLite file, or a SQLite file without the backend's tables. */
    class NotACellarDatabase : SnapshotImportError("not a cellar database")

    /** `PRAGMA integrity_check` failed. */
    class Corrupt : SnapshotImportError("snapshot is corrupt")

    /** The snapshot's last backend migration isn't the one this app reads. */
    class UnsupportedSchema(val found: String?) :
        SnapshotImportError("unsupported backend schema: ${found ?: "none"}")

    /** Something is already recorded on the device; the import never merges. */

    /** Rows pointing at a missing parent, counted per table. */
    class OrphanRows(val countsByTable: Map<String, Int>) :
        SnapshotImportError("orphan rows: $countsByTable")

    /** The first row breaking one of the app's rules. */
    class InvalidRow(val table: String, val id: Long, val reason: Reason) :
        SnapshotImportError("invalid $table row $id: $reason")

    enum class Reason {
        BLANK_NAME,
        DUPLICATE_NAME,
        INVALID_COLOR,
        INVALID_RATING,
        NEGATIVE_QUANTITY,
        INVALID_DATE,
        INVALID_TIMESTAMP,
    }
}
