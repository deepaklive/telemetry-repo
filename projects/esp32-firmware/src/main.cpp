/**
 * @file main.cpp
 * @brief ESP32 Telemetry Publisher with DHT11, 16x2 LCD, and Firebase RTDB
 * 
 * Hardware Connections:
 * - DHT11 Data:    GPIO 27
 * - LCD RS:        GPIO 19
 * - LCD E:         GPIO 23
 * - LCD DB4:       GPIO 18
 * - LCD DB5:       GPIO 5
 * - LCD DB6:       GPIO 4
 * - LCD DB7:       GPIO 2
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <time.h>

#include "sensor_interface.h"
#include "display_interface.h"

// =========================================================================
// Configuration & Constants
// =========================================================================

// Network Credentials (Replace with your actual WiFi credentials)
const char* WIFI_SSID     = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Firebase Realtime Database Settings
// Example: "https://your-project-default-rtdb.firebaseio.com"
const char* FIREBASE_HOST = "https://your-project-id-default-rtdb.firebaseio.com";
// Node Path: "sensors/node_01/readings"
const char* FIREBASE_PATH = "/sensors/node_01/readings.json";
// Optional: Firebase database secret if authentication rule requires secret
// Leave empty string if rules allow anonymous/write access
const char* FIREBASE_AUTH = ""; 

// Pin Assignments
constexpr uint8_t PIN_DHT_DATA = 27;
constexpr uint8_t PIN_LCD_RS   = 19;
constexpr uint8_t PIN_LCD_E    = 23;
constexpr uint8_t PIN_LCD_D4   = 18;
constexpr uint8_t PIN_LCD_D5   = 5;
constexpr uint8_t PIN_LCD_D6   = 4;
constexpr uint8_t PIN_LCD_D7   = 2;

// Timers & Intervals
constexpr unsigned long TELEMETRY_INTERVAL_MS = 15UL * 60UL * 1000UL; // 15 Minutes
constexpr unsigned long DISPLAY_REFRESH_MS    = 2000UL;               // 2 Seconds
constexpr unsigned long WIFI_TIMEOUT_MS       = 15000UL;              // 15 Seconds timeout

// NTP Server for timestamping
const char* NTP_SERVER = "pool.ntp.org";
const long  GMT_OFFSET_SEC = 0;
const int   DAYLIGHT_OFFSET_SEC = 0;

// =========================================================================
// Global Managers
// =========================================================================
SensorManager sensor(PIN_DHT_DATA, DHT11);
DisplayManager display(PIN_LCD_RS, PIN_LCD_E, PIN_LCD_D4, PIN_LCD_D5, PIN_LCD_D6, PIN_LCD_D7);

unsigned long lastFirebasePostMillis = 0;
unsigned long lastDisplayMillis = 0;
bool initialPostSent = false;

// =========================================================================
// Helper Functions
// =========================================================================

/**
 * @brief Initialize and maintain WiFi connection
 */
