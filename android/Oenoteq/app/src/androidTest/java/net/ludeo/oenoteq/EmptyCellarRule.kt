package net.ludeo.oenoteq

import androidx.test.core.app.ApplicationProvider
import org.junit.rules.TestRule
import org.junit.runner.Description
import org.junit.runners.model.Statement

/**
 * An empty cellar before the activity starts. The app's database stays open
 * for the whole test process, so its tables are emptied rather than its file
 * deleted.
 */
class EmptyCellarRule : TestRule {
    override fun apply(base: Statement, description: Description) = object : Statement() {
        override fun evaluate() {
            container.database.clearAllTables()
            base.evaluate()
        }
    }
}

val container: AppContainer
    get() = ApplicationProvider.getApplicationContext<OenoteqApplication>().container
