#ifndef SENSOR_INTERFACE_H
#define SENSOR_INTERFACE_H

#include <Arduino.h>
#include <DHT.h>

/**
 * @brief Telemetry snapshot holding environmental measurements
 */
struct EnvironmentalData {
    float temperature;    ///< Temperature in Celsius (°C)
    float humidity;       ///< Relative humidity percentage (%)
    bool isValid;         ///< Indicates whether the reading was successful and within range
    unsigned long readAt; ///< Local timestamp (millis()) when reading occurred
};

/**
 * @brief Modular hardware wrapper for DHT11/DHT22 temperature and humidity sensor
 */
class SensorManager {
public:
    /**
     * @brief Construct a new SensorManager
     * @param pin The GPIO pin connected to DHT sensor DATA pin
     * @param sensorType DHT11 or DHT22 (default DHT11)
     */
    explicit SensorManager(uint8_t pin, uint8_t sensorType = DHT11)
        : _pin(pin), _type(sensorType), _dht(pin, sensorType), _lastReadMillis(0) {
        _lastData = {0.0f, 0.0f, false, 0};
    }

    /**
     * @brief Initialize the underlying DHT sensor hardware
     */
    void begin() {
        _dht.begin();
    }

    /**
     * @brief Read environmental metrics from the DHT sensor
     * Filters out NaN values and checks valid physical ranges.
     * @param forceRead If true, ignores minimum read interval
     * @return EnvironmentalData populated with measurements and validity flag
     */
    EnvironmentalData readData(bool forceRead = false) {
        unsigned long currentMillis = millis();

        // DHT11 requires at least 1000-2000 ms between reads to prevent overheating/stale values
        if (!forceRead && (currentMillis - _lastReadMillis < 1500) && _lastData.isValid) {
            return _lastData;
        }

        float hum = _dht.readHumidity();
        float temp = _dht.readTemperature(); // Celsius

        EnvironmentalData data;
        data.readAt = currentMillis;

        if (isnan(hum) || isnan(temp)) {
            data.temperature = 0.0f;
            data.humidity = 0.0f;
            data.isValid = false;
        } else if (temp < -20.0f || temp > 80.0f || hum < 0.0f || hum > 100.0f) {
            // Out of plausible operational range for DHT11
            data.temperature = temp;
            data.humidity = hum;
            data.isValid = false;
        } else {
            data.temperature = temp;
            data.humidity = hum;
            data.isValid = true;
        }

        _lastData = data;
        _lastReadMillis = currentMillis;
        return data;
    }

    /**
     * @brief Get the last cached reading without triggering a hardware read
     */
    EnvironmentalData getLastReading() const {
        return _lastData;
    }

    /**
     * @brief Get configured pin number
     */
    uint8_t getPin() const {
        return _pin;
    }

private:
    uint8_t _pin;
    uint8_t _type;
    DHT _dht;
    unsigned long _lastReadMillis;
    EnvironmentalData _lastData;
};

#endif // SENSOR_INTERFACE_H
