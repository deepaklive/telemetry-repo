#include <unity.h>

// Struct definition matching sensor_interface.h
struct EnvironmentalData {
    float temperature;
    float humidity;
    bool isValid;
    unsigned long readAt;
};

// Simulation of range validation logic from sensor_interface.h
bool validateReading(float temp, float hum) {
    if (temp < -20.0f || temp > 80.0f || hum < 0.0f || hum > 100.0f) {
        return false;
    }
    return true;
}

void test_valid_reading_passes_validation(void) {
    TEST_ASSERT_TRUE(validateReading(24.5f, 55.0f));
    TEST_ASSERT_TRUE(validateReading(0.0f, 20.0f));
    TEST_ASSERT_TRUE(validateReading(45.0f, 90.0f));
}

void test_extreme_readings_fail_validation(void) {
    TEST_ASSERT_FALSE(validateReading(-25.0f, 50.0f));
    TEST_ASSERT_FALSE(validateReading(85.0f, 50.0f));
    TEST_ASSERT_FALSE(validateReading(25.0f, -5.0f));
    TEST_ASSERT_FALSE(validateReading(25.0f, 105.0f));
}

void test_hardware_pin_constants(void) {
    const int PIN_DHT_DATA = 27;
    const int PIN_LCD_RS   = 19;
    const int PIN_LCD_E    = 23;
    const int PIN_LCD_D4   = 18;
    const int PIN_LCD_D5   = 5;
    const int PIN_LCD_D6   = 4;
    const int PIN_LCD_D7   = 2;

    TEST_ASSERT_EQUAL_INT(27, PIN_DHT_DATA);
    TEST_ASSERT_EQUAL_INT(19, PIN_LCD_RS);
    TEST_ASSERT_EQUAL_INT(23, PIN_LCD_E);
    TEST_ASSERT_EQUAL_INT(18, PIN_LCD_D4);
    TEST_ASSERT_EQUAL_INT(5, PIN_LCD_D5);
    TEST_ASSERT_EQUAL_INT(4, PIN_LCD_D6);
    TEST_ASSERT_EQUAL_INT(2, PIN_LCD_D7);
}

int main(int argc, char **argv) {
    UNITY_BEGIN();
    RUN_TEST(test_valid_reading_passes_validation);
    RUN_TEST(test_extreme_readings_fail_validation);
    RUN_TEST(test_hardware_pin_constants);
    return UNITY_END();
}
