/*
 * ESP32 - Monitor de Gas MQ2 + DHT11
 * Comunicación HTTP (Simple y Confiable)
 * 
 * Este código usa HTTP POST para enviar datos cada 5 segundos
 * y HTTP GET para obtener comandos del servidor
 * Incluye sensor DHT11 para temperatura y humedad
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// Configuración WiFi
const char* WIFI_SSID = "TU_WIFI_SSID";
const char* WIFI_PASSWORD = "TU_WIFI_PASSWORD";

// Configuración Servidor
const char* SERVER_HOST = "TU_SERVER_HOST"; // Ejemplo: "192.168.18.182"
const int SERVER_PORT = 3000;
const char* DEVICE_KEY = "TU_DEVICE_KEY";

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

// Configuración Sensor
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
    Serial.println("\n[WiFi] ❌ Error");
    ESP.restart();
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
  
  // Validar que el ratio esté en un rango razonable
  if (ratio < 0.1 || ratio > 10.0) {
    Serial.println("[WARNING] Rs/R0 ratio fuera de rango. Verifica calibración.");
    return 0;
  }
  
  // Fórmula para MQ2 (LPG/Propano)
  // PPM = a * (Rs/R0)^b
  const float a = 574.25;
  const float b = -2.222;
  float ppm = a * pow(ratio, b);
  
  // Limitar a valores razonables (0-10000 PPM)
  if (ppm < 0) ppm = 0;
  if (ppm > 10000) ppm = 10000;
  
  return ppm;
}

void getConfig() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  http.begin(configUrl);
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, payload);
    
    if (!error) {
      calibrationR0 = doc["calibrationR0"] | 10.0;
      Serial.println("[CONFIG] Configuración actualizada");
      Serial.printf("  R0: %.2f kΩ\n", calibrationR0);
      Serial.printf("  Gas Threshold: %.0f PPM\n", doc["gasThreshold"].as<float>());
    }
  }
  
  http.end();
}

void sendSensorData() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[HTTP] WiFi desconectado");
    return;
  }
  
  // Leer sensor MQ2
  int rawValue = readMQ2Raw();
  float voltage = adcToVoltage(rawValue);
  float rs = calculateRs(voltage);
  float ppm = calculatePPM(rs);
  float ratio = (calibrationR0 > 0) ? rs / calibrationR0 : 0;
  
  // Leer sensor DHT11
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  
  // Verificar si las lecturas del DHT11 son válidas
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("[DHT11] Error leyendo sensor");
    temperature = 0;
    humidity = 0;
  }
  
  Serial.println("\n========== LECTURA DEL SENSOR ==========");
  Serial.printf("Raw ADC: %d\n", rawValue);
  Serial.printf("Voltage: %.3f V\n", voltage);
  Serial.printf("Rs: %.2f kΩ\n", rs);
  Serial.printf("Rs/R0: %.3f\n", ratio);
  Serial.printf("Gas: %.2f PPM\n", ppm);
  Serial.printf("Temperatura: %.1f °C\n", temperature);
  Serial.printf("Humedad: %.1f %%\n", humidity);
  Serial.println("========================================");
  
  // Crear JSON
  DynamicJsonDocument doc(512);
  doc["deviceKey"] = DEVICE_KEY;
  doc["rawValue"] = rawValue;
  doc["voltage"] = voltage;
  doc["gasConcentrationPpm"] = ppm;
  doc["rsRoRatio"] = ratio;
  doc["temperature"] = temperature;
  doc["humidity"] = humidity;
  
  String jsonData;
  serializeJson(doc, jsonData);
  
  // Enviar HTTP POST
  HTTPClient http;
  http.begin(sensorDataUrl);
  http.addHeader("Content-Type", "application/json");
  
  int httpCode = http.POST(jsonData);
  
  if (httpCode > 0) {
    String response = http.getString();
    
    // Procesar respuesta
    DynamicJsonDocument responseDoc(512);
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
  } else {
    Serial.printf("[HTTP] ❌ Error: %s\n", http.errorToString(httpCode).c_str());
  }
  
  http.end();
}

void checkForCommands() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  http.begin(commandUrl);
  
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, payload);
    
    if (!error) {
      bool ledState = doc["ledState"] | false;
      bool buzzerState = doc["buzzerState"] | false;
      
      digitalWrite(LED_PIN, ledState ? HIGH : LOW);
      digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
      
      if (doc.containsKey("message")) {
        Serial.printf("[COMMAND] %s\n", doc["message"].as<const char*>());
      }
    }
  }
  
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n========================================");
  Serial.println("  ESP32 - Monitor de Gas MQ2 + DHT11");
  Serial.println("  Comunicación HTTP");
  Serial.println("========================================");
  
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(MQ2_PIN, INPUT);
  
  digitalWrite(LED_PIN, LOW);
  digitalWrite(BUZZER_PIN, LOW);
  
  // Inicializar DHT11
  dht.begin();
  Serial.println("\n[DHT11] Sensor inicializado");
  
  connectWiFi();
  
  // Construir URLs
  sensorDataUrl = "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + "/sensor-data";
  commandUrl = "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + "/sensor-data/command/" + String(DEVICE_KEY);
  configUrl = "http://" + String(SERVER_HOST) + ":" + String(SERVER_PORT) + "/sensor-data/config/" + String(DEVICE_KEY);
  
  Serial.println("\n[HTTP] URLs configuradas:");
  Serial.println("  POST: " + sensorDataUrl);
  Serial.println("  GET:  " + commandUrl);
  Serial.println("  GET:  " + configUrl);
  
  // Obtener configuración inicial
  Serial.println("\n[CONFIG] Obteniendo configuración...");
  getConfig();
  
  Serial.println("\n[Setup] ✅ Listo");
  
  // Precalentar sensor
  Serial.println("\n[MQ2] Precalentando sensor (30 segundos)...");
  for (int i = 30; i > 0; i--) {
    Serial.printf("  %d segundos restantes...\n", i);
    delay(1000);
  }
  Serial.println("[MQ2] ✅ Sensor listo\n");
}

void loop() {
  // Verificar WiFi
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Conexión perdida. Reconectando...");
    connectWiFi();
  }
  
  unsigned long currentTime = millis();
  
  // Enviar datos del sensor cada 5 segundos
  if (currentTime - lastReadingTime >= READING_INTERVAL) {
    lastReadingTime = currentTime;
    sendSensorData();
  }
  
  // Verificar comandos cada 2 segundos
  if (currentTime - lastCommandCheckTime >= COMMAND_CHECK_INTERVAL) {
    lastCommandCheckTime = currentTime;
    checkForCommands();
  }
  
  // Actualizar configuración cada 1 minuto
  if (currentTime - lastConfigCheckTime >= CONFIG_CHECK_INTERVAL) {
    lastConfigCheckTime = currentTime;
    getConfig();
  }
  
  delay(100);
}
