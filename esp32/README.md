# 📦 Instalación de Librerías para ESP32

## Librerías Requeridas

Para que el código del ESP32 funcione correctamente, necesitas instalar las siguientes librerías en el Arduino IDE:

### 1. DHT sensor library (para DHT11)

**Opción A: Desde el Library Manager del Arduino IDE**

1. Abre Arduino IDE
2. Ve a `Sketch` → `Include Library` → `Manage Libraries...`
3. Busca "DHT sensor library" por Adafruit
4. Instala "DHT sensor library" by Adafruit
5. También instala "Adafruit Unified Sensor" (dependencia requerida)

**Opción B: Instalación Manual**

```bash
# Clonar las librerías
cd ~/Arduino/libraries/
git clone https://github.com/adafruit/DHT-sensor-library.git
git clone https://github.com/adafruit/Adafruit_Sensor.git
```

### 2. ArduinoJson

**Desde el Library Manager:**

1. Abre Arduino IDE
2. Ve a `Sketch` → `Include Library` → `Manage Libraries...`
3. Busca "ArduinoJson"
4. Instala "ArduinoJson" by Benoit Blanchon (versión 6.x)

### 3. HTTPClient y WiFi

Estas librerías vienen incluidas con el ESP32 board package, no necesitas instalarlas por separado.

## Conexiones del Hardware

### Sensor MQ2 (Gas)

- **VCC** → 3.3V del ESP32
- **GND** → GND del ESP32
- **AOUT** → GPIO 34 (Pin analógico)

### Sensor DHT11 (Temperatura y Humedad)

- **VCC** → 3.3V o 5V del ESP32
- **GND** → GND del ESP32
- **DATA** → GPIO 15 del ESP32
- **Resistor Pull-up**: 10kΩ entre VCC y DATA (algunos módulos DHT11 ya lo incluyen)

### LED

- **Ánodo (+)** → GPIO 2 del ESP32 (a través de resistor 220Ω)
- **Cátodo (-)** → GND

### Buzzer

- **Positivo** → GPIO 4 del ESP32
- **Negativo** → GND

## Diagrama de Conexión

```
ESP32          MQ2
-----          ---
3.3V    →      VCC
GND     →      GND
GPIO34  →      AOUT

ESP32          DHT11
-----          -----
3.3V    →      VCC
GND     →      GND
GPIO15  →      DATA

ESP32          LED
-----          ---
GPIO2   →      Ánodo (+) → [220Ω] → Cátodo (-) → GND

ESP32          Buzzer
-----          ------
GPIO4   →      Positivo
GND     →      Negativo
```

## Configuración del Código

Antes de subir el código al ESP32, actualiza estas constantes en el archivo `.ino`:

```cpp
// Configuración WiFi
const char* WIFI_SSID = "TU_WIFI_SSID";          // Nombre de tu red WiFi
const char* WIFI_PASSWORD = "TU_WIFI_PASSWORD";  // Contraseña de tu WiFi

// Configuración Servidor
const char* SERVER_HOST = "192.168.X.X";         // IP de tu servidor backend
const int SERVER_PORT = 3000;                     // Puerto del servidor
const char* DEVICE_KEY = "TU_DEVICE_KEY";        // Device key de tu dispositivo
```

## Subir el Código

1. Conecta el ESP32 a tu computadora vía USB
2. En Arduino IDE, selecciona:
   - **Board**: "ESP32 Dev Module" (o tu modelo específico)
   - **Port**: El puerto COM/ttyUSB donde está conectado el ESP32
3. Haz clic en "Upload" (→)
4. Espera a que se compile y suba el código

## Verificación

Después de subir el código, abre el Serial Monitor (`Tools` → `Serial Monitor`) y configura el baud rate a **115200**.

Deberías ver:

```
========================================
  ESP32 - Monitor de Gas MQ2 + DHT11
  Comunicación HTTP
========================================
[WiFi] Conectando...
[WiFi] ✅ Conectado!
[WiFi] IP: 192.168.X.X
[DHT11] Sensor inicializado
[HTTP] URLs configuradas:
  POST: http://192.168.X.X:3000/sensor-data
  GET:  http://192.168.X.X:3000/sensor-data/command/...
  GET:  http://192.168.X.X:3000/sensor-data/config/...
[MQ2] Precalentando sensor (30 segundos)...
```

## Troubleshooting

### Error: "DHT.h: No such file or directory"

- Instala la librería "DHT sensor library" y "Adafruit Unified Sensor"

### Error: "WiFi.h: No such file or directory"

- Asegúrate de tener seleccionado un board ESP32 en el Arduino IDE

### El sensor DHT11 devuelve NaN

- Verifica las conexiones
- Asegúrate de tener el resistor pull-up de 10kΩ
- Espera unos segundos después del inicio para que el sensor se estabilice

### No se conecta al WiFi

- Verifica el SSID y contraseña
- Asegúrate de que el ESP32 esté en rango de la red WiFi
- Verifica que tu red sea de 2.4GHz (ESP32 no soporta 5GHz)

### Error HTTP al enviar datos

- Verifica que el backend esté corriendo
- Verifica la IP y puerto del servidor
- Asegúrate de que el device key sea correcto
