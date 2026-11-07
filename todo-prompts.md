# Telemetry Repo Setup Guide & AI Prompt List

This document contains step-by-step prompts to build the entire `telemetry-repo` monorepo inside VS Code.

---

## Workspace Structure Overview

```text
telemetry-repo/
├── .gitignore
├── README.md
├── package.json
└── projects/
    ├── esp32-firmware/
    │   ├── include/
    │   │   ├── sensor_interface.h
    │   │   └── display_interface.h
    │   ├── src/
    │   │   └── main.cpp
    │   └── platformio.ini
    ├── web-dashboard/
    │   ├── src/
    │   │   ├── app/
    │   │   │   └── app.component.ts
    │   │   └── environments/
    │   │       └── environment.ts
    │   ├── angular.json
    │   ├── package.json
    │   └── tsconfig.json
    └── android-app/
        ├── app/
        │   ├── src/
        │   │   └── main/
        │   │       ├── java/com/example/telemetry/
        │   │       │   └── MainActivity.kt
        │   │       └── AndroidManifest.xml
        │   └── build.gradle.kts
        ├── build.gradle.kts
        └── settings.gradle.kts
```

---

## Step 1: Root Monorepo Configuration

### Prompt 1.1: Root Package & Workspace Files
> **Copy & Paste into AI Coding Assistant:**
> 
> "Please create the root files for a monorepo called `telemetry-repo`:
> 1. `package.json` with npm workspaces pointing to `projects/web-dashboard`, containing scripts for running the web dashboard, compiling/uploading ESP32 firmware via PlatformIO, and building the Android APK via Gradle.
> 2. `.gitignore` ignoring node_modules, .pio, .angular, and Android build artifacts.
> 3. `README.md` documenting workspace commands and project architecture."

---

## Step 2: ESP32 Firmware Project (`projects/esp32-firmware`)

### Hardware Pin Reference

| Device | Component Pin | Target Connection | ESP32 Pin / Rail |
| :---: | :---: | :---: | :---: |
| **B22K Potentiometer** | Middle Wiper (Pin 2) | LCD Pin 3 (`VEE`) | — |
| **DHT11 Sensor** | DATA (`OUT` / `S`) | ESP32 Board | **D27** (GPIO 27) |
| **JHD 162A LCD** | `RS` (Pin 4) | ESP32 Board | **D19** (GPIO 19) |
| **JHD 162A LCD** | `E` (Pin 6) | ESP32 Board | **D23** (GPIO 23) |
| **JHD 162A LCD** | `DB4` (Pin 11) | ESP32 Board | **D18** (GPIO 18) |
| **JHD 162A LCD** | `DB5` (Pin 12) | ESP32 Board | **D5** (GPIO 5) |
| **JHD 162A LCD** | `DB6` (Pin 13) | ESP32 Board | **D4** (GPIO 4) |
| **JHD 162A LCD** | `DB7` (Pin 14) | ESP32 Board | **D2** (GPIO 2) |

### Prompt 2.1: PlatformIO Setup & Modular Code
> **Copy & Paste into AI Coding Assistant:**
> 
> "Generate the ESP32 C++ firmware files inside `projects/esp32-firmware`:
> 1. `platformio.ini`: PlatformIO config for `esp32dev` with `adafruit/DHT sensor library` and `adafruit/Adafruit Unified Sensor`.
> 2. `include/sensor_interface.h`: Modular class wrapper `SensorManager` around DHT11 returning a `EnvironmentalData` struct (temp, hum, isValid).
> 3. `include/display_interface.h`: Modular class wrapper `DisplayManager` around 4-bit `LiquidCrystal` to display temperature (°C) and humidity (%) on a 16x2 LCD.
> 4. `src/main.cpp`: Main loop reading DHT11 on GPIO 27, updating the LCD (RS:19, E:23, DB4:18, DB5:5, DB6:4, DB7:2), and making HTTPS POST calls to Firebase Realtime Database every 15 minutes."

---

## Step 3: Angular Web Dashboard (`projects/web-dashboard`)

### Prompt 3.1: Angular Dashboard & Firebase Integration
> **Copy & Paste into AI Coding Assistant:**
> 
> "Generate a standalone Angular web app inside `projects/web-dashboard`:
> 1. `src/environments/environment.ts`: Firebase configuration placeholder containing `databaseURL` and auth settings.
> 2. `src/app/app.component.ts`: A standalone component using Angular signals that handles Google Authentication (`signInWithPopup`) via Firebase Auth and listens to live telemetry updates (`sensors/node_01/readings`) from Firebase Realtime Database. Render real-time cards for temperature and humidity, along with a timestamp indicator."

---

## Step 4: Android App (`projects/android-app`)

### Prompt 4.1: Jetpack Compose & Firebase App
> **Copy & Paste into AI Coding Assistant:**
> 
> "Generate an Android Kotlin application inside `projects/android-app`:
> 1. `settings.gradle.kts`: Set root project name to `telemetry-android` including `:app`.
> 2. `app/build.gradle.kts`: Dependencies for Firebase BOM (Auth + Database), Jetpack Compose Material3, and Credential Manager.
> 3. `app/src/main/java/com/example/telemetry/MainActivity.kt`: A Jetpack Compose activity that connects to Firebase Realtime Database (`sensors/node_01/readings`), retrieves the latest telemetry snapshot, and renders live temperature and humidity metrics in Material3 cards."

---

## Firebase Setup Quick Reference

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a project.
2. Enable **Google Authentication** under *Build > Authentication*.
3. Create a **Realtime Database** under *Build > Realtime Database*.
4. Paste the following Database Security Rules:

```json
{
  "rules": {
    "sensors": {
      ".read": "auth != null",
      ".write": true,
      "$node_id": {
        "readings": {
          ".indexOn": ["timestamp"]
        }
      }
    }
  }
}
```