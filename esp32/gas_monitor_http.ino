/*
 * ESP32 - Monitor Multi-Gas (MQ2 + MQ3 + MQ5 + MQ9) + DHT11
 * Comunicación: WebSocket (datos en vivo) + HTTP POST (solo alertas)
 */

#include <ArduinoJson.h>
#include <DHT.h>
#include <ESP32Servo.h>
#include <HTTPClient.h>
#include <SocketIOclient.h>
#include <WebSocketsClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

Servo windowServo;
bool autoMode = true; // El sistema empieza en modo automático
bool manWindowOpen = false;
bool manFanOn = false;
bool currentWindowOpen = false; // Estado real actual
bool currentFanOn = false;      // Estado real actual
unsigned long lastManualTime = 0;
const unsigned long MANUAL_OVERRIDE_TIMEOUT = 300000; // 5 minutos

// ==========================================
// ESTRUCTURAS
// ==========================================
struct SensorReading {
  int raw;
  float voltage;
  float rs;
  float ppm;
};

// ==========================================
// CONFIGURACIÓN DE RED Y SERVIDOR
// ==========================================
const char *WIFI_SSID = "josue";
const char *WIFI_PASSWORD = "josue4657";

const char *SERVER_HOSTNAME = "mi-backend-iot.onrender.com";
const int SERVER_PORT = 443;
const char *BASE_URL = "https://mi-backend-iot.onrender.com";
const char *DEVICE_KEY = "00d6644c-3785-4a2d-ae71-1ec6c81b1a9a";

// ==========================================
// PINES
// ==========================================
const int MQ2_PIN = 34; // Gas LPG, Humo
const int MQ3_PIN = 35; // Alcohol
const int MQ5_PIN = 32; // Metano
const int MQ9_PIN = 33; // CO
const int LED_PIN = 2;
const int BUZZER_PIN = 4;
const int DHT_PIN = 25;
const int FAN_PIN =
    27; // Relé para el ventilador (GPIO 27, pin limpio sin JTAG)
const int WINDOW_SERVO_PIN = 26; // Servo MG996R

#define DHTTYPE DHT11
DHT dht(DHT_PIN, DHTTYPE);

// ==========================================
// CONSTANTES
// ==========================================
const float RL_VALUE = 5.0;
const float VCC = 3.3;

float r0_MQ2 = 5.5;
float r0_MQ3 = 2.0; // Ajustado según tus lecturas de 120k en aire (120/60 = 2)
float r0_MQ5 =
    20.0; // Ajustado según tu lectura de ~180k en aire limpia (180/9)
float r0_MQ9 = 12.0; // Ajustado según tu lectura de ~150k en aire (150/12.5)

float THRESHOLD_MQ2 = 300.0;
float THRESHOLD_MQ3 = 150.0;
float THRESHOLD_MQ5 = 200.0;
float THRESHOLD_MQ9 = 100.0;

unsigned long lastStreamTime = 0;
unsigned long lastAlertTime_MQ2 = 0;
unsigned long lastAlertTime_MQ3 = 0;
unsigned long lastAlertTime_MQ5 = 0;
unsigned long lastAlertTime_MQ9 = 0;
const unsigned long STREAM_INTERVAL =
    2000; // 2 segundos (1s causa WDT crash con HTTPS alerts)
const unsigned long ALERT_COOLDOWN =
    15000; // 15 segundos mínimo entre alertas del mismo sensor
float lastSentPpm_MQ2 = 0, lastSentPpm_MQ3 = 0, lastSentPpm_MQ5 = 0,
      lastSentPpm_MQ9 = 0;
bool calibrationDone =
    false; // No activar actuadores hasta que termine la calibración

bool wsConnected = false;
SocketIOclient socketIO;
String alertUrl;
String configUrl;

// ==========================================
// FUNCIONES DE CÁLCULO
// ==========================================

float adcToVoltage(int adcValue) { return (adcValue / 4095.0) * VCC; }