void ensureWiFiConnected() {
    if (WiFi.status() == WL_CONNECTED) {
        return;
    }

    Serial.printf("[WiFi] Connecting to %s...\n", WIFI_SSID);
    display.displayConnecting(WIFI_SSID);

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

    unsigned long startAttempt = millis();
    while (WiFi.status() != WL_CONNECTED && millis() - startAttempt < WIFI_TIMEOUT_MS) {
        delay(500);
        Serial.print(".");
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("[WiFi] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
        display.displayConnected(WiFi.localIP().toString());
        delay(1500);

        // Sync system time via NTP
        configTime(GMT_OFFSET_SEC, DAYLIGHT_OFFSET_SEC, NTP_SERVER);
    } else {
        Serial.println("[WiFi] Connection failed. Will retry next cycle.");
        display.displayLines("WiFi Failed!", "Retrying later...");
        delay(2000);
    }
}

/**
 * @brief Get current Epoch timestamp in milliseconds
 */
unsigned long long getEpochMillis() {
    time_t now;
    time(&now);
    if (now < 100000) {
        // NTP not synced yet, fallback to system millis
        return static_cast<unsigned long long>(millis());
    }
    return static_cast<unsigned long long>(now) * 1000ULL;
}

/**
 * @brief Send telemetry payload to Firebase Realtime Database via HTTPS POST
 */
bool sendTelemetryToFirebase(float temperature, float humidity) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[Firebase] Cannot post: WiFi not connected.");
        return false;
    }

    display.displaySyncing();

    WiFiClientSecure client;
    // For convenience in standard ESP32 setups without managing root certificates.
    // For production, load Google Trust Services root CA into client.setCACert().
    client.setInsecure();

    HTTPClient https;
    String url = String(FIREBASE_HOST) + String(FIREBASE_PATH);
    if (strlen(FIREBASE_AUTH) > 0) {
        url += "?auth=" + String(FIREBASE_AUTH);
    }

    Serial.printf("[Firebase] POSTing telemetry to: %s\n", url.c_str());

    if (!https.begin(client, url)) {
        Serial.println("[Firebase] Unable to initiate HTTPS connection.");
        display.clearSyncing();
        return false;
    }

    https.addHeader("Content-Type", "application/json");

    // Construct JSON payload
    JsonDocument doc;
    doc["nodeId"]      = "node_01";
    doc["temperature"] = round(temperature * 10.0f) / 10.0f;
    doc["humidity"]    = round(humidity * 10.0f) / 10.0f;
    doc["timestamp"]   = getEpochMillis();
    
    // Server-side timestamp resolution support
    JsonObject serverTime = doc["serverTime"].to<JsonObject>();
    serverTime[".sv"] = "timestamp";

    String jsonPayload;
    serializeJson(doc, jsonPayload);

    Serial.printf("[Firebase] Payload: %s\n", jsonPayload.c_str());

    int httpCode = https.POST(jsonPayload);
    bool success = false;

    if (httpCode > 0) {
        Serial.printf("[Firebase] HTTPS Response Code: %d\n", httpCode);
        if (httpCode == HTTP_CODE_OK || httpCode == 200 || httpCode == 201) {
            String response = https.getString();
            Serial.printf("[Firebase] Response: %s\n", response.c_str());
            success = true;
        } else {
            Serial.printf("[Firebase] Error payload: %s\n", https.getString().c_str());
        }
    } else {
        Serial.printf("[Firebase] POST failed, error: %s\n", https.errorToString(httpCode).c_str());
    }

    https.end();
    display.clearSyncing();
    return success;
}

// =========================================================================
// Setup & Loop
// =========================================================================

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\n==========================================");
    Serial.println("   ESP32 Telemetry Monitor Initializing   ");
    Serial.println("==========================================");

    // 1. Initialize LCD Display
    display.begin(16, 2);
    display.displayLines("ESP32 Telemetry", "Booting...");
    delay(1000);

    // 2. Initialize DHT11 Sensor
    sensor.begin();
    Serial.printf("[Sensor] DHT11 configured on GPIO %d\n", PIN_DHT_DATA);

    // 3. Connect to WiFi
    ensureWiFiConnected();

    Serial.println("[Setup] Initialization complete.");
}

void loop() {
    unsigned long currentMillis = millis();

    // Ensure WiFi connection is maintained
    if (WiFi.status() != WL_CONNECTED) {
        ensureWiFiConnected();
    }

    // Read sensor metrics
    EnvironmentalData data = sensor.readData();

    // 1. Local Display Refresh (Every 2 seconds)
    if (currentMillis - lastDisplayMillis >= DISPLAY_REFRESH_MS) {
        lastDisplayMillis = currentMillis;

        if (data.isValid) {
            display.displayTelemetry(data.temperature, data.humidity);
            Serial.printf("[Local] Temp: %.1f C | Humidity: %.1f %%\n",
                          data.temperature, data.humidity);
        } else {
            display.displaySensorError();
            Serial.println("[Local] Warning: Invalid or NaN reading from DHT11.");
        }
    }

    // 2. Firebase HTTPS Telemetry Post (Every 15 minutes, plus immediate post upon startup)
    if (!initialPostSent || (currentMillis - lastFirebasePostMillis >= TELEMETRY_INTERVAL_MS)) {
        if (data.isValid) {
            Serial.println("[Telemetry] Sending scheduled reading to Firebase...");
            bool sent = sendTelemetryToFirebase(data.temperature, data.humidity);
            if (sent) {
                lastFirebasePostMillis = currentMillis;
                initialPostSent = true;
                Serial.printf("[Telemetry] Next post scheduled in %lu minutes.\n",
                              TELEMETRY_INTERVAL_MS / 60000UL);
            } else {
                Serial.println("[Telemetry] Sync failed, will retry on next cycle.");
            }
        } else {
            Serial.println("[Telemetry] Skipping cloud sync due to invalid sensor reading.");
        }
    }

    // Yield to allow background ESP32 RTOS tasks (WiFi/TCP stack) to run smoothly
    delay(50);
}
