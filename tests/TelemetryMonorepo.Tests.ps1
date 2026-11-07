$repoRoot = Resolve-Path "$PSScriptRoot\.."

Describe "Monorepo Root Setup" {
    It "package.json exists and is valid JSON" {
        $pkgPath = Join-Path $repoRoot "package.json"
        Test-Path $pkgPath | Should Be $true
        $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
        $pkg.name | Should Be "telemetry-repo"
        $pkg.workspaces | Should Contain "projects/web-dashboard"
        $pkg.scripts."dev" | Should Not BeNullOrEmpty
        $pkg.scripts."firmware:build" | Should Not BeNullOrEmpty
        $pkg.scripts."android:assemble-win" | Should Not BeNullOrEmpty
    }

    It ".gitignore exists and ignores required build artifacts" {
        $giPath = Join-Path $repoRoot ".gitignore"
        Test-Path $giPath | Should Be $true
        $content = Get-Content $giPath -Raw
        $content | Should Match "node_modules/"
        $content | Should Match "\.pio/"
        $content | Should Match "\.angular/"
        $content | Should Match "\.gradle/"
    }

    It "README.md exists and contains hardware pinout" {
        $rmPath = Join-Path $repoRoot "README.md"
        Test-Path $rmPath | Should Be $true
        $content = Get-Content $rmPath -Raw
        $content | Should Match "DHT11"
        $content | Should Match "GPIO 27"
        $content | Should Match "Firebase Realtime Database"
    }
}

Describe "ESP32 Firmware Configuration & Source" {
    $firmwareDir = Join-Path $repoRoot "projects\esp32-firmware"

    It "platformio.ini contains esp32dev and required libraries" {
        $iniPath = Join-Path $firmwareDir "platformio.ini"
        Test-Path $iniPath | Should Be $true
        $content = Get-Content $iniPath -Raw
        $content | Should Match "esp32dev"
        $content | Should Match "DHT sensor library"
        $content | Should Match "Adafruit Unified Sensor"
        $content | Should Match "LiquidCrystal"
    }

    It "sensor_interface.h defines EnvironmentalData and SensorManager" {
        $sensorPath = Join-Path $firmwareDir "include\sensor_interface.h"
        Test-Path $sensorPath | Should Be $true
        $content = Get-Content $sensorPath -Raw
        $content | Should Match "struct EnvironmentalData"
        $content | Should Match "class SensorManager"
        $content | Should Match "readData"
        $content | Should Match "isValid"
    }

    It "display_interface.h defines DisplayManager for 16x2 LCD" {
        $dispPath = Join-Path $firmwareDir "include\display_interface.h"
        Test-Path $dispPath | Should Be $true
        $content = Get-Content $dispPath -Raw
        $content | Should Match "class DisplayManager"
        $content | Should Match "displayTelemetry"
        $content | Should Match "LiquidCrystal"
    }

    It "main.cpp defines hardware pins and Firebase HTTPS POST logic" {
        $mainPath = Join-Path $firmwareDir "src\main.cpp"
        Test-Path $mainPath | Should Be $true
        $content = Get-Content $mainPath -Raw
        $content | Should Match "PIN_DHT_DATA = 27"
        $content | Should Match "PIN_LCD_RS   = 19"
        $content | Should Match "PIN_LCD_E    = 23"
        $content | Should Match "PIN_LCD_D4   = 18"
        $content | Should Match "PIN_LCD_D5   = 5"
        $content | Should Match "PIN_LCD_D6   = 4"
        $content | Should Match "PIN_LCD_D7   = 2"
        $content | Should Match "sensors/node_01/readings"
        $content | Should Match "TELEMETRY_INTERVAL_MS"
    }
}

Describe "Angular Web Dashboard" {
    $webDir = Join-Path $repoRoot "projects\web-dashboard"

    It "environment.ts defines Firebase configuration" {
        $envPath = Join-Path $webDir "src\environments\environment.ts"
        Test-Path $envPath | Should Be $true
        $content = Get-Content $envPath -Raw
        $content | Should Match "databaseURL"
        $content | Should Match "sensors/node_01/readings"
    }

    It "app.component.ts uses Angular Signals and Firebase Auth/DB" {
        $appPath = Join-Path $webDir "src\app\app.component.ts"
        Test-Path $appPath | Should Be $true
        $content = Get-Content $appPath -Raw
        $content | Should Match "signal<"
        $content | Should Match "computed\("
        $content | Should Match "signInWithPopup"
        $content | Should Match "onValue"
        $content | Should Match "Temperature"
        $content | Should Match "Humidity"
    }

    It "angular.json and tsconfig.json are valid JSON" {
        $angPath = Join-Path $webDir "angular.json"
        $tscPath = Join-Path $webDir "tsconfig.json"
        Test-Path $angPath | Should Be $true
        Test-Path $tscPath | Should Be $true
        { Get-Content $angPath -Raw | ConvertFrom-Json } | Should Not Throw
        { Get-Content $tscPath -Raw | ConvertFrom-Json } | Should Not Throw
    }

    It "app.component.spec.ts unit test suite is defined" {
        $specPath = Join-Path $webDir "src\app\app.component.spec.ts"
        Test-Path $specPath | Should Be $true
    }
}

Describe "Android Application" {
    $androidDir = Join-Path $repoRoot "projects\android-app"

    It "settings.gradle.kts sets telemetry-android root name and includes :app" {
        $settingsPath = Join-Path $androidDir "settings.gradle.kts"
        Test-Path $settingsPath | Should Be $true
        $content = Get-Content $settingsPath -Raw
        $content | Should Match 'rootProject\.name = "telemetry-android"'
        $content | Should Match 'include\(":app"\)'
    }

    It "app/build.gradle.kts declares Firebase BOM, Compose, and Credential Manager" {
        $appBuildPath = Join-Path $androidDir "app\build.gradle.kts"
        Test-Path $appBuildPath | Should Be $true
        $content = Get-Content $appBuildPath -Raw
        $content | Should Match "firebase-bom"
        $content | Should Match "material3"
        $content | Should Match "credentials"
    }

    It "AndroidManifest.xml includes INTERNET permission" {
        $manifestPath = Join-Path $androidDir "app\src\main\AndroidManifest.xml"
        Test-Path $manifestPath | Should Be $true
        $content = Get-Content $manifestPath -Raw
        $content | Should Match "android\.permission\.INTERNET"
        $content | Should Match "MainActivity"
    }

    It "MainActivity.kt implements Jetpack Compose and Firebase listener" {
        $mainKtPath = Join-Path $androidDir "app\src\main\java\com\example\telemetry\MainActivity.kt"
        Test-Path $mainKtPath | Should Be $true
        $content = Get-Content $mainKtPath -Raw
        $content | Should Match "data class TelemetryReading"
        $content | Should Match "FirebaseDatabase\.getInstance\(\)"
        $content | Should Match "sensors/node_01/readings"
        $content | Should Match "@Composable"
        $content | Should Match "MetricCard"
    }

    It "TelemetryUnitTest.kt exists with unit test coverage" {
        $testPath = Join-Path $androidDir "app\src\test\java\com\example\telemetry\TelemetryUnitTest.kt"
        Test-Path $testPath | Should Be $true
    }
}
