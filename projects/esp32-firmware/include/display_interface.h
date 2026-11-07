#ifndef DISPLAY_INTERFACE_H
#define DISPLAY_INTERFACE_H

#include <Arduino.h>
#include <LiquidCrystal.h>

/**
 * @brief Modular class wrapper around 4-bit LiquidCrystal parallel driver for 16x2 LCD (JHD 162A)
 */
class DisplayManager {
public:
    /**
     * @brief Custom bitmap for degree symbol (°)
     */
    static const uint8_t DEGREE_CHAR_CODE = 0;

    /**
     * @brief Construct a new DisplayManager with pin definitions
     * @param rs Register Select pin
     * @param enable Enable pin
     * @param d4 Data bit 4
     * @param d5 Data bit 5
     * @param d6 Data bit 6
     * @param d7 Data bit 7
     */
    DisplayManager(uint8_t rs = 19, uint8_t enable = 23,
                   uint8_t d4 = 18, uint8_t d5 = 5,
                   uint8_t d6 = 4, uint8_t d7 = 2)
        : _lcd(rs, enable, d4, d5, d6, d7), _cols(16), _rows(2) {}

    /**
     * @brief Initialize LCD display and register custom characters
     */
    void begin(uint8_t cols = 16, uint8_t rows = 2) {
        _cols = cols;
        _rows = rows;
        _lcd.begin(_cols, _rows);
        
        // Custom 5x8 degree character (°)
        byte degreeGlyph[8] = {
            0b00110,
            0b01001,
            0b01001,
            0b00110,
            0b00000,
            0b00000,
            0b00000,
            0b00000
        };
        _lcd.createChar(DEGREE_CHAR_CODE, degreeGlyph);
        _lcd.clear();
    }

    /**
     * @brief Clear the display
     */
    void clear() {
        _lcd.clear();
    }

    /**
     * @brief Display two arbitrary lines of text (padded to column width)
     */
    void displayLines(const String& line1, const String& line2 = "") {
        _lcd.setCursor(0, 0);
        String padded1 = line1;
        while (padded1.length() < _cols) padded1 += " ";
        _lcd.print(padded1.substring(0, _cols));

        _lcd.setCursor(0, 1);
        String padded2 = line2;
        while (padded2.length() < _cols) padded2 += " ";
        _lcd.print(padded2.substring(0, _cols));
    }

    /**
     * @brief Show boot / connecting status screen
     */
    void displayConnecting(const String& ssid) {
        _lcd.clear();
        _lcd.setCursor(0, 0);
        _lcd.print("WiFi Connecting");
        _lcd.setCursor(0, 1);
        _lcd.print(ssid.substring(0, _cols));
    }

    /**
     * @brief Show WiFi connected screen with IP
     */
    void displayConnected(const String& ip) {
        _lcd.clear();
        _lcd.setCursor(0, 0);
        _lcd.print("WiFi Online");
        _lcd.setCursor(0, 1);
        _lcd.print(ip.substring(0, _cols));
    }

    /**
     * @brief Render current telemetry readings formatted on the LCD
     * Line 1: Temp:  XX.X °C
     * Line 2: Humid: XX.X %
     * @param temperature Celsius
     * @param humidity Relative humidity percentage
     */
    void displayTelemetry(float temperature, float humidity) {
        _lcd.setCursor(0, 0);
        _lcd.print("Temp:  ");
        if (isnan(temperature)) {
            _lcd.print("--.-");
        } else {
            char tempBuf[8];
            dtostrf(temperature, 4, 1, tempBuf);
            _lcd.print(tempBuf);
        }
        _lcd.write((uint8_t)DEGREE_CHAR_CODE);
        _lcd.print("C   ");

        _lcd.setCursor(0, 1);
        _lcd.print("Humid: ");
        if (isnan(humidity)) {
            _lcd.print("--.-");
        } else {
            char humBuf[8];
            dtostrf(humidity, 4, 1, humBuf);
            _lcd.print(humBuf);
        }
        _lcd.print(" %   ");
    }

    /**
     * @brief Display sensor reading error
     */
    void displaySensorError() {
        displayLines("Sensor Fault!", "Check DHT Wiring");
    }

    /**
     * @brief Display cloud sync indication
     */
    void displaySyncing() {
        _lcd.setCursor(15, 0);
        _lcd.print("*"); // Flash sync indicator in top right
    }

    /**
     * @brief Clear sync indication
     */
    void clearSyncing() {
        _lcd.setCursor(15, 0);
        _lcd.print(" ");
    }

private:
    LiquidCrystal _lcd;
    uint8_t _cols;
    uint8_t _rows;
};

#endif // DISPLAY_INTERFACE_H
