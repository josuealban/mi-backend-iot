-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('GAS_DETECTED', 'SENSOR_ERROR', 'OFFLINE', 'MAINTENANCE_REQUIRED');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ALERT', 'INFO', 'WARNING', 'SUCCESS');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "device_key" VARCHAR(255) NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'OFFLINE',
    "location" VARCHAR(255),
    "last_seen" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sensor_data" (
    "id" SERIAL NOT NULL,
    "device_id" INTEGER NOT NULL,
    "raw_value" INTEGER NOT NULL,
    "voltage" DOUBLE PRECISION,
    "gas_concentration_ppm" DOUBLE PRECISION,
    "rs_ro_ratio" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "threshold_passed" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensor_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_settings" (
    "id" SERIAL NOT NULL,
    "device_id" INTEGER NOT NULL,
    "gas_threshold_ppm" DOUBLE PRECISION NOT NULL DEFAULT 300.0,
    "voltage_threshold" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "buzzer_enabled" BOOLEAN NOT NULL DEFAULT true,
    "led_enabled" BOOLEAN NOT NULL DEFAULT true,
    "notify_user" BOOLEAN NOT NULL DEFAULT true,
    "notification_cooldown" INTEGER NOT NULL DEFAULT 300,
    "auto_shutoff" BOOLEAN NOT NULL DEFAULT false,
    "calibration_r0" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "device_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" SERIAL NOT NULL,
    "device_id" INTEGER NOT NULL,
    "alert_type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL DEFAULT 'MEDIUM',
    "message" VARCHAR(255) NOT NULL,
    "gas_value_ppm" DOUBLE PRECISION,
    "voltage_value" DOUBLE PRECISION,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolved_at" TIMESTAMP(3),
    "resolved_by" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "alert_id" INTEGER,
    "title" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL DEFAULT 'ALERT',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "sent" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_username" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "devices_device_key_key" ON "devices"("device_key");

-- CreateIndex
CREATE INDEX "idx_devices_user" ON "devices"("user_id");

-- CreateIndex
CREATE INDEX "idx_devices_key" ON "devices"("device_key");

-- CreateIndex
CREATE INDEX "idx_devices_status" ON "devices"("status");

-- CreateIndex
CREATE INDEX "idx_sensor_device" ON "sensor_data"("device_id");

-- CreateIndex
CREATE INDEX "idx_sensor_created" ON "sensor_data"("created_at");

-- CreateIndex
CREATE INDEX "idx_sensor_device_time" ON "sensor_data"("device_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_sensor_threshold" ON "sensor_data"("threshold_passed");

-- CreateIndex
CREATE UNIQUE INDEX "device_settings_device_id_key" ON "device_settings"("device_id");

-- CreateIndex
CREATE INDEX "idx_settings_device" ON "device_settings"("device_id");

-- CreateIndex
CREATE INDEX "idx_alerts_device" ON "alerts"("device_id");

-- CreateIndex
CREATE INDEX "idx_alerts_created" ON "alerts"("created_at");

-- CreateIndex
CREATE INDEX "idx_alerts_resolved" ON "alerts"("resolved");

-- CreateIndex
CREATE INDEX "idx_alerts_active" ON "alerts"("device_id", "resolved", "created_at");

-- CreateIndex
CREATE INDEX "idx_notif_user" ON "notifications"("user_id");

-- CreateIndex
CREATE INDEX "idx_notif_unread" ON "notifications"("user_id", "read");

-- CreateIndex
CREATE INDEX "idx_notif_created" ON "notifications"("created_at");

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sensor_data" ADD CONSTRAINT "sensor_data_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_settings" ADD CONSTRAINT "device_settings_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_alert_id_fkey" FOREIGN KEY ("alert_id") REFERENCES "alerts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
