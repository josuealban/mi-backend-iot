# 🔥 Sistema de Monitoreo de Gas con ESP32 + NestJS

<p align="center">
  <img src="https://nestjs.com/img/logo-small.svg" width="120" alt="NestJS Logo" />
</p>

<p align="center">
  Sistema completo de monitoreo de gas en tiempo real con sensor MQ2, ESP32 y backend NestJS con notificaciones automáticas.
</p>

---

## 📋 Tabla de Contenidos

- [Descripción General](#-descripción-general)
- [Características](#-características)
- [Arquitectura del Sistema](#-arquitectura-del-sistema)
- [Tecnologías](#-tecnologías)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
- [Base de Datos](#-base-de-datos)
- [API Endpoints](#-api-endpoints)
- [ESP32 - Firmware](#-esp32---firmware)
- [Flujo de Alertas](#-flujo-de-alertas)
- [Scripts Disponibles](#-scripts-disponibles)
- [Documentación API](#-documentación-api)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Troubleshooting](#-troubleshooting)

---

## 🎯 Descripción General

Este proyecto es un **sistema completo de monitoreo de gas** que integra:

- **Hardware**: ESP32 + Sensor MQ2 (detección de gas LPG/Propano)
- **Backend**: NestJS con TypeScript, Prisma ORM y PostgreSQL
- **Comunicación**: HTTP REST API (polling cada 5 segundos)
- **Alertas**: Sistema automático de notificaciones con cooldown para evitar spam
- **Autenticación**: JWT con Passport
- **Documentación**: Swagger UI integrado

El sistema detecta niveles peligrosos de gas, crea alertas automáticas, envía notificaciones a los usuarios y activa LED/Buzzer en el ESP32.

---

## ✨ Características

### 🔐 Autenticación y Usuarios
- ✅ Registro de usuarios con validación
- ✅ Login con JWT (Access Token + Refresh Token)
- ✅ Protección de rutas con Guards
- ✅ Encriptación de contraseñas con bcrypt

### 📟 Gestión de Dispositivos
- ✅ Registro de dispositivos ESP32 con clave única mediante UUID
- ✅ Configuración personalizada por dispositivo
- ✅ Estado en tiempo real (ONLINE/OFFLINE/MAINTENANCE)
- ✅ Historial de lecturas del sensor

### 🚨 Sistema de Alertas Inteligente
- ✅ Detección automática cuando se supera el umbral de gas
- ✅ Clasificación por severidad (LOW, MEDIUM, HIGH, CRITICAL)
- ✅ Cooldown de 1 minuto entre alertas para evitar spam
- ✅ Notificaciones push para usuarios
- ✅ Activación automática de LED/Buzzer en ESP32

### 📊 Monitoreo de Sensores
- ✅ Lecturas cada 5 segundos desde ESP32
- ✅ Almacenamiento de datos históricos
- ✅ Estadísticas y análisis de tendencias
- ✅ Calibración personalizada del sensor MQ2

### ⚙️ Configuración Flexible
- ✅ Umbrales personalizables (gas PPM, voltaje)
- ✅ Control de LED y Buzzer
- ✅ Calibración R0 del sensor
- ✅ Configuración de cooldown de notificaciones

---

## 🛠️ Tecnologías

### Backend
- **Framework**: NestJS 11.x
- **Lenguaje**: TypeScript 5.7
- **ORM**: Prisma 7.x
- **Base de Datos**: PostgreSQL
- **Autenticación**: Passport JWT
- **Validación**: class-validator, class-transformer
- **Documentación**: Swagger/OpenAPI
- **Encriptación**: bcrypt

### Hardware
- **Microcontrolador**: ESP32
- **Sensor**: MQ2 (Gas LPG/Propano)
- **Comunicación**: WiFi + HTTP Client
- **Actuadores**: LED, Buzzer

### Dependencias Principales
```json
{
  "@nestjs/core": "^11.0.1",
  "@nestjs/jwt": "^11.0.1",
  "@nestjs/swagger": "^11.2.3",
  "@prisma/client": "^7.0.1",
  "bcrypt": "^6.0.0",
  "passport-jwt": "^4.0.1",
  "pg": "^8.16.3"
}
```

---

## 📦 Requisitos Previos

- **Node.js**: v18 o superior
- **npm** o **pnpm**: Gestor de paquetes
- **PostgreSQL**: v14 o superior
- **ESP32**: Con WiFi habilitado
- **Sensor MQ2**: Conectado al ESP32

---

## 🚀 Instalación

### 1. Clonar el repositorio
```bash
git clone <repository-url>
cd backend
```

### 2. Instalar dependencias
```bash
npm install
# o
pnpm install
```

### 3. Configurar variables de entorno
Crea un archivo `.env` en la raíz del proyecto:

```env
# Base de Datos
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/nombre_db?schema=public"

# JWT
JWT_SECRET="tu_clave_secreta_super_segura_aqui"
JWT_EXPIRES_IN="1h"
JWT_REFRESH_SECRET="tu_refresh_secret_super_segura"
JWT_REFRESH_EXPIRES_IN="7d"

# Servidor
PORT=3000
NODE_ENV=development
```

### 4. Configurar la base de datos
```bash
# Generar el cliente de Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev

# (Opcional) Abrir Prisma Studio para ver la BD
npx prisma studio
```

### 5. Iniciar el servidor
```bash
# Modo desarrollo (con hot-reload)
npm run start:dev

# Modo producción
npm run build
npm run start:prod
```

El servidor estará disponible en: `http://localhost:3000`

---

## ⚙️ Configuración

### Variables de Entorno

| Variable | Descripción | Valor por Defecto |
|----------|-------------|-------------------|
| `DATABASE_URL` | URL de conexión a PostgreSQL | - |
| `JWT_SECRET` | Clave secreta para JWT | - |
| `JWT_EXPIRES_IN` | Tiempo de expiración del token | `1h` |
| `JWT_REFRESH_SECRET` | Clave para refresh token | - |
| `JWT_REFRESH_EXPIRES_IN` | Expiración del refresh token | `7d` |
| `PORT` | Puerto del servidor | `3000` |

### Configuración del ESP32

Edita el archivo `esp32/gas_monitor_http.ino`:

```cpp
// WiFi
const char* WIFI_SSID = "TuRedWiFi";
const char* WIFI_PASSWORD = "TuContraseña";

// Servidor Backend
const char* SERVER_HOST = "192.168.1.100";  // IP de tu computadora
const int SERVER_PORT = 3000;

// Device Key (obtener del backend después de registrar el dispositivo)
const char* DEVICE_KEY = "tu-device-key-aqui";
```

---

## 🗄️ Base de Datos

### Modelos Principales

#### **User** (Usuarios)
```typescript
{
  id: number
  username: string
  email: string
  password: string (hash)
  isActive: boolean
  devices: Device[]
  notifications: Notification[]
}
```

#### **Device** (Dispositivos ESP32)
```typescript
{
  id: number
  userId: number
  name: string
  deviceKey: string (UUID único)
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE'
  location: string
  lastSeen: DateTime
  deviceSettings: DeviceSettings
  sensorData: SensorData[]
  alerts: Alert[]
}
```

#### **SensorData** (Lecturas del Sensor)
```typescript
{
  id: number
  deviceId: number
  rawValue: number
  voltage: number
  gasConcentrationPpm: number
  rsRoRatio: number
  thresholdPassed: boolean
  createdAt: DateTime
}
```

#### **Alert** (Alertas)
```typescript
{
  id: number
  deviceId: number
  alertType: 'GAS_DETECTED' | 'SENSOR_ERROR' | 'OFFLINE'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  message: string
  gasValuePpm: number
  resolved: boolean
  createdAt: DateTime
}
```

#### **Notification** (Notificaciones)
```typescript
{
  id: number
  userId: number
  alertId: number
  title: string
  message: string
  type: 'ALERT' | 'INFO' | 'WARNING' | 'SUCCESS'
  read: boolean
  createdAt: DateTime
}
```

#### **DeviceSettings** (Configuración)
```typescript
{
  id: number
  deviceId: number
  gasThresholdPpm: number (default: 300)
  voltageThreshold: number (default: 1.5)
  buzzerEnabled: boolean
  ledEnabled: boolean
  notifyUser: boolean
  calibrationR0: number (default: 10.0)
}
```

### Diagrama de Relaciones

```
User (1) ──────< (N) Device
                      │
                      ├──< (N) SensorData
                      ├──< (N) Alert
                      └──< (1) DeviceSettings

User (1) ──────< (N) Notification
Alert (1) ─────< (N) Notification
```

---

### 📟 Dispositivos (`/device`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/device` | Crear nuevo dispositivo | ✅ |
| GET | `/device` | Listar todos los dispositivos | ✅ |
| DELETE | `/device/:id` | Desactivar dispositivo | ✅ |
| POST | `/device/:id/settings` | Crear configuración | ✅ |
| PATCH | `/device/:id/settings` | Actualizar configuración | ✅ |
| GET | `/device/:id/settings` | Obtener configuración | ✅ |

**Ejemplo - Crear Dispositivo:**
```bash
curl -X POST http://localhost:3000/device \
  -H "Authorization: Bearer <tu-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sensor Cocina",
    "description": "Sensor de gas en la cocina",
    "location": "Cocina principal"
  }'
```

**Respuesta:**
```json
{
  "id": 1,
  "name": "Sensor Cocina",
  "deviceKey": "00d6644c-3785-4a2d-ae71-1ec6c81b1a9a",
  "userId": 1,
  "createdAt": "2025-12-05T22:00:00.000Z"
}
```

**Ejemplo - Configurar Dispositivo:**
```bash
curl -X POST http://localhost:3000/device/1/settings \
  -H "Authorization: Bearer <tu-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "gasThresholdPpm": 500,
    "voltageThreshold": 2.5,
    "buzzerEnabled": true,
    "ledEnabled": true,
    "calibrationR0": 10.0
  }'
```

---

### 📊 Datos del Sensor (`/sensor-data`)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/sensor-data` | Recibir datos del ESP32 | ❌ |
| GET | `/sensor-data/command/:deviceKey` | ESP32 obtiene comandos | ❌ |
| GET | `/sensor-data/config/:deviceKey` | ESP32 obtiene configuración | ❌ |

**Ejemplo - Enviar Datos (desde ESP32):**
```bash
curl -X POST http://localhost:3000/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
    "deviceKey": "00d6644c-3785-4a2d-ae71-1ec6c81b1a9a",
    "rawValue": 1500,
    "voltage": 1.8,
    "gasConcentrationPpm": 650,
    "rsRoRatio": 0.5
  }'
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Data received successfully",
  "thresholdPassed": true,
  "command": {
    "ledState": true,
    "buzzerState": true,
    "message": "Gas threshold exceeded!",
    "timestamp": "2025-12-05T22:34:21.000Z"
  }
}
```

---


### Configuración del Código

1. **Abrir Arduino IDE**
2. **Instalar librerías necesarias:**
   - WiFi (incluida en ESP32)
   - HTTPClient (incluida en ESP32)
   - ArduinoJson (v6.x)

3. **Configurar WiFi y Servidor:**
```cpp
const char* WIFI_SSID = "TuRedWiFi";
const char* WIFI_PASSWORD = "TuContraseña";
const char* SERVER_HOST = "192.168.1.100";  // IP de tu PC
const int SERVER_PORT = 3000;
const char* DEVICE_KEY = "tu-device-key-desde-backend";
```

### Logs del ESP32

```
========================================
  ESP32 - Monitor de Gas MQ2
  Comunicación HTTP
========================================
[WiFi] Conectando...
[WiFi] ✅ Conectado!
[WiFi] IP: 192.168.1.105

[HTTP] URLs configuradas:
  POST: http://192.168.1.100:3000/sensor-data
  GET:  http://192.168.1.100:3000/sensor-data/command/00d6644c...
  GET:  http://192.168.1.100:3000/sensor-data/config/00d6644c...

========== LECTURA DEL SENSOR ==========
Raw ADC: 1500
Voltage: 1.800 V
Rs: 5.50 kΩ
Rs/R0: 0.550
Gas: 650.25 PPM
========================================
[HTTP] ✅ Respuesta del servidor (200)
[COMMAND] LED: ON, Buzzer: ON
[ALERT] Gas threshold exceeded!
```

---

## 🚨 Flujo de Alertas

### 1. Detección de Gas Alto

```typescript
// ESP32 envía lectura
POST /sensor-data
{
  "deviceKey": "...",
  "gasConcentrationPpm": 1108.06  // > 300 (umbral)
}
```

### 2. Backend Procesa

```typescript
// sensor-data.service.ts
async processSensorReading(data) {
  // 1. Verificar dispositivo
  const device = await prisma.device.findUnique(...)
  
  // 2. Verificar umbral
  const thresholdPassed = data.gasConcentrationPpm > settings.gasThresholdPpm
  
  // 3. Guardar lectura
  await prisma.sensorData.create(...)
  
  // 4. Si se superó el umbral
  if (thresholdPassed && settings.notifyUser) {
    await createAlertAndNotification(device, data)
  }
}
```

### 3. Crear Alerta y Notificación

```typescript
async createAlertAndNotification(device, data) {
  // Verificar cooldown (1 minuto)
  const recentAlert = await prisma.alert.findFirst({
    where: {
      deviceId: device.id,
      resolved: false,
      createdAt: { gte: new Date(Date.now() - 1 * 60 * 1000) }
    }
  })
  
  if (recentAlert) {
    // Cooldown activo - no crear alerta duplicada
    return
  }
  
  // Determinar severidad
  const severity = determineSeverity(data.gasConcentrationPpm)
  // < 400: LOW, 400-599: MEDIUM, 600-999: HIGH, >= 1000: CRITICAL
  
  // Crear alerta
  const alert = await prisma.alert.create({
    data: {
      deviceId: device.id,
      alertType: 'GAS_DETECTED',
      severity,
      message: `Gas detected: ${data.gasConcentrationPpm} PPM`,
      gasValuePpm: data.gasConcentrationPpm
    }
  })
  
  // Crear notificación
  await prisma.notification.create({
    data: {
      userId: device.userId,
      alertId: alert.id,
      title: `⚠️ Gas Alert - ${device.name}`,
      message: `Gas concentration of ${data.gasConcentrationPpm} PPM detected`,
      type: 'ALERT'
    }
  })
}
```

### 4. Enviar Comando al ESP32

```typescript
// sensor-data.controller.ts
if (result.thresholdPassed) {
  this.pendingCommands.set(data.deviceKey, {
    ledState: true,
    buzzerState: true,
    message: 'Gas threshold exceeded!'
  })
}

return {
  success: true,
  thresholdPassed: true,
  command: { ledState: true, buzzerState: true }
}
```

### 5. ESP32 Activa LED/Buzzer

```cpp
// gas_monitor_http.ino
if (responseDoc.containsKey("command")) {
  JsonObject command = responseDoc["command"];
  bool ledState = command["ledState"];
  bool buzzerState = command["buzzerState"];
  
  digitalWrite(LED_PIN, ledState ? HIGH : LOW);
  digitalWrite(BUZZER_PIN, buzzerState ? HIGH : LOW);
}
```

---

## 📜 Scripts Disponibles

```bash
# Desarrollo
npm run start:dev          # Inicia servidor en modo watch
npm run start:debug        # Inicia con debugger

# Producción
npm run build              # Compila TypeScript
npm run start:prod         # Inicia servidor compilado

# Base de Datos
npx prisma generate        # Genera cliente Prisma
npx prisma migrate dev     # Ejecuta migraciones
npx prisma studio          # Abre interfaz visual de BD
npx prisma db seed         # Ejecuta seeds (si existen)

# Testing
npm run test               # Tests unitarios
npm run test:watch         # Tests en modo watch
npm run test:cov           # Cobertura de tests
npm run test:e2e           # Tests end-to-end

# Calidad de Código
npm run lint               # ESLint
npm run format             # Prettier
```

---

## 📚 Documentación API

### Swagger UI

Una vez iniciado el servidor, accede a la documentación interactiva:

```
http://localhost:3000/api/docs
```

Características de Swagger:
- ✅ Todos los endpoints documentados
- ✅ Ejemplos de request/response
- ✅ Probar endpoints directamente
- ✅ Autenticación JWT integrada

### Autenticación en Swagger

1. Hacer login en `/auth/login`
2. Copiar el `accessToken` de la respuesta
3. Clic en el botón **"Authorize"** (🔒)
4. Pegar el token en el campo
5. Ahora puedes probar endpoints protegidos

---

## 📁 Estructura del Proyecto

```
backend/
├── src/
│   ├── auth/                    # Módulo de autenticación
│   │   ├── decorators/          # Decoradores personalizados
│   │   ├── dto/                 # DTOs de auth
│   │   ├── guards/              # Guards JWT
│   │   ├── strategies/          # Estrategias Passport
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   └── auth.module.ts
│   │
│   ├── users/                   # Módulo de usuarios
│   │   ├── dto/
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── users.module.ts
│   │
│   ├── device/                  # Módulo de dispositivos
│   │   ├── dto/
│   │   ├── device.controller.ts
│   │   ├── device.service.ts
│   │   └── device.module.ts
│   │
│   ├── sensor-data/             # Módulo de datos del sensor
│   │   ├── dto/
│   │   ├── sensor-data.controller.ts
│   │   ├── sensor-data.service.ts
│   │   └── sensor-data.module.ts
│   │
│   ├── prisma/                  # Módulo de Prisma
│   │   ├── prisma.service.ts
│   │   └── prisma.module.ts
│   │
│   ├── app.module.ts            # Módulo principal
│   └── main.ts                  # Punto de entrada
│
├── prisma/
│   ├── schema.prisma            # Esquema de base de datos
│   └── migrations/              # Migraciones
│
├── esp32/
│   └── gas_monitor_http.ino     # Firmware ESP32
│
├── test/                        # Tests
├── .env                         # Variables de entorno
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🐛 Troubleshooting

### Problema: ESP32 no se conecta al WiFi

**Solución:**
```cpp
// Verifica las credenciales
const char* WIFI_SSID = "NombreExactoDeRed";
const char* WIFI_PASSWORD = "ContraseñaCorrecta";

// Verifica que el ESP32 esté en rango
// Verifica que la red sea 2.4GHz (ESP32 no soporta 5GHz)
```

### Problema: "Device with key X not found"

**Solución:**
1. Registra el dispositivo en el backend primero:
```bash
POST /device
```
2. Copia el `deviceKey` de la respuesta
3. Actualiza el firmware del ESP32 con ese `deviceKey`

### Problema: No se crean alertas

**Verificar:**
1. El umbral de gas en la configuración:
```bash
GET /device/:id/settings
```
2. Que `notifyUser` esté en `true`
3. Que no haya cooldown activo (esperar 1 minuto)

### Problema: "Alert cooldown active"

**Esto es normal**. El sistema tiene un cooldown de 1 minuto para evitar spam de notificaciones. Si quieres cambiarlo:

```typescript
// src/sensor-data/sensor-data.service.ts (línea 109)
gte: new Date(Date.now() - 1 * 60 * 1000), // Cambiar a 30 segundos: 0.5 * 60 * 1000
```

### Problema: Lecturas del sensor incorrectas

**Solución:**
1. Calibrar el sensor (dejar 24h en aire limpio)
2. Calcular R0 correcto
3. Actualizar en la configuración:
```bash
PATCH /device/:id/settings
{
  "calibrationR0": 12.5  // Tu valor calculado
}
```

### Problema: Error de conexión a PostgreSQL

**Verificar:**
1. PostgreSQL está corriendo:
```bash
sudo systemctl status postgresql
```
2. Credenciales correctas en `.env`
3. Base de datos existe:
```bash
psql -U usuario -d nombre_db
```

---

## 📊 Monitoreo y Logs

### Ver logs del backend en tiempo real
```bash
npm run start:dev
```

### Ver datos en Prisma Studio
```bash
npx prisma studio
# Abre http://localhost:5555
```

### Logs importantes del ESP32
- `[WiFi] ✅ Conectado!` - WiFi OK
- `[HTTP] ✅ Respuesta del servidor (200)` - Comunicación OK
- `[ALERT] Gas threshold exceeded!` - Alerta detectada
- `[COMMAND] LED: ON, Buzzer: ON` - Actuadores activados

---

## 🔒 Seguridad

- ✅ Contraseñas hasheadas con bcrypt (10 rounds)
- ✅ JWT con expiración configurable
- ✅ Refresh tokens para renovación segura
- ✅ Validación de DTOs con class-validator
- ✅ Guards para protección de rutas
- ✅ CORS habilitado para ESP32
- ✅ Variables sensibles en `.env` (gitignored)

---

## 📈 Próximas Mejoras

- [ ] Dashboard web con gráficas
- [ ] Notificaciones push

---

## 📄 Licencia

Este proyecto es de código abierto y está disponible bajo la licencia MIT.

---

## 🙏 Agradecimientos

- NestJS Team por el increíble framework
- Prisma Team por el maravillosoORM
- Espressif por el ESP32
- Comunidad de Arduino

---

<p align="center">
  Hecho con ❤️ y ☕
</p>