float calculateRs(float voltage) {
  if (voltage <= 0.05)
    return 1000.0;
  if (voltage >= VCC - 0.05)
    return 0.01;
  return ((VCC - voltage) / voltage) * RL_VALUE;
}

float calculatePPM(float rs, float r0, float a, float b, float cleanAirRatio) {
  if (r0 <= 0 || rs <= 0.01)
    return 0;
  float ratio = rs / r0;
  float ppm = a * pow(ratio, b);
  float cleanAirPpm = a * pow(cleanAirRatio, b);
  float adjustedPpm = ppm - cleanAirPpm;
  return (adjustedPpm < 0) ? 0 : (adjustedPpm > 10000 ? 10000 : adjustedPpm);
}

int readSensorAvg(int pin) {
  long total = 0;
  for (int i = 0; i < 10; i++) {
    total += analogRead(pin);
    delay(5);
  }
  return total / 10;
}

SensorReading readMQSensor(int pin, float r0, float a, float b,
                           float cleanAirRatio) {
  SensorReading reading;
  reading.raw = readSensorAvg(pin);
  reading.voltage = adcToVoltage(reading.raw);
  reading.rs = calculateRs(reading.voltage);
  reading.ppm = calculatePPM(reading.rs, r0, a, b, cleanAirRatio);
  return reading;
}

// ==========================================
// HARDWARE Y COMUNICACIÓN
// ==========================================

void playBuzzerPattern(String severity) {
  int beeps = (severity == "CRITICAL") ? 3 : (severity == "HIGH" ? 2 : 1);
  int d = (severity == "CRITICAL") ? 100 : 300;
  for (int i = 0; i < beeps; i++) {
    digitalWrite(BUZZER_PIN, HIGH);
    delay(d);
    digitalWrite(BUZZER_PIN, LOW);
    delay(50);
  }
}

void getConfig() {
  if (WiFi.status() != WL_CONNECTED)
    return;
  WiFiClientSecure client;
  client.setInsecure(); // No validar el certificado SSL
  HTTPClient http;
  if (http.begin(client, configUrl)) {
    int httpCode = http.GET();
    if (httpCode == 200) {
      JsonDocument doc;
      deserializeJson(doc, http.getString());

      // Solo cargamos UMBRALES del backend (los R0 se recalculan al calibrar)
      THRESHOLD_MQ2 = doc["mq2Threshold"] | 300.0;
      THRESHOLD_MQ3 = doc["mq3Threshold"] | 150.0;
      THRESHOLD_MQ5 = doc["mq5Threshold"] | 200.0;
      THRESHOLD_MQ9 = doc["mq9Threshold"] | 100.0;

      Serial.printf(
          "[CONFIG] Umbrales cargados -> MQ2:%.0f MQ3:%.0f MQ5:%.0f MQ9:%.0f\n",
          THRESHOLD_MQ2, THRESHOLD_MQ3, THRESHOLD_MQ5, THRESHOLD_MQ9);
    } else {
      Serial.printf("[CONFIG] Error HTTP: %d, usando defaults\n", httpCode);
    }
    http.end();
  }
}

void updateConfigInBackend() {
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure(); // No validar el certificado SSL
    HTTPClient http;
    http.begin(client, configUrl);
    http.addHeader("Content-Type", "application/json");

    JsonDocument doc;
    doc["mq2R0"] = r0_MQ2;
    doc["mq3R0"] = r0_MQ3;
    doc["mq5R0"] = r0_MQ5;
    doc["mq9R0"] = r0_MQ9;
    doc["mq2Threshold"] = THRESHOLD_MQ2;
    doc["mq3Threshold"] = THRESHOLD_MQ3;
    doc["mq5Threshold"] = THRESHOLD_MQ5;
    doc["mq9Threshold"] = THRESHOLD_MQ9;

    String json;
    serializeJson(doc, json);
    int code = http.PATCH(json);
    Serial.printf("[CONFIG] R0 + Umbrales enviados. Codigo: %d\n", code);
    http.end();
  }
}

