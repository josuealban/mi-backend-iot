# 🖥️ Sistema IoT MQ2 Piensa — Backend API + ESP32 Firmware

Backend del sistema de monitoreo de gases IoT. API REST construida con **NestJS** + **Prisma** + **PostgreSQL**, con comunicación en tiempo real vía **WebSocket (Socket.IO)** y notificaciones push con **Firebase Cloud Messaging (FCM)**. Incluye el firmware del **ESP32** para los sensores MQ.

---

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Arquitectura](#-arquitectura)
- [Stack Tecnológico](#-stack-tecnológico)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
  - [Windows](#windows)
  - [Linux](#linux)
- [Configuración](#-configuración)
- [Base de Datos](#-base-de-datos)
- [Ejecución](#-ejecución)
- [API Endpoints](#-api-endpoints)
- [WebSocket Gateway](#-websocket-gateway)
- [ESP32 Firmware](#-esp32-firmware)

---

## ✨ Características

- 🔑 **Autenticación JWT** con access token + refresh token
- 📡 **WebSocket (Socket.IO)** para streaming de datos de sensores en tiempo real
- 🔔 **Push Notifications** (Firebase Cloud Messaging) con severidad por niveles
- 📊 **Gestión de dispositivos** con deviceKey único (UUID)
- ⚠️ **Sistema de alertas** con 4 niveles de severidad (LOW, MEDIUM, HIGH, CRITICAL)
- 🎛️ **Control remoto de actuadores** (ventilador + servo ventana)
- 📐 **Calibración remota** de sensores vía WebSocket
- 🔄 **Auto-calibración de umbrales** basada en el ambiente
- 📖 **Swagger/OpenAPI** — documentación interactiva en `/api/docs`
- 🐳 **Docker ready** para despliegue en producción

---

## 🏗️ Arquitectura

```
┌──────────────┐         ┌──────────────────────────────────────┐
│   ESP32      │         │            Backend (NestJS)          │
│  ┌─────────┐ │  HTTP   │  ┌────────────┐  ┌───────────────┐  │
│  │ MQ2-MQ9 │─┼────────▶│  │ SensorData │  │ Notifications │  │
│  │ DHT11   │ │  Alert  │  │ Controller │  │   Service     │  │
│  │ Relé    │ │         │  └────────────┘  └───────┬───────┘  │
│  │ Servo   │ │  WS     │  ┌────────────┐          │          │
│  └─────────┘─┼────────▶│  │  Sensor    │    ┌─────▼─────┐   │   ┌──────────┐
│              │         │  │  Gateway   │    │ Firebase  │   │   │ IoTFront │
│              │◀────────┼──│ (Socket.IO)│    │   FCM     │───┼──▶│  (App)   │
│              │ Commands│  └────────────┘    └───────────┘   │   └──────────┘
└──────────────┘         │  ┌────────────┐  ┌─────────────┐   │
                         │  │   Auth     │  │   Prisma    │   │
                         │  │  Module    │  │  (ORM)      │   │
                         │  └────────────┘  └──────┬──────┘   │
                         │                         │          │
                         └─────────────────────────┼──────────┘
                                                   │
                                            ┌──────▼──────┐
                                            │ PostgreSQL  │
                                            │  Database   │
                                            └─────────────┘
```

---

## 🛠️ Stack Tecnológico

| Tecnología | Versión | Uso |
|---|---|---|
| NestJS | 11.x | Framework backend |
| TypeScript | 5.7.x | Tipado estático |
| Prisma | 7.x | ORM + Migraciones |
| PostgreSQL | 15+ | Base de datos |
| Socket.IO | 4.8.x | WebSocket en tiempo real |
| Firebase Admin | 13.x | Push notifications (FCM) |
| Passport JWT | 4.x | Autenticación |
| Swagger | 11.x | Documentación API |
| bcryptjs | 3.x | Hash de contraseñas |
| Arduino (C++) | — | Firmware ESP32 |

---

## 📂 Estructura del Proyecto

```
backend/
├── src/
│   ├── auth/                        # Módulo de autenticación
│   │   ├── auth.controller.ts       # Endpoints: login, register, refresh
│   │   ├── auth.service.ts          # Lógica de autenticación + JWT
│   │   ├── auth.module.ts           # Configuración del módulo
│   │   ├── dto/                     # Data Transfer Objects
│   │   │   ├── login.dto.ts
│   │   │   ├── register.dto.ts
│   │   │   └── refresh-token.dto.ts
│   │   ├── guards/
│   │   │   └── jwt-auth.guard.ts    # Guard de autenticación JWT
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts      # Passport JWT strategy
│   │   └── interfaces/
│   │       └── jwt-payload.interface.ts
│   ├── users/                       # Módulo de usuarios
│   │   ├── users.controller.ts      # CRUD de usuarios
│   │   ├── users.service.ts         # Lógica de usuarios
│   │   └── dto/
│   ├── device/                      # Módulo de dispositivos
│   │   ├── device.controller.ts     # CRUD de dispositivos + settings
│   │   ├── device.service.ts        # Lógica de dispositivos
│   │   └── dto/
│   ├── sensor-data/                 # Módulo de datos de sensores
│   │   ├── sensor-data.controller.ts # Alertas, config, actuadores
│   │   ├── sensor-data.service.ts   # Lógica de sensores + alertas
│   │   ├── sensor.gateway.ts        # WebSocket Gateway (Socket.IO)
│   │   └── dto/
│   ├── notifications/               # Módulo de notificaciones
│   │   ├── notifications.controller.ts  # CRUD notificaciones
│   │   ├── notifications.service.ts     # Servicio base
│   │   ├── application/
│   │   │   ├── notification-creator.service.ts   # Crear notificaciones + FCM
│   │   │   └── notification-query.service.ts     # Consultas
│   │   ├── infrastructure/
│   │   │   └── firebase-messaging.service.ts     # Firebase Admin SDK
│   │   └── domain/
│   │       └── notification-severity.ts          # Lógica de severidad
│   ├── prisma/
│   │   ├── prisma.module.ts         # Módulo Prisma
│   │   └── prisma.service.ts        # Servicio de conexión a DB
│   ├── app.module.ts                # Módulo raíz
│   └── main.ts                      # Bootstrap de la aplicación
├── prisma/
│   ├── schema.prisma                # Esquema de base de datos
│   └── migrations/                  # Migraciones de DB
├── esp32/                           # Firmware del microcontrolador
│   ├── gas_monitor_http.ino         # Código Arduino del ESP32
│   └── README.md                    # Documentación del hardware
├── .env                             # Variables de entorno (NO se sube)
├── .gitignore
├── package.json
├── tsconfig.json
├── nest-cli.json
└── Dockerfile                       # (si existe) Para despliegue
```

---

## 📌 Requisitos Previos

- **Node.js** >= 18.x
- **npm** >= 9.x (o pnpm)
- **Git**
- **PostgreSQL** >= 15 (local o remoto)
- **Firebase Project** con credenciales de Admin SDK (para push notifications)

### Para el ESP32

- **Arduino IDE** >= 2.x o **PlatformIO**
- **ESP32 DevKit** v1
- Sensores: MQ2, MQ3, MQ5, MQ9, DHT11
- Actuadores: Relé 5V, Servo MG996R
- LED, Buzzer

---

## 🚀 Instalación

### Windows

```powershell
# 1. Clonar el repositorio
git clone https://github.com/Guasmo/sistemaIoTmq2Piensa.git
cd sistemaIoTmq2Piensa

# 2. Instalar dependencias
npm install

# 3. Crear archivo de variables de entorno
copy NUL .env
# Luego editar con VS Code o notepad (ver sección Configuración)

# 4. Generar el cliente Prisma
npx prisma generate

# 5. Aplicar migraciones a la base de datos
npx prisma migrate deploy

# 6. (Opcional) Ver la base de datos con Prisma Studio
npx prisma studio
```

### Linux

```bash
# 1. Clonar el repositorio
git clone https://github.com/Guasmo/sistemaIoTmq2Piensa.git
cd sistemaIoTmq2Piensa

# 2. Instalar dependencias
npm install

# 3. Crear archivo de variables de entorno
touch .env
# Luego editar (ver sección Configuración)
nano .env

# 4. Generar el cliente Prisma
npx prisma generate

# 5. Aplicar migraciones a la base de datos
npx prisma migrate deploy

# 6. (Opcional) Ver la base de datos con Prisma Studio
npx prisma studio
```

---

## ⚙️ Configuración

### Variables de Entorno (`.env`)

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```env
# ==========================================
# BASE DE DATOS
# ==========================================
DATABASE_URL="postgresql://usuario:password@localhost:5432/iot_database?schema=public"

# ==========================================
# AUTENTICACIÓN JWT
# ==========================================
JWT_SECRET="tu_clave_secreta_jwt_muy_segura"
JWT_EXPIRES_IN="1h"
JWT_REFRESH_SECRET="tu_clave_secreta_refresh_muy_segura"
JWT_REFRESH_EXPIRES_IN="7d"

# ==========================================
# SERVIDOR
# ==========================================
PORT=3000
NODE_ENV=development

# ==========================================
# FIREBASE (Push Notifications)
# ==========================================

FIREBASE_CREDENTIALS_BASE64="examplebase64data"

```

### Firebase Setup

1. Ir a [Firebase Console](https://console.firebase.google.com/) → Tu proyecto
2. **Project Settings** → **Service accounts** → **Generate new private key**
3. Del JSON descargado, extraer los valores de `project_id`, `client_email` y `private_key`
4. Colocarlos en las variables `FIREBASE_*` del `.env`

> ⚠️ **IMPORTANTE**: Nunca subas el archivo de credenciales Firebase ni el `.env` a git.

---

## 🗄️ Base de Datos

### Esquema (Modelos principales)

| Modelo | Descripción |
|---|---|
| `User` | Usuarios del sistema (username, email, password hash, device token FCM) |
| `Device` | Dispositivos IoT (nombre, deviceKey UUID, estado, ubicación, estado de actuadores) |
| `DeviceSettings` | Configuración por dispositivo (umbrales MQ, R0 calibración, buzzer, LED, etc.) |
| `Alert` | Alertas de gas (tipo, severidad, PPM, voltaje, estado de resolución) |
| `Notification` | Notificaciones al usuario (título, mensaje, tipo, leída/no leída) |

### Enums

| Enum | Valores |
|---|---|
| `DeviceStatus` | ONLINE, OFFLINE, MAINTENANCE |
| `AlertType` | GAS_DETECTED, SENSOR_ERROR, OFFLINE, MAINTENANCE_REQUIRED |
| `AlertSeverity` | LOW, MEDIUM, HIGH, CRITICAL |
| `GasType` | LPG, METHANE, ALCOHOL, CO, SMOKE, UNKNOWN |
| `NotificationType` | ALERT, INFO, WARNING, SUCCESS |

### Comandos útiles de Prisma

```bash
# Generar cliente (después de cambios en schema)
npx prisma generate

# Crear nueva migración
npx prisma migrate dev --name nombre_migracion

# Aplicar migraciones pendientes (producción)
npx prisma migrate deploy

# Abrir Prisma Studio (GUI de la DB)
npx prisma studio

# Reset completo de la DB (¡CUIDADO! Borra todo)
npx prisma migrate reset
```

---

## ▶️ Ejecución

```bash
# Desarrollo (hot reload)
npm run start:dev

# Producción
npm run build
npm run start:prod

# Debug mode
npm run start:debug
```

El servidor arrancará en `http://localhost:3000` (o el puerto configurado).

### Swagger (Documentación API)

Una vez corriendo, accede a la documentación interactiva en:

```
http://localhost:3000/api/docs
```

---

## 📡 API Endpoints

### Auth (`/auth`)

| Método | Endpoint | Descripción | Auth |
|---|---|---|---|
| POST | `/auth/register` | Registrar usuario | ❌ |
| POST | `/auth/login` | Iniciar sesión | ❌ |
| POST | `/auth/refresh` | Refrescar access token | ❌ |
| GET | `/auth/check-status` | Verificar sesión | ✅ |

### Users (`/users`)

| Método | Endpoint | Descripción | Auth |
|---|---|---|---|
| GET | `/users` | Listar usuarios | ✅ |
| GET | `/users/:id` | Obtener usuario por ID | ✅ |
| PATCH | `/users/:id` | Actualizar perfil | ✅ |
| PATCH | `/users/:id/deactivate` | Desactivar usuario | ✅ |

### Devices (`/device`)

| Método | Endpoint | Descripción | Auth |
|---|---|---|---|
| GET | `/device` | Listar dispositivos del usuario | ✅ |
| POST | `/device` | Crear dispositivo (genera deviceKey) | ✅ |
| GET | `/device/:id` | Obtener dispositivo con sensores y alertas | ✅ |
| PATCH | `/device/:id` | Actualizar dispositivo | ✅ |
| PATCH | `/device/:id/settings` | Actualizar configuración | ✅ |

### Sensor Data (`/sensor-data`)

| Método | Endpoint | Descripción | Auth |
|---|---|---|---|
| POST | `/sensor-data/alert` | ESP32 envía alerta de gas | ❌* |
| GET | `/sensor-data/config/:deviceKey` | Obtener configuración del dispositivo | ❌* |
| PATCH | `/sensor-data/config/:deviceKey` | Actualizar calibración R0 + umbrales | ❌* |
| POST | `/sensor-data/actuator` | Control manual de actuador | ✅ |
| POST | `/sensor-data/calibrate` | Solicitar calibración remota | ✅ |
| PATCH | `/sensor-data/alerts/:id/resolve` | Resolver alerta | ✅ |

> *Estos endpoints son usados por el ESP32 y se autentican por `deviceKey`.

### Notifications (`/notifications`)

| Método | Endpoint | Descripción | Auth |
|---|---|---|---|
| GET | `/notifications` | Listar notificaciones del usuario | ✅ |
| GET | `/notifications/unread` | Notificaciones no leídas | ✅ |
| PATCH | `/notifications/:id/read` | Marcar como leída | ✅ |
| PATCH | `/notifications/read-all` | Marcar todas como leídas | ✅ |
| POST | `/notifications/register-token` | Registrar token FCM | ✅ |

---

## 🔌 WebSocket Gateway

El backend usa **Socket.IO** en el mismo puerto del servidor HTTP.

### Eventos del Cliente → Servidor

| Evento | Payload | Descripción |
|---|---|---|
| `register` | `{ deviceKey: string }` | ESP32 se registra con su clave |
| `subscribe` | `{ deviceKey: string }` | App se suscribe a un dispositivo |
| `unsubscribe` | `{ deviceKey: string }` | App se desuscribe |
| `sensorData` | `{ deviceKey, mq2, mq3, mq5, mq9, temperature, humidity }` | ESP32 envía datos |

### Eventos del Servidor → Cliente

| Evento | Payload | Descripción |
|---|---|---|
| `sensorUpdate` | `{ deviceKey, mq2, mq3, mq5, mq9, temperature, humidity }` | Datos retransmitidos a la app |
| `actuatorCommand` | `{ actuator: 'window'|'fan', status: boolean }` | Comando al ESP32 |
| `calibrate` | `{}` | Orden de calibración al ESP32 |

---

## 🔧 ESP32 Firmware

El firmware se encuentra en `esp32/gas_monitor_http.ino`.

### Hardware necesario

| Componente | Pin ESP32 | Descripción |
|---|---|---|
| MQ2 | GPIO 34 | Sensor LPG / Humo |
| MQ3 | GPIO 35 | Sensor Alcohol |
| MQ5 | GPIO 32 | Sensor Metano |
| MQ9 | GPIO 33 | Sensor CO |
| DHT11 | GPIO 25 | Temperatura y humedad |
| Relé (Ventilador) | GPIO 27 | Control ON/OFF (lógica invertida) |
| Servo MG996R | GPIO 26 | Simulación de ventana |
| LED | GPIO 2 | Indicador visual |
| Buzzer | GPIO 4 | Alarma sonora |

### Configuración del Firmware

Antes de subir el código al ESP32, editar estas líneas en `gas_monitor_http.ino`:

```cpp
// Red WiFi
const char* WIFI_SSID = "TU_RED_WIFI";
const char* WIFI_PASSWORD = "TU_CONTRASEÑA_WIFI";

// Servidor backend
const char* SERVER_HOSTNAME = "TU_IP_O_DOMINIO";
const int SERVER_PORT = 3000;
const char* BASE_URL = "http://TU_IP_O_DOMINIO:3000";

// Clave del dispositivo (generada al crear el dispositivo en la app)
const char* DEVICE_KEY = "tu-device-key-uuid";
```

### Librerías Arduino necesarias

Instalar desde el **Library Manager** de Arduino IDE:

| Librería | Uso |
|---|---|
| `WiFi` | Conexión WiFi (incluida con ESP32) |
| `HTTPClient` | Peticiones HTTP |
| `ArduinoJson` | Serialización JSON |
| `DHT sensor library` | Lectura DHT11 |
| `WebSockets` (by Links2004) | Socket.IO client |
| `ESP32Servo` | Control de servomotores |

### Subir el firmware

1. Abrir `esp32/gas_monitor_http.ino` en Arduino IDE
2. Seleccionar **Board**: `ESP32 Dev Module`
3. Seleccionar el **Puerto** COM correcto
4. Configurar las variables (WiFi, Server, Device Key)
5. **Upload** (→)

### Flujo del ESP32

```
Encendido → Conexión WiFi → Calibración auto (10s)
     ↓
Cálculo de R0 + Umbrales automáticos
     ↓
Conexión WebSocket → Registro con deviceKey
     ↓
Loop cada 2s:
  ├── Leer sensores MQ2, MQ3, MQ5, MQ9, DHT11
  ├── Enviar datos por WebSocket (instantáneo)
  ├── Evaluar umbrales → Activar actuadores si peligro
  ├── Enviar alerta HTTP si supera umbral (con cooldown 15s)
  └── Buzzer según severidad
```

---

## 🚀 Despliegue en Producción

### Con Docker

```bash
# Build de la imagen
docker build -t iot-backend .

# Ejecutar el contenedor
docker run -d \
  --name iot-backend \
  -p 3000:3000 \
  --env-file .env \
  iot-backend
```

### Con Railway / Render

1. Conectar el repositorio de GitHub
2. Configurar las variables de entorno en el dashboard
3. El build command es: `npm run build`
4. El start command es: `npm run start:prod`
5. Agregar un servicio PostgreSQL y configurar `DATABASE_URL`

### Variables de entorno para producción

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=clave_super_segura_produccion
JWT_REFRESH_SECRET=otra_clave_segura_produccion
PORT=3000
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
```

---

## 🧪 Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Cobertura
npm run test:cov
```

---

## 📄 Licencia

Este proyecto es parte de un trabajo de grado. Uso educativo.
