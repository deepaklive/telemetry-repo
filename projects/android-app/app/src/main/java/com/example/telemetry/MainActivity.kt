package com.example.telemetry

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CloudDone
import androidx.compose.material.icons.filled.CloudOff
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Thermostat
import androidx.compose.material.icons.filled.WaterDrop
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.firebase.FirebaseApp
import com.google.firebase.database.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Telemetry snapshot data model matching ESP32 Firebase JSON payload
 */
data class TelemetryReading(
    val id: String = "",
    val nodeId: String = "node_01",
    val temperature: Double = 0.0,
    val humidity: Double = 0.0,
    val timestamp: Long = 0L
)

class MainActivity : ComponentActivity() {

    private var databaseRef: DatabaseReference? = null
    private var valueEventListener: ValueEventListener? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            TelemetryAppTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    TelemetryDashboardScreen(
                        onConnectFirebase = { onReadingReceived, onError ->
                            setupFirebaseListener(onReadingReceived, onError)
                        }
                    )
                }
            }
        }
    }

    private fun setupFirebaseListener(
        onDataUpdate: (List<TelemetryReading>) -> Unit,
        onError: (String) -> Unit
    ) {
        try {
            // Check if Firebase is initialized in the environment
            val app = if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseApp.initializeApp(this)
            } else {
                FirebaseApp.getInstance()
            }

            if (app == null) {
                onError("FirebaseApp is not configured. Provide google-services.json to connect.")
                return
            }

            val database = FirebaseDatabase.getInstance()
            databaseRef = database.getReference("sensors/node_01/readings")

            val query = databaseRef?.limitToLast(20)

            valueEventListener = object : ValueEventListener {
                override fun onDataChange(snapshot: DataSnapshot) {
                    if (!snapshot.exists()) {
                        onDataUpdate(emptyList())
                        return
                    }

                    val readings = mutableListOf<TelemetryReading>()
                    for (child in snapshot.children) {
                        val tempVal = child.child("temperature").getValue(Double::class.java)
                            ?: child.child("temperature").getValue(Long::class.java)?.toDouble()
                            ?: 0.0
                        val humVal = child.child("humidity").getValue(Double::class.java)
                            ?: child.child("humidity").getValue(Long::class.java)?.toDouble()
                            ?: 0.0
                        val timeVal = child.child("timestamp").getValue(Long::class.java)
                            ?: System.currentTimeMillis()
                        val nodeId = child.child("nodeId").getValue(String::class.java)
                            ?: "node_01"

                        readings.add(
                            TelemetryReading(
                                id = child.key ?: "",
                                nodeId = nodeId,
                                temperature = tempVal,
                                humidity = humVal,
                                timestamp = timeVal
                            )
                        )
                    }

                    // Sort descending (latest first)
                    readings.sortByDescending { it.timestamp }
                    onDataUpdate(readings)
                }

                override fun onCancelled(error: DatabaseError) {
                    onError(error.message)
                }
            }

            query?.addValueEventListener(valueEventListener as ValueEventListener)

        } catch (e: Exception) {
            onError("Connection note: ${e.localizedMessage ?: "Add google-services.json to sync"}")
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        valueEventListener?.let { listener ->
            databaseRef?.removeEventListener(listener)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TelemetryDashboardScreen(
    onConnectFirebase: (onReading: (List<TelemetryReading>) -> Unit, onError: (String) -> Unit) -> Unit
) {
    var readings by remember { mutableStateOf<List<TelemetryReading>>(emptyList()) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var isConnected by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        onConnectFirebase(
            { fetchedReadings ->
                readings = fetchedReadings
                isConnected = true
                errorMessage = null
            },
            { err ->
                errorMessage = err
                isConnected = false
                // Load fallback sample data so UI can be fully explored prior to Firebase linking
                if (readings.isEmpty()) {
                    readings = listOf(
                        TelemetryReading("demo1", "node_01", 24.5, 53.2, System.currentTimeMillis()),
                        TelemetryReading("demo2", "node_01", 24.2, 54.0, System.currentTimeMillis() - 900000),
                        TelemetryReading("demo3", "node_01", 23.9, 55.1, System.currentTimeMillis() - 1800000)
                    )
                }
            }
        )
    }

    val latestReading = readings.firstOrNull()

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Telemetry Monitor",
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = "ESP32 Node Station (node_01)",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                },
                actions = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.padding(end = 12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(10.dp)
                                .clip(CircleShape)
                                .background(if (isConnected) Color(0xFF388E3C) else Color(0xFFD32F2F))
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Icon(
                            imageVector = if (isConnected) Icons.Default.CloudDone else Icons.Default.CloudOff,
                            contentDescription = if (isConnected) "Connected" else "Disconnected",
                            tint = if (isConnected) Color(0xFF388E3C) else Color(0xFFD32F2F),
                            modifier = Modifier.size(18.dp)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.surfaceColorAtElevation(3.dp)
                )
            )
        }
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Notice banner if Firebase is not linked
            if (errorMessage != null) {
                item {
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = MaterialTheme.colorScheme.errorContainer
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Text(
                            text = "Notice: $errorMessage (Showing offline preview)",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onErrorContainer,
                            modifier = Modifier.padding(12.dp)
                        )
                    }
                }
            }

            // Realtime Metric Cards
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    // Temperature Card
                    MetricCard(
                        modifier = Modifier.weight(1f),
                        title = "Temperature",
                        value = latestReading?.let { "%.1f".format(it.temperature) } ?: "--.-",
                        unit = "°C",
                        icon = Icons.Default.Thermostat,
                        accentColor = Color(0xFFE64A19),
                        status = when {
                            latestReading == null -> "No Data"
                            latestReading.temperature < 18.0 -> "Cool"
                            latestReading.temperature <= 27.0 -> "Optimal"
                            else -> "Warm"
                        },
                        progress = latestReading?.let {
                            ((it.temperature - 10) / 35.0).coerceIn(0.0, 1.0).toFloat()
                        } ?: 0f
                    )

                    // Humidity Card
                    MetricCard(
                        modifier = Modifier.weight(1f),
                        title = "Humidity",
                        value = latestReading?.let { "%.1f".format(it.humidity) } ?: "--.-",
                        unit = "%",
                        icon = Icons.Default.WaterDrop,
                        accentColor = Color(0xFF0288D1),
                        status = when {
                            latestReading == null -> "No Data"
                            latestReading.humidity < 40.0 -> "Dry"
                            latestReading.humidity <= 60.0 -> "Comfortable"
                            else -> "Humid"
                        },
                        progress = latestReading?.let {
                            (it.humidity / 100.0).coerceIn(0.0, 1.0).toFloat()
                        } ?: 0f
                    )
                }
            }

            // Status Card
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = MaterialTheme.colorScheme.surfaceVariant
                    ),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Station Diagnostics",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        DiagnosticRow(
                            label = "Last Synchronized",
                            value = latestReading?.let { formatTimestamp(it.timestamp) } ?: "Awaiting pulse"
                        )
                        DiagnosticRow(label = "Node Target", value = "sensors/node_01/readings")
                        DiagnosticRow(label = "Sync Cadence", value = "Every 15 minutes")
                        DiagnosticRow(label = "Hardware Bus", value = "ESP32 (GPIO 27 DHT11, 4-bit LCD)")
                    }
                }
            }

            // Historical List Header
            item {
                Text(
                    text = "Recent Readings Log",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 8.dp)
                )
            }

            // Historical List Items
            items(readings) { item ->
                ReadingListItem(reading = item)
            }
        }
    }
}