void calibrateAllSensors() {
  Serial.println("\n[CALIB] Iniciando auto-calibracion (Aire Limpio)...");
  Serial.println("[CALIB] Favor no acercar gases durante 10 segundos.");

  float mq2Sum = 0, mq3Sum = 0, mq5Sum = 0, mq9Sum = 0;
  int samples = 50;

  for (int i = 0; i < samples; i++) {
    mq2Sum += calculateRs(adcToVoltage(readSensorAvg(MQ2_PIN))) / 9.83;
    mq3Sum += calculateRs(adcToVoltage(readSensorAvg(MQ3_PIN))) / 60.0;
    mq5Sum += calculateRs(adcToVoltage(readSensorAvg(MQ5_PIN))) / 6.5;
    mq9Sum += calculateRs(adcToVoltage(readSensorAvg(MQ9_PIN))) / 9.0;
    delay(200);
    yield(); // Evitar WDT reset
    if (i % 10 == 0)
      Serial.print(".");
  }

  r0_MQ2 = mq2Sum / samples;
  r0_MQ3 = mq3Sum / samples;
  r0_MQ5 = mq5Sum / samples;
  r0_MQ9 = mq9Sum / samples;

  Serial.printf("\n[CALIB] R0 -> MQ2:%.2f MQ3:%.2f MQ5:%.2f MQ9:%.2f\n", r0_MQ2,
                r0_MQ3, r0_MQ5, r0_MQ9);

  // Leer PPM base del ambiente con los R0 recién calibrados
  SensorReading baseMQ2 = readMQSensor(MQ2_PIN, r0_MQ2, 574.25, -2.222, 9.83);
  SensorReading baseMQ3 = readMQSensor(MQ3_PIN, r0_MQ3, 200.0, -1.4, 60.0);
  SensorReading baseMQ5 = readMQSensor(MQ5_PIN, r0_MQ5, 500.0, -2.5, 6.5);
  SensorReading baseMQ9 = readMQSensor(MQ9_PIN, r0_MQ9, 800.0, -2.0, 9.0);

  Serial.printf("[CALIB] PPM base (debe ser aprox 0) -> MQ2:%.1f MQ3:%.1f "
                "MQ5:%.1f MQ9:%.1f\n",
                baseMQ2.ppm, baseMQ3.ppm, baseMQ5.ppm, baseMQ9.ppm);

  // Umbrales = 3x el nivel base del ambiente (con minimos de seguridad)
  const float MULTIPLIER = 3.0;
  THRESHOLD_MQ2 = max(baseMQ2.ppm * MULTIPLIER, 100.0f); // Min 100 PPM
  THRESHOLD_MQ3 = max(baseMQ3.ppm * MULTIPLIER, 50.0f);  // Min 50 PPM
  THRESHOLD_MQ5 = max(baseMQ5.ppm * MULTIPLIER, 80.0f);  // Min 80 PPM
  THRESHOLD_MQ9 = max(baseMQ9.ppm * MULTIPLIER, 30.0f);  // Min 30 PPM

  Serial.printf(
      "[CALIB] Umbrales auto -> MQ2:%.0f MQ3:%.0f MQ5:%.0f MQ9:%.0f\n",
      THRESHOLD_MQ2, THRESHOLD_MQ3, THRESHOLD_MQ5, THRESHOLD_MQ9);

  updateConfigInBackend();
}

void sendGasAlert(String gasType, float ppm, float voltage, int raw,
                  String sensorSource) {
  if (WiFi.status() == WL_CONNECTED) {
    WiFiClientSecure client;
    client.setInsecure(); // No validar el certificado SSL
    HTTPClient http;
    http.begin(client, alertUrl);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(2000); // MÁXIMO 2 segundos de espera

    JsonDocument doc;
    doc["deviceKey"] = DEVICE_KEY;
    doc["gasType"] = gasType;
    doc["gasConcentrationPpm"] = ppm;
    doc["voltage"] = voltage;
    doc["rawValue"] = raw;
    doc["sensorSource"] = sensorSource;

    String json;
    serializeJson(doc, json);
    int code = http.POST(json);

    if (code > 0) {
      Serial.printf("[HTTP] Alerta enviada! Codigo: %d\n", code);
    } else {
      Serial.printf("[HTTP] Error enviando alerta: %s\n",
                    http.errorToString(code).c_str());
    }
    http.end();
  }
}

