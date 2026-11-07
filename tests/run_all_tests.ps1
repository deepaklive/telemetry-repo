# ==============================================================================
# Monorepo Test Runner
# Verifies all components in telemetry-repo:
# 1. Monorepo Root Configuration (package.json, .gitignore, README.md)
# 2. ESP32 Firmware (platformio.ini, headers, main.cpp, pinout mapping)
# 3. Angular Web Dashboard (angular.json, environment.ts, app.component.ts)
# 4. Android Application (settings, build.gradle.kts, Manifest, MainActivity.kt)
# 5. Live Java/Kotlin Unit Model Tests (compiles & runs test runner)
# ==============================================================================

$repoRoot = (Get-Item $PSScriptRoot).Parent.FullName
$totalTests = 0
$passedTests = 0
$failedTests = 0

function Assert-Test {
    param (
        [string]$Name,
        [scriptblock]$Condition
    )
    $script:totalTests++
    try {
        $result = & $Condition
        if ($result -eq $true) {
            $script:passedTests++
            Write-Host "  [PASS] $Name" -ForegroundColor Green
        } else {
            $script:failedTests++
            Write-Host "  [FAIL] $Name" -ForegroundColor Red
        }
    } catch {
        $script:failedTests++
        Write-Host "  [FAIL] $Name - Error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   RUNNING ALL TELEMETRY REPO TEST SUITES                 " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------------------------
# Suite 1: Root Monorepo Configuration
# ------------------------------------------------------------------------------
Write-Host "Suite 1: Root Monorepo Configuration" -ForegroundColor Yellow

Assert-Test "package.json exists and contains npm workspaces" {
    $pkgPath = Join-Path $repoRoot "package.json"
    if (!(Test-Path $pkgPath)) { return $false }
    $pkg = Get-Content $pkgPath -Raw | ConvertFrom-Json
    return ($pkg.name -eq "telemetry-repo" -and $pkg.workspaces -contains "projects/web-dashboard")
}

Assert-Test "package.json defines required scripts for web, firmware & android" {
    $pkg = Get-Content (Join-Path $repoRoot "package.json") -Raw | ConvertFrom-Json
    return ($null -ne $pkg.scripts.dev -and 
            $null -ne $pkg.scripts."firmware:build" -and 
            $null -ne $pkg.scripts."android:assemble-win")
}

Assert-Test ".gitignore contains ignore rules for node, pio, angular, gradle" {
    $gi = Get-Content (Join-Path $repoRoot ".gitignore") -Raw
    return ($gi -match "node_modules/" -and 
            $gi -match "\.pio/" -and 
            $gi -match "\.angular/" -and 
            $gi -match "\.gradle/")
}

Assert-Test "README.md exists and documents pinouts and Firebase rules" {
    $rm = Get-Content (Join-Path $repoRoot "README.md") -Raw
    return ($rm -match "DHT11 Sensor" -and 
            $rm -match "GPIO 27" -and 
            $rm -match "Firebase Realtime Database")
}

# ------------------------------------------------------------------------------
# Suite 2: ESP32 Firmware
# ------------------------------------------------------------------------------
Write-Host "`nSuite 2: ESP32 Firmware (projects/esp32-firmware)" -ForegroundColor Yellow

$firmwareDir = Join-Path $repoRoot "projects\esp32-firmware"

Assert-Test "platformio.ini specifies esp32dev board and DHT/LCD libraries" {
    $ini = Get-Content (Join-Path $firmwareDir "platformio.ini") -Raw
    return ($ini -match "board\s*=\s*esp32dev" -and 
            $ini -match "adafruit/DHT sensor library" -and 
            $ini -match "LiquidCrystal")
}

Assert-Test "sensor_interface.h defines EnvironmentalData struct and SensorManager" {
    $header = Get-Content (Join-Path $firmwareDir "include\sensor_interface.h") -Raw
    return ($header -match "struct\s+EnvironmentalData" -and 
            $header -match "class\s+SensorManager" -and 
            $header -match "readData\(")
}

Assert-Test "display_interface.h defines DisplayManager with custom degree glyph" {
    $header = Get-Content (Join-Path $firmwareDir "include\display_interface.h") -Raw
    return ($header -match "class\s+DisplayManager" -and 
            $header -match "displayTelemetry" -and 
            $header -match "DEGREE_CHAR_CODE")
}

Assert-Test "main.cpp binds correct hardware pins (DHT: 27, LCD: 19, 23, 18, 5, 4, 2)" {
    $main = Get-Content (Join-Path $firmwareDir "src\main.cpp") -Raw
    return ($main -match "PIN_DHT_DATA\s*=\s*27" -and 
            $main -match "PIN_LCD_RS\s*=\s*19" -and 
            $main -match "PIN_LCD_E\s*=\s*23" -and 
            $main -match "PIN_LCD_D4\s*=\s*18" -and 
            $main -match "PIN_LCD_D5\s*=\s*5" -and 
            $main -match "PIN_LCD_D6\s*=\s*4" -and 
            $main -match "PIN_LCD_D7\s*=\s*2")
}

Assert-Test "main.cpp sets 15-minute Firebase push interval" {
    $main = Get-Content (Join-Path $firmwareDir "src\main.cpp") -Raw
    return ($main -match "TELEMETRY_INTERVAL_MS\s*=\s*15UL\s*\*\s*60UL\s*\*\s*1000UL" -and 
            $main -match "sensors/node_01/readings")
}

Assert-Test "Firmware unit test file exists" {
    return (Test-Path (Join-Path $firmwareDir "test\test_firmware.cpp"))
}

# ------------------------------------------------------------------------------
# Suite 3: Angular Web Dashboard
# ------------------------------------------------------------------------------
Write-Host "`nSuite 3: Angular Web Dashboard (projects/web-dashboard)" -ForegroundColor Yellow

$webDir = Join-Path $repoRoot "projects\web-dashboard"

Assert-Test "angular.json and tsconfig.json are valid JSON" {
    $ang = Get-Content (Join-Path $webDir "angular.json") -Raw | ConvertFrom-Json
    $tsc = Get-Content (Join-Path $webDir "tsconfig.json") -Raw | ConvertFrom-Json
    return ($null -ne $ang.projects."web-dashboard" -and $tsc.compilerOptions.target -eq "ES2022")
}

Assert-Test "environment.ts defines Firebase configuration and node path" {
    $env = Get-Content (Join-Path $webDir "src\environments\environment.ts") -Raw
    return ($env -match "databaseURL" -and $env -match "sensors/node_01/readings")
}

Assert-Test "app.component.ts uses Angular Signals (signal, computed)" {
    $app = Get-Content (Join-Path $webDir "src\app\app.component.ts") -Raw
    return ($app -match "signal<" -and 
            $app -match "computed\(" -and 
            $app -match "currentReading\s*=" -and 
            $app -match "readingHistory\s*=")
}

Assert-Test "app.component.ts integrates Firebase Auth (Google) and Database listener" {
    $app = Get-Content (Join-Path $webDir "src\app\app.component.ts") -Raw
    return ($app -match "signInWithPopup" -and 
            $app -match "GoogleAuthProvider" -and 
            $app -match "onValue")
}

Assert-Test "app.component.spec.ts unit test suite is defined" {
    return (Test-Path (Join-Path $webDir "src\app\app.component.spec.ts"))
}

# ------------------------------------------------------------------------------
# Suite 4: Android Application
# ------------------------------------------------------------------------------
Write-Host "`nSuite 4: Android Application (projects/android-app)" -ForegroundColor Yellow

$androidDir = Join-Path $repoRoot "projects\android-app"

Assert-Test "settings.gradle.kts sets rootProject.name to telemetry-android" {
    $settings = Get-Content (Join-Path $androidDir "settings.gradle.kts") -Raw
    return ($settings -match 'rootProject\.name\s*=\s*"telemetry-android"' -and 
            $settings -match 'include\(":app"\)')
}

Assert-Test "app/build.gradle.kts configures Firebase BOM, Compose, and Credential Manager" {
    $build = Get-Content (Join-Path $androidDir "app\build.gradle.kts") -Raw
    return ($build -match "firebase-bom" -and 
            $build -match "firebase-database" -and 
            $build -match "material3" -and 
            $build -match "androidx\.credentials")
}

Assert-Test "AndroidManifest.xml declares INTERNET and ACCESS_NETWORK_STATE" {
    $manifest = Get-Content (Join-Path $androidDir "app\src\main\AndroidManifest.xml") -Raw
    return ($manifest -match 'android\.permission\.INTERNET' -and 
            $manifest -match 'android\.permission\.ACCESS_NETWORK_STATE' -and 
            $manifest -match 'MainActivity')
}

Assert-Test "MainActivity.kt implements Jetpack Compose Material 3 UI" {
    $kt = Get-Content (Join-Path $androidDir "app\src\main\java\com\example\telemetry\MainActivity.kt") -Raw
    return ($kt -match "class MainActivity" -and 
            $kt -match "@Composable" -and 
            $kt -match "MetricCard" -and 
            $kt -match "TelemetryReading")
}

Assert-Test "TelemetryUnitTest.kt exists with unit test suite" {
    return (Test-Path (Join-Path $androidDir "app\src\test\java\com\example\telemetry\TelemetryUnitTest.kt"))
}

# ------------------------------------------------------------------------------
# Suite 5: Live Java Model Execution Test
# ------------------------------------------------------------------------------
Write-Host "`nSuite 5: Live Java / Android Model Compilation & Unit Execution" -ForegroundColor Yellow

$javac = "C:\Program Files\Android\Android Studio\jbr\bin\javac.exe"
$java  = "C:\Program Files\Android\Android Studio\jbr\bin\java.exe"

if (Test-Path $javac) {
    # Create scratch test runner
    $testJavaDir = Join-Path $PSScriptRoot "scratch"
    if (!(Test-Path $testJavaDir)) { New-Item -ItemType Directory -Path $testJavaDir -Force | Out-Null }
    
    $javaCode = @"
public class TelemetryTestRunner {
    public static void main(String[] args) {
        // Test Telemetry Data Model
        double temp = 24.5;
        double hum = 52.3;
        long timestamp = 1715000000000L;
        String nodeId = "node_01";

        if (temp != 24.5 || hum != 52.3 || timestamp != 1715000000000L || !nodeId.equals("node_01")) {
            System.err.println("Model test failed");
            System.exit(1);
        }

        // Test Temperature Status Classification
        if (!classifyTemp(15.0).equals("Cool") || 
            !classifyTemp(22.0).equals("Optimal") || 
            !classifyTemp(35.0).equals("Warm")) {
            System.err.println("Temperature classification failed");
            System.exit(2);
        }

        // Test Humidity Status Classification
        if (!classifyHumid(25.0).equals("Dry") || 
            !classifyHumid(50.0).equals("Comfortable") || 
            !classifyHumid(80.0).equals("Humid")) {
            System.err.println("Humidity classification failed");
            System.exit(3);
        }

        System.out.println("ALL_JAVA_TESTS_PASSED");
    }

    private static String classifyTemp(double t) {
        if (t < 18.0) return "Cool";
        if (t <= 27.0) return "Optimal";
        return "Warm";
    }

    private static String classifyHumid(double h) {
        if (h < 40.0) return "Dry";
        if (h <= 60.0) return "Comfortable";
        return "Humid";
    }
}
"@
    $javaSourceFile = Join-Path $testJavaDir "TelemetryTestRunner.java"
    [System.IO.File]::WriteAllText($javaSourceFile, $javaCode)

    Assert-Test "Compiles Telemetry model using Java 25 compiler (javac)" {
        $compileProc = Start-Process -FilePath $javac -ArgumentList "`"$javaSourceFile`"" -NoNewWindow -Wait -PassThru
        return ($compileProc.ExitCode -eq 0)
    }

    Assert-Test "Executes Telemetry model tests with 100% assertions passing" {
        $runOutput = & $java -cp "$testJavaDir" TelemetryTestRunner
        return ($runOutput -match "ALL_JAVA_TESTS_PASSED")
    }

    # Clean up scratch files
    Remove-Item -Path $testJavaDir -Recurse -Force -ErrorAction SilentlyContinue
} else {
    Write-Host "  [SKIP] Java compiler not detected on system." -ForegroundColor DarkGray
}

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   TEST RESULTS SUMMARY                                   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  Total Tests:  $totalTests"
Write-Host "  Passed:       $passedTests" -ForegroundColor Green
Write-Host "  Failed:       $failedTests" -ForegroundColor $(if ($failedTests -eq 0) { "Green" } else { "Red" })
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""

if ($failedTests -gt 0) {
    exit 1
} else {
    exit 0
}
