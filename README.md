# Telemetry Repo

A full-stack Internet of Things (IoT) telemetry monorepo connecting an **ESP32 microcontroller** measuring ambient temperature and humidity to a cloud-backed **Firebase Realtime Database**, with monitoring via an **Angular Web Dashboard** and a **Jetpack Compose Android Application**.

---

## Architecture Overview

```text
               +---------------------------+
               |   DHT11 Sensor & LCD      |
               +-------------+-------------+
                             |
                             v
               +---------------------------+
               |      ESP32 Firmware       |
               |  (projects/esp32-firmware)|
               +-------------+-------------+
                             | HTTPS (POST / 15m)
                             v
               +---------------------------+
               | Firebase Realtime Database|
               | (sensors/node_01/readings)|
               +------+-------------+------+
                      |             |
           WebSocket  |             |  WebSocket / Realtime
                      v             v
       +--------------------+  +--------------------+
       | Angular Dashboard  |  | Android Compose App|
       |  (web-dashboard)   |  |   (android-app)    |
       +--------------------+  +--------------------+
```

---

## Monorepo Directory Structure

```text
telemetry-repo/
├── .gitignore
├── README.md
├── package.json
└── projects/
    ├── esp32-firmware/                    # PlatformIO C++ Embedded Project
    │   ├── include/
    │   │   ├── sensor_interface.h         # DHT11 SensorManager modular wrapper
    │   │   └── display_interface.h        # 16x2 LCD DisplayManager 4-bit driver
    │   ├── src/
    │   │   └── main.cpp                   # Main loop & Firebase HTTPS telemetry publisher
    │   └── platformio.ini                 # PlatformIO configuration (esp32dev)
    │
    ├── web-dashboard/                     # Angular 18+ Web Application
    │   ├── src/
    │   │   ├── app/
    │   │   │   └── app.component.ts       # Standalone component with Signals & Firebase
    │   │   ├── environments/
    │   │   │   ├── environment.ts         # Firebase credentials configuration
    │   │   │   └── environment.prod.ts
    │   │   ├── index.html
    │   │   ├── main.ts
    │   │   └── styles.css
    │   ├── angular.json
    │   ├── package.json
    │   └── tsconfig.json
    │
    └── android-app/                       # Native Android Project (Kotlin & Jetpack Compose)
        ├── app/
        │   ├── src/
        │   │   └── main/
        │   │       ├── java/com/example/telemetry/
        │   │       │   └── MainActivity.kt# Compose UI & Firebase Realtime Database listener
        │   │       └── AndroidManifest.xml
        │   └── build.gradle.kts
        ├── build.gradle.kts
        ├── gradle.properties
        └── settings.gradle.kts
```

---

## Hardware Pin Connections (ESP32)

| Component | Pin / Signal | Target Connection | ESP32 Pin / Rail | Description |
| :--- | :--- | :--- | :--- | :--- |
| **B22K Potentiometer** | Pin 1 | Ground | **GND** | Contrast high-rail |
| **B22K Potentiometer** | Pin 2 (Wiper) | LCD Pin 3 (`VEE`) | — | LCD Contrast control |
| **B22K Potentiometer** | Pin 3 | +5V Rail | **5V / VIN** | Contrast low-rail |
| **DHT11 Sensor** | `VCC` | +3.3V or +5V | **3V3 / VIN** | Power |
| **DHT11 Sensor** | `DATA` (`OUT`/`S`) | ESP32 GPIO | **D27** (GPIO 27) | Single-bus data line (10k pull-up) |
| **DHT11 Sensor** | `GND` | Ground | **GND** | Ground |
| **JHD 162A LCD** | `VSS` (Pin 1) | Ground | **GND** | Power Ground |
| **JHD 162A LCD** | `VDD` (Pin 2) | Power | **5V / VIN** | Power +5V |
| **JHD 162A LCD** | `VEE` (Pin 3) | Potentiometer Wiper | — | Contrast adjustment |
| **JHD 162A LCD** | `RS` (Pin 4) | ESP32 GPIO | **D19** (GPIO 19) | Register Select |
| **JHD 162A LCD** | `RW` (Pin 5) | Ground | **GND** | Read/Write (Write mode) |
| **JHD 162A LCD** | `E` (Pin 6) | ESP32 GPIO | **D23** (GPIO 23) | Enable signal |
| **JHD 162A LCD** | `DB4` (Pin 11) | ESP32 GPIO | **D18** (GPIO 18) | Data bit 4 |
| **JHD 162A LCD** | `DB5` (Pin 12) | ESP32 GPIO | **D5** (GPIO 5) | Data bit 5 |
| **JHD 162A LCD** | `DB6` (Pin 13) | ESP32 GPIO | **D4** (GPIO 4) | Data bit 6 |
| **JHD 162A LCD** | `DB7` (Pin 14) | ESP32 GPIO | **D2** (GPIO 2) | Data bit 7 |
| **JHD 162A LCD** | `A` (Pin 15) | Backlight Anode | **5V (via 220Ω resistor)** | Backlight LED + |
| **JHD 162A LCD** | `K` (Pin 16) | Backlight Cathode | **GND** | Backlight LED - |

---

## Firebase Setup

1. Open [Firebase Console](https://console.firebase.google.com/) and create a project (e.g. `telemetry-iot-prod`).
2. Go to **Authentication > Sign-in method**, enable **Google**.
3. Go to **Realtime Database > Create Database** in your preferred region.
4. Navigate to the **Rules** tab and paste:
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
5. Add a Web App in Project Settings to retrieve your config values and fill them in:
   - `projects/web-dashboard/src/environments/environment.ts`
   - `projects/esp32-firmware/src/main.cpp` (`FIREBASE_HOST`, `FIREBASE_AUTH_KEY` if using database secret or public rule)
   - Download `google-services.json` and place it in `projects/android-app/app/`.

---

## Monorepo CLI Commands

Run these from the repository root:

```bash
# Web Dashboard
npm run dev              # Start Angular development server (port 4200)
npm run web:build        # Build production web dashboard

# ESP32 Firmware (Requires PlatformIO CLI)
npm run firmware:build   # Compile ESP32 firmware
npm run firmware:upload  # Upload binary to ESP32 board
npm run firmware:monitor # Open Serial Monitor (115200 baud)

# Android App (Requires Android SDK & Java 17+)
npm run android:assemble-win # Build Debug APK on Windows
npm run android:assemble     # Build Debug APK on macOS / Linux
```

---

## Subproject Details

### 1. ESP32 Firmware (`projects/esp32-firmware`)
- Written in modern C++ with Arduino core for ESP32.
- Clean object-oriented interfaces:
  - `SensorManager`: Self-contained wrapper around DHT11 with validity checking and NaN filters.
  - `DisplayManager`: 4-bit parallel driver for JHD 162A LCD with custom symbols for degrees (°C).
- Auto-syncs telemetry to Firebase over HTTPS every 15 minutes.

### 2. Web Dashboard (`projects/web-dashboard`)
- Built using **Angular** with standalone components and reactive **Signals** (`signal()`, `computed()`).
- Direct integration with Firebase Auth (Google Sign-In popup) and Firebase Realtime Database.
- Live responsive UI cards for Temperature, Humidity, connection state, and last timestamp.

### 3. Android Application (`projects/android-app`)
- Built with **Kotlin**, **Jetpack Compose Material 3**, and **Coroutines**.
- Firebase SDK with Google Credential Manager integration.
- Dynamic telemetry cards with color thresholds for comfortable, high, and low levels.
