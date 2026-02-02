/*
 * ESP32 - Monitor de Gas MQ2 + DHT11
 * Comunicación HTTP/HTTPS (Soporte para Railway)
 * 
 * Este código usa HTTP POST para enviar datos cada 5 segundos
 * y HTTP GET para obtener comandos del servidor
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <ArduinoJson.h>
#include <DHT.h>

// Configuración WiFi
const char* WIFI_SSID = "MarcoBuri";
const char* WIFI_PASSWORD = "20032006";

// Configuración Servidor (Railway)
const char* BASE_URL = "https://sistemaiotmq2piensa-production.up.railway.app";
const char* DEVICE_KEY = "00d6644c-3785-4a2d-ae71-1ec6c81b1a9a";

// URLs del servidor
String sensorDataUrl;
String commandUrl;
String configUrl;

// Pines Hardware
const int MQ2_PIN = 34;
const int LED_PIN = 2;
const int BUZZER_PIN = 4;
const int DHT_PIN = 15;  // Pin para DHT11

// Configuración DHT11
#define DHTTYPE DHT11
DHT dht(DHT_PIN, DHTTYPE);

// Configuración Sensor MQ2
const float RL_VALUE = 5.0;
const float VCC = 3.3;
float calibrationR0 = 10.0;

// Variables globales
unsigned long lastReadingTime = 0;
unsigned long lastCommandCheckTime = 0;
unsigned long lastConfigCheckTime = 0;
const unsigned long READING_INTERVAL = 5000;      // Enviar datos cada 5 segundos
const unsigned long COMMAND_CHECK_INTERVAL = 2000; // Verificar comandos cada 2 segundos
const unsigned long CONFIG_CHECK_INTERVAL = 60000; // Verificar config cada 1 minuto

void connectWiFi() {
  Serial.println("\n[WiFi] Conectando...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] ✅ Conectado!");
    Serial.print("[WiFi] IP: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] ❌ Error de conexión WiFi");
    // No reiniciamos inmediatamente, intentamos de nuevo en el loop
  }
}

int readMQ2Raw() {
  long sum = 0;
  for (int i = 0; i < 10; i++) {
    sum += analogRead(MQ2_PIN);
    delay(10);
  }
  return sum / 10;
}

float adcToVoltage(int adcValue) {
  return (adcValue / 4095.0) * VCC;
}

float calculateRs(float voltage) {
  if (voltage <= 0 || voltage >= VCC) return 0;
  return ((VCC - voltage) / voltage) * RL_VALUE;
}

float calculatePPM(float rs) {
  if (calibrationR0 <= 0 || rs <= 0) return 0;
  
  float ratio = rs / calibrationR0;
  
  // Fórmula para MQ2 (LPG/Propano)
  // PPM = a * (Rs/R0)^b
  const float a = 574.25;
  const float b = -2.222;
  float ppm = a * pow(ratio, b);
  
  if (ppm < 0) ppm = 0;
  if (ppm > 10000) ppm = 10000;
  
  return ppm;
}

void getConfig() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  WiFiClientSecure client;
  client.setInsecure(); // Para Railway HTTPS
  
  HTTPClient http;
  http.begin(client, configUrl);
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    
    #if ARDUINOJSON_VERSION_MAJOR >= 7
      JsonDocument doc;
    #else
      DynamicJsonDocument doc(512);
    #endif

    DeserializationError error = deserializeJson(doc, payload);
    
    if (!error) {
      calibrationR0 = doc["calibrationR0"] | 10.0;
      Serial.println("[CONFIG] Configuración actualizada");
      Serial.printf("  R0: %.2f kΩ\n", calibrationR0);
    }
  }
  
  http.end();
}

void sendSensorData() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] WiFi desconectado");
    return;
  }
  
  // Leer sensores
  int rawValue = readMQ2Raw();
  float voltage = adcToVoltage(rawValue);
  float rs = calculateRs(voltage);
  float ppm = calculatePPM(rs);
  float ratio = (calibrationR0 > 0) ? rs / calibrationR0 : 0;
  
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  
  if (isnan(temperature) || isnan(humidity)) {
    temperature = 0;
    humidity = 0;
  }
  
  // Crear JSON
  #if ARDUINOJSON_VERSION_MAJOR >= 7
    JsonDocument doc;
  #else
    DynamicJsonDocument doc(512);
  #endif

  doc["deviceKey"] = DEVICE_KEY;
  doc["rawValue"] = rawValue;
  doc["voltage"] = voltage;
  doc["gasConcentrationPpm"] = ppm;
  doc["rsRoRatio"] = ratio;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  
  String jsonData;
  serializeJson(doc, jsonData);
  
  WiFiClientSecure client;
  client.setInsecure();
  
  HTTPClient http;
  http.begin(client, sensorDataUrl);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.POST(jsonData);
  
  if (httpCode > 0) {
    String response = http.getString();
    
    #if ARDUINOJSON_VERSION_MAJOR >= 7
      JsonDocument responseDoc;
    #else
      DynamicJsonDocument responseDoc(512);
    #endif

    DeserializationError error = deserializeJson(responseDoc, response);
    
    if (!error && responseDoc.containsKey("command")) {
      JsonObject command = responseDoc["command"];
      if (!command.isNull()) {
        bool ledState = command["ledState"] | false;
        bool buzzerState = command["buzzerState"] | false;
        digitalWrite(LED_PIN, ledState ? HIGH : LOW);
        digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
      }
    }
    Serial.printf("[HTTP] POST OK (%d)\n", httpCode);
  } else {
    Serial.printf("[HTTP] ❌ Error: %s\n", http.errorToString(httpCode).c_str());
  }
  
  http.end();
}

void checkForCommands() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  WiFiClientSecure client;
  client.setInsecure();
  
  HTTPClient http;
  http.begin(client, commandUrl);
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    
    #if ARDUINOJSON_VERSION_MAJOR >= 7
      JsonDocument doc;
    #else
      DynamicJsonDocument doc(512);
    #endif

    DeserializationError error = deserializeJson(doc, payload);
    
    if (!error) {
      bool ledState = doc["ledState"] | false;
      bool buzzerState = doc["buzzerState"] | false;
      digitalWrite(LED_PIN, ledState ? HIGH : LOW);
      digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
    }
  }
  
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n========================================");
  Serial.println("  ESP32 - Monitor de Gas MQ2 + DHT11");
  Serial.println("  Soporte Railway HTTPS");
  Serial.println("========================================");
  
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(MQ2_PIN, INPUT);
  
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  
  dht.begin();
  connectWiFi();
  
  // Construir URLs
  String base = String(BASE_URL);
  sensorDataUrl = base + "/sensor-data";
  commandUrl = base + "/sensor-data/command/" + String(DEVICE_KEY);
  configUrl = base + "/sensor-data/config/" + String(DEVICE_KEY);
  
  Serial.println("\n[HTTP] URLs configuradas para Railway:");
  Serial.println("  POST: " + sensorDataUrl);
  
  getConfig();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    delay(2000);
    return;
  }
  
  unsigned long currentTime = millis();
  
  if (currentTime - lastReadingTime >= READING_INTERVAL) {
    lastReadingTime = currentTime;
    sendSensorData();
  }
  
  if (currentTime - lastCommandCheckTime >= COMMAND_CHECK_INTERVAL) {
    lastCommandCheckTime = currentTime;
    checkForCommands();
  }
  
  if (currentTime - lastConfigCheckTime >= CONFIG_CHECK_INTERVAL) {
    lastConfigCheckTime = currentTime;
    getConfig();
  }
  
  delay(100);
}

