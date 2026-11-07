package com.example.telemetry

import org.junit.Assert.*
import org.junit.Test

class TelemetryUnitTest {

    @Test
    fun defaultTelemetryReading_hasExpectedDefaults() {
        val reading = TelemetryReading()
        assertEquals("", reading.id)
        assertEquals("node_01", reading.nodeId)
        assertEquals(0.0, reading.temperature, 0.001)
        assertEquals(0.0, reading.humidity, 0.001)
        assertEquals(0L, reading.timestamp)
    }

    @Test
    fun customTelemetryReading_storesValuesAccurately() {
        val timestamp = 1715000000000L
        val reading = TelemetryReading(
            id = "key_123",
            nodeId = "node_02",
            temperature = 26.8,
            humidity = 58.4,
            timestamp = timestamp
        )
        assertEquals("key_123", reading.id)
        assertEquals("node_02", reading.nodeId)
        assertEquals(26.8, reading.temperature, 0.001)
        assertEquals(58.4, reading.humidity, 0.001)
        assertEquals(timestamp, reading.timestamp)
    }

    @Test
    fun telemetryReadings_sortChronologicallyDescending() {
        val r1 = TelemetryReading(id = "1", timestamp = 1000L)
        val r2 = TelemetryReading(id = "2", timestamp = 3000L)
        val r3 = TelemetryReading(id = "3", timestamp = 2000L)

        val list = mutableListOf(r1, r2, r3)
        list.sortByDescending { it.timestamp }

        assertEquals("2", list[0].id)
        assertEquals("3", list[1].id)
        assertEquals("1", list[2].id)
    }

    @Test
    fun formatTimestamp_formatsValidTimestamp() {
        val timestamp = 1715000000000L
        val formatted = formatTimestamp(timestamp)
        assertNotNull(formatted)
        assertTrue(formatted.contains(":"))
    }

    @Test
    fun formatTimestamp_handlesInvalidTimestampGracefully() {
        val formatted = formatTimestamp(0L)
        assertEquals("N/A", formatted)
    }

    @Test
    fun temperatureClassification_isAccurate() {
        fun classifyTemp(temp: Double): String = when {
            temp < 18.0 -> "Cool"
            temp <= 27.0 -> "Optimal"
            else -> "Warm"
        }

        assertEquals("Cool", classifyTemp(15.2))
        assertEquals("Optimal", classifyTemp(22.0))
        assertEquals("Optimal", classifyTemp(27.0))
        assertEquals("Warm", classifyTemp(31.5))
    }

    @Test
    fun humidityClassification_isAccurate() {
        fun classifyHumid(humidity: Double): String = when {
            humidity < 40.0 -> "Dry"
            humidity <= 60.0 -> "Comfortable"
            else -> "Humid"
        }

        assertEquals("Dry", classifyHumid(32.0))
        assertEquals("Comfortable", classifyHumid(50.0))
        assertEquals("Comfortable", classifyHumid(60.0))
        assertEquals("Humid", classifyHumid(72.5))
    }
}
