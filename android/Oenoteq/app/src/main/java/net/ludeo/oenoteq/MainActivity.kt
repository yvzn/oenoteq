package net.ludeo.oenoteq

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import net.ludeo.oenoteq.ui.OenoteqApp
import net.ludeo.oenoteq.ui.theme.OenoteqTheme

// AppCompatActivity rather than ComponentActivity: per-app language below Android 13.
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            OenoteqTheme {
                OenoteqApp()
            }
        }
    }
}