@Composable
fun MetricCard(
    modifier: Modifier = Modifier,
    title: String,
    value: String,
    unit: String,
    icon: ImageVector,
    accentColor: Color,
    status: String,
    progress: Float
) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceColorAtElevation(1.dp)
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = accentColor,
                    modifier = Modifier.size(20.dp)
                )
            }

            Spacer(modifier = Modifier.height(10.dp))

            Row(verticalAlignment = Alignment.Bottom) {
                Text(
                    text = value,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.ExtraBold,
                    fontFamily = FontFamily.Monospace
                )
                Spacer(modifier = Modifier.width(4.dp))
                Text(
                    text = unit,
                    style = MaterialTheme.typography.titleMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 3.dp)
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(6.dp)
                    .clip(RoundedCornerShape(3.dp)),
                color = accentColor,
                trackColor = MaterialTheme.colorScheme.surfaceVariant
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = status,
                style = MaterialTheme.typography.labelSmall,
                color = accentColor,
                fontWeight = FontWeight.SemiBold
            )
        }
    }
}

@Composable
fun DiagnosticRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
fun ReadingListItem(reading: TelemetryReading) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceColorAtElevation(1.dp)
        )
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = formatTimestamp(reading.timestamp),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Text(
                    text = reading.nodeId,
                    style = MaterialTheme.typography.labelSmall,
                    fontFamily = FontFamily.Monospace,
                    color = MaterialTheme.colorScheme.primary
                )
            }

            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Text(
                    text = "%.1f°C".format(reading.temperature),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = Color(0xFFE64A19)
                )
                Text(
                    text = "%.1f%%".format(reading.humidity),
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Bold,
                    fontFamily = FontFamily.Monospace,
                    color = Color(0xFF0288D1)
                )
            }
        }
    }
}

fun formatTimestamp(timestamp: Long): String {
    if (timestamp <= 0L) return "N/A"
    val sdf = SimpleDateFormat("HH:mm:ss (dd MMM)", Locale.getDefault())
    return sdf.format(Date(timestamp))
}

@Composable
fun TelemetryAppTheme(content: @Composable () -> Unit) {
    val darkColorScheme = darkColorScheme(
        primary = Color(0xFF90CAF9),
        onPrimary = Color(0xFF0D47A1),
        secondary = Color(0xFF80CBC4),
        background = Color(0xFF121212),
        surface = Color(0xFF1E1E1E),
        surfaceVariant = Color(0xFF2C2C2C),
        error = Color(0xFFCF6679)
    )

    MaterialTheme(
        colorScheme = darkColorScheme,
        typography = Typography(),
        content = content
    )
}