void streamSensorData() {
  // Leer los 4 sensores
  SensorReading mq2 = readMQSensor(MQ2_PIN, r0_MQ2, 574.25, -2.222, 9.83);
  SensorReading mq3 = readMQSensor(MQ3_PIN, r0_MQ3, 200.0, -1.4,
                                   60.0); // +sensible (antes 150, -1.5)
  SensorReading mq5 = readMQSensor(MQ5_PIN, r0_MQ5, 500.0, -2.5, 6.5);
  SensorReading mq9 = readMQSensor(MQ9_PIN, r0_MQ9, 800.0, -2.0,
                                   9.0); // +sensible (antes 600, -2.2)
  float temp = dht.readTemperature();
  float hum = dht.readHumidity();

  // --- Lógica de Severidad para Buzzer ---
  String maxSeverity = "NONE";
  float p_mq2 = mq2.ppm / THRESHOLD_MQ2;
  float p_mq3 = mq3.ppm / THRESHOLD_MQ3;
  float p_mq5 = mq5.ppm / THRESHOLD_MQ5;
  float p_mq9 = mq9.ppm / THRESHOLD_MQ9;
  float maxP = max(max(p_mq2, p_mq3), max(p_mq5, p_mq9));

  if (maxP >= 2.0)
    maxSeverity = "CRITICAL";
  else if (maxP >= 1.5)
    maxSeverity = "HIGH";
  else if (maxP >= 1.0)
    maxSeverity = "MEDIUM";
  else if (maxP >= 0.8)
    maxSeverity = "LOW";

  if (maxSeverity != "NONE") {
    playBuzzerPattern(maxSeverity);
  }

  // Detectar si cualquier sensor supera su umbral (Peligro)
  bool anySensorAboveThreshold =
      (mq2.ppm >= THRESHOLD_MQ2 || mq3.ppm >= THRESHOLD_MQ3 ||
       mq5.ppm >= THRESHOLD_MQ5 || mq9.ppm >= THRESHOLD_MQ9);

  // Activar LED basado solo en los umbrales de los sensores
  digitalWrite(LED_PIN, anySensorAboveThreshold ? HIGH : LOW);

  // --- Lógica de Actuadores (Auto vs Manual) ---
  unsigned long now = millis();
  bool targetWindowOpen = currentWindowOpen;
  bool targetFanOn = currentFanOn;

  // Si pasaron 5 min, volver a Auto
  if (!autoMode && (now - lastManualTime > MANUAL_OVERRIDE_TIMEOUT)) {
    autoMode = true;
    Serial.println("[SYSTEM] Volviendo a modo AUTOMÁTICO");
  }

  if (autoMode) {
    // Histeresis: Si ya estaba prendido, se apaga solo si baja del 80% del
    // umbral
    float margin = 0.8;
    bool danger = anySensorAboveThreshold;

    bool keepOn = (currentWindowOpen && (mq2.ppm >= THRESHOLD_MQ2 * margin ||
                                         mq3.ppm >= THRESHOLD_MQ3 * margin ||
                                         mq5.ppm >= THRESHOLD_MQ5 * margin ||
                                         mq9.ppm >= THRESHOLD_MQ9 * margin));

    targetWindowOpen = danger || keepOn;
    targetFanOn = danger || keepOn;

    // No activar actuadores hasta que la calibración haya terminado
    if (!calibrationDone) {
      targetWindowOpen = false;
      targetFanOn = false;
    }
  } else {
    targetWindowOpen = manWindowOpen;
    targetFanOn = manFanOn;
  }

  // --- APLICAR CAMBIOS SOLO SI HAY CAMBIO DE ESTADO ---
  if (targetWindowOpen != currentWindowOpen) {
    currentWindowOpen = targetWindowOpen;
    windowServo.write(currentWindowOpen ? 90 : 0);
    Serial.printf("[ACTUATOR] Ventana: %s\n",
                  currentWindowOpen ? "ABIERTA" : "CERRADA");
  }

  if (targetFanOn != currentFanOn) {
    currentFanOn = targetFanOn;
    digitalWrite(FAN_PIN, currentFanOn ? LOW : HIGH); // LOW=ON, HIGH=OFF
    Serial.printf("[ACTUATOR] Ventilador: %s\n", currentFanOn ? "ON" : "OFF");
  }

  yield(); // Dar respiro al sistema de red

  // ========== WEBOCKET PRIMERO (instantáneo) ==========
  // Enviamos datos por WebSocket ANTES de las alertas HTTP
  // para que el frontend reciba datos en tiempo real sin importar si las
  // alertas tardan
  if (wsConnected) {
    JsonDocument doc;
    JsonArray arr = doc.to<JsonArray>();
    arr.add("sensorData");
    JsonObject wsData = arr.add<JsonObject>();
    wsData["deviceKey"] = DEVICE_KEY;
    wsData["mq2"]["ppm"] = round(mq2.ppm * 100) / 100.0;
    wsData["mq2"]["raw"] = mq2.raw;
    wsData["mq3"]["ppm"] = round(mq3.ppm * 100) / 100.0;
    wsData["mq3"]["raw"] = mq3.raw;
    wsData["mq5"]["ppm"] = round(mq5.ppm * 100) / 100.0;
    wsData["mq5"]["raw"] = mq5.raw;
    wsData["mq9"]["ppm"] = round(mq9.ppm * 100) / 100.0;
    wsData["mq9"]["raw"] = mq9.raw;
    if (isnan(temp)) {
      wsData["temperature"] = nullptr;
    } else {
      wsData["temperature"] = round(temp * 10) / 10.0;
    }

    if (isnan(hum)) {
      wsData["humidity"] = nullptr;
    } else {
      wsData["humidity"] = round(hum * 10) / 10.0;
    }

    String output;
    serializeJson(doc, output);
    socketIO.sendEVENT(output);
  }

  yield(); // Respiro antes de alertas HTTP

  // ========== ALERTAS HTTP DESPUÉS (lento, bloqueante) ==========
  // Máximo 1 alerta por ciclo para no saturar el CPU
  auto shouldAlert = [&](float currentPpm, float lastPpm,
                         unsigned long lastTime, float threshold) {
    if (currentPpm < threshold)
      return false;
    if (lastTime == 0)
      return true;
    unsigned long timePassed = now - lastTime;
    if (timePassed >= ALERT_COOLDOWN) {
      return (abs(currentPpm - lastPpm) > (lastPpm * 0.1) ||
              currentPpm >= threshold);
    }
    return false;
  };

  bool alertSent = false;

  if (!alertSent &&
      shouldAlert(mq2.ppm, lastSentPpm_MQ2, lastAlertTime_MQ2, THRESHOLD_MQ2)) {
    lastAlertTime_MQ2 = now;
    lastSentPpm_MQ2 = mq2.ppm;
    sendGasAlert((mq2.ppm > 500) ? "SMOKE" : "LPG", mq2.ppm, mq2.voltage,
                 mq2.raw, "MQ2");
    alertSent = true;
  }
  yield();
  if (!alertSent &&
      shouldAlert(mq3.ppm, lastSentPpm_MQ3, lastAlertTime_MQ3, THRESHOLD_MQ3)) {
    lastAlertTime_MQ3 = now;
    lastSentPpm_MQ3 = mq3.ppm;
    sendGasAlert("ALCOHOL", mq3.ppm, mq3.voltage, mq3.raw, "MQ3");
    alertSent = true;
  }
  yield();
  if (!alertSent &&
      shouldAlert(mq5.ppm, lastSentPpm_MQ5, lastAlertTime_MQ5, THRESHOLD_MQ5)) {
    lastAlertTime_MQ5 = now;
    lastSentPpm_MQ5 = mq5.ppm;
    sendGasAlert("METHANE", mq5.ppm, mq5.voltage, mq5.raw, "MQ5");
    alertSent = true;
  }
  yield();
  if (!alertSent &&
      shouldAlert(mq9.ppm, lastSentPpm_MQ9, lastAlertTime_MQ9, THRESHOLD_MQ9)) {
    lastAlertTime_MQ9 = now;
    lastSentPpm_MQ9 = mq9.ppm;
    sendGasAlert((mq9.ppm > 150.0) ? "SMOKE" : "CO", mq9.ppm, mq9.voltage,
                 mq9.raw, "MQ9");
    alertSent = true;
  }
}

void socketIOEvent(socketIOmessageType_t type, uint8_t *payload,
                   size_t length) {
  switch (type) {
  case sIOtype_DISCONNECT:
    wsConnected = false;
    Serial.println("[WS] ❌ Desconectado");
    break;
  case sIOtype_CONNECT:
    wsConnected = true;
    Serial.println("[WS] ✅ Conectado!");
    socketIO.send(sIOtype_CONNECT, "/");
    socketIO.sendEVENT("[\"register\",{\"deviceKey\":\"" + String(DEVICE_KEY) +
                       "\"}]");
    break;

  case sIOtype_EVENT: {
    String event = (char *)payload;
    if (event.indexOf("actuatorCommand") != -1) {
      JsonDocument doc;
      deserializeJson(doc, payload);
      // El formato es ["actuatorCommand", {"actuator": "window", "status":
      // true}]
      JsonObject data = doc[1];
      String actuator = data["actuator"];
      bool status = data["status"];

      autoMode =
          false; // Desactivar modo auto temporalmente por intervención manual
      lastManualTime = millis();

      if (actuator == "window") {
        manWindowOpen = status;
      } else if (actuator == "fan") {
        manFanOn = status;
      }
    } else if (event.indexOf("calibrate") != -1) {
      Serial.println("[WS] 🛠 Orden de calibración recibida");
      calibrateAllSensors();
    }
    yield();
    break;
  }

  case sIOtype_ERROR:
    Serial.printf("[WS] ⚠️ Error: %s\n", payload);
    break;
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  // Relé activo en LOW: HIGH = apagado, LOW = prendido
  digitalWrite(FAN_PIN, HIGH);
  pinMode(FAN_PIN, OUTPUT);
  digitalWrite(FAN_PIN, HIGH); // Relé APAGADO

  dht.begin();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  // URLs para HTTP (alertas y configuración)
  alertUrl = String(BASE_URL) + "/sensor-data/alert";
  configUrl = String(BASE_URL) + "/sensor-data/config/" + String(DEVICE_KEY);
  Serial.println("[HTTP] URL alerta: " + alertUrl);

  // 1. Calibrar sensores: calcula R0 + umbrales basados en el ambiente actual y
  // los sube al backend NO llamamos getConfig() despues porque sobreescribiria
  // los umbrales recien calculados
  calibrateAllSensors();

  // Marcar calibración como completa - ahora sí se pueden activar actuadores
  calibrationDone = true;
  Serial.println("[SYSTEM] Calibracion completa. Actuadores habilitados.");

  // Inicializar Servo
  ESP32PWM::allocateTimer(0);
  ESP32PWM::allocateTimer(1);
  windowServo.setPeriodHertz(50);
  windowServo.attach(WINDOW_SERVO_PIN, 500, 2400);
  windowServo.write(0); // Cerrada al iniciar

  socketIO.beginSSL(SERVER_HOSTNAME, SERVER_PORT,
                    "/socket.io/?EIO=4&transport=websocket");
  socketIO.onEvent(socketIOEvent);

  Serial.println("[WS] 🔌 Iniciando conexión...");
}

void loop() {
  // Seguridad: mantener relé apagado si la calibración no terminó
  if (!calibrationDone) {
    digitalWrite(FAN_PIN, HIGH); // Mantener apagado hasta calibrar
  }
  socketIO.loop();
  if (millis() - lastStreamTime >= STREAM_INTERVAL) {
    lastStreamTime = millis();
    streamSensorData();
  }
}