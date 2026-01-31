import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SensorReadingDto } from './dto/sensor-reading.dto';
import { AlertType, AlertSeverity, NotificationType } from '@prisma/client';
import { SendNotificationUseCase } from '../notifications/application/send-notification.use-case';

@Injectable()
export class SensorDataService {
    private readonly logger = new Logger(SensorDataService.name);

    constructor(
        private prisma: PrismaService,
        private sendNotificationUseCase: SendNotificationUseCase
    ) { }

    /**
     * Procesa y almacena una lectura del sensor
     */
    async processSensorReading(data: SensorReadingDto) {
        try {
            // 1. Verificar que el dispositivo existe
            const device = await this.prisma.device.findUnique({
                where: { deviceKey: data.deviceKey },
                include: {
                    deviceSettings: true,
                    user: true
                },
            });

            if (!device) {
                throw new NotFoundException(`Device with key ${data.deviceKey} not found`);
            }

            // 2. Actualizar el estado del dispositivo a ONLINE
            await this.prisma.device.update({
                where: { id: device.id },
                data: {
                    status: 'ONLINE',
                    lastSeen: new Date()
                },
            });

            // 3. Verificar si se superó el umbral
            const settings = device.deviceSettings;
            const thresholdPassed = this.checkThreshold(data, settings);

            // 4. Guardar la lectura del sensor
            const sensorData = await this.prisma.sensorData.create({
                data: {
                    deviceId: device.id,
                    rawValue: data.rawValue,
                    voltage: data.voltage,
                    gasConcentrationPpm: data.gasConcentrationPpm,
                    rsRoRatio: data.rsRoRatio,
                    temperature: data.temperature,
                    humidity: data.humidity,
                    thresholdPassed,
                },
            });

            // 5. Si se superó el umbral, crear alerta y notificación
            if (thresholdPassed && settings?.notifyUser) {
                await this.createAlertAndNotification(device, data);
            }

            this.logger.log(
                `Sensor data saved for device ${device.name} (ID: ${device.id}): ` +
                `Raw=${data.rawValue}, Gas=${data.gasConcentrationPpm?.toFixed(2)} PPM, ` +
                `Threshold=${thresholdPassed ? 'EXCEEDED' : 'OK'}`
            );

            return {
                success: true,
                data: sensorData,
                thresholdPassed,
                shouldActivateBuzzer: thresholdPassed && settings?.buzzerEnabled,
                shouldActivateLed: thresholdPassed && settings?.ledEnabled,
            };
        } catch (error) {
            this.logger.error(`Error processing sensor reading: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Verifica si se superó el umbral configurado
     */
    private checkThreshold(data: SensorReadingDto, settings: any): boolean {
        if (!settings) return false;

        const gasThresholdExceeded =
            data.gasConcentrationPpm &&
            data.gasConcentrationPpm > settings.gasThresholdPpm;

        const voltageThresholdExceeded =
            data.voltage &&
            data.voltage > settings.voltageThreshold;

        return !!(gasThresholdExceeded || voltageThresholdExceeded);
    }

    /**
     * Crea una alerta y notificación cuando se supera el umbral
     */
    private async createAlertAndNotification(device: any, data: SensorReadingDto) {
        try {
            // Verificar si ya existe una alerta activa reciente (últimos 5 minutos)
            const recentAlert = await this.prisma.alert.findFirst({
                where: {
                    deviceId: device.id,
                    resolved: false,
                    createdAt: {
                        gte: new Date(Date.now() - 1 * 60 * 1000), // 1 minutos
                    },
                },
            });

            // Si ya existe una alerta reciente, no crear otra (cooldown)
            if (recentAlert) {
                this.logger.debug(`Alert cooldown active for device ${device.id}`);
                return;
            }

            // Determinar severidad basada en el nivel de gas
            const severity = this.determineSeverity(data.gasConcentrationPpm);

            // Crear la alerta
            const alert = await this.prisma.alert.create({
                data: {
                    deviceId: device.id,
                    alertType: AlertType.GAS_DETECTED,
                    severity,
                    message: `Gas detected: ${data.gasConcentrationPpm?.toFixed(2)} PPM`,
                    gasValuePpm: data.gasConcentrationPpm,
                    voltageValue: data.voltage,
                    resolved: false,
                },
            });

            // Crear notificación para el usuario
            const severityText = this.getSeverityText(severity);
            const notification = await this.prisma.notification.create({
                data: {
                    userId: device.userId,
                    alertId: alert.id,
                    title: `Alerta de Gas - ${severityText} - ${device.name}`,
                    message: `Gas: ${data.gasConcentrationPpm?.toFixed(2)} PPM` +
                        (data.temperature ? ` | Temp: ${data.temperature.toFixed(1)}°C` : '') +
                        (data.humidity ? ` | Hum: ${data.humidity.toFixed(1)}%` : ''),
                    type: NotificationType.ALERT,
                    read: false,
                    sent: true,
                },
            });

            // Enviar notificación push al dispositivo del usuario
            try {
                const notificationBody = `Gas: ${data.gasConcentrationPpm?.toFixed(2)} PPM` +
                    (data.temperature ? ` | Temp: ${data.temperature.toFixed(1)}°C` : '') +
                    (data.humidity ? ` | Humidity: ${data.humidity.toFixed(1)}%` : '');

                await this.sendNotificationUseCase.execute(
                    device.userId,
                    `Alerta de Gas - ${severityText} - ${device.name}`,
                    notificationBody,
                    {
                        deviceId: device.id.toString(),
                        alertId: alert.id.toString(),
                        gasLevel: data.gasConcentrationPpm?.toFixed(2) || '0',
                        severity: severity,
                    }
                );
                this.logger.log(`Push notification sent to user ${device.userId} for alert ${alert.id}`);
            } catch (error) {
                this.logger.error(`Failed to send push notification: ${error.message}`);
                // No lanzar error, la alerta ya fue creada en BD
            }

            this.logger.warn(
                `ALERT CREATED: Device ${device.name} - Gas ${data.gasConcentrationPpm?.toFixed(2)} PPM - Severity: ${severity}`
            );
        } catch (error) {
            this.logger.error(`Error creating alert: ${error.message}`, error.stack);
        }
    }

    /**
     * Determina la severidad de la alerta basada en la concentración de gas
     * Umbrales basados en estándares de seguridad para gases combustibles:
     * - BAJO: 50-150 PPM (Detección temprana)
     * - MEDIO: 150-300 PPM (Precaución)
     * - ALTO: 300-500 PPM (Peligro)
     * - CRÍTICO: >500 PPM (Evacuación inmediata)
     */
    private determineSeverity(gasPpm?: number): AlertSeverity {
        if (!gasPpm) return AlertSeverity.LOW;

        if (gasPpm >= 500) return AlertSeverity.CRITICAL;
        if (gasPpm >= 300) return AlertSeverity.HIGH;
        if (gasPpm >= 150) return AlertSeverity.MEDIUM;
        return AlertSeverity.LOW;
    }

    /**
     * Obtiene el texto descriptivo de la severidad con icono visual
     */
    private getSeverityText(severity: AlertSeverity): string {
        switch (severity) {
            case AlertSeverity.CRITICAL:
                return '🔴 Nivel Crítico';
            case AlertSeverity.HIGH:
                return '🟠 Nivel Alto';
            case AlertSeverity.MEDIUM:
                return '🟡 Nivel Medio';
            case AlertSeverity.LOW:
            default:
                return '🟢 Nivel Bajo';
        }
    }

    /**
     * Obtiene las últimas lecturas de un dispositivo
     */
    async getLatestReadings(deviceId: number, limit: number = 50) {
        try {
            return await this.prisma.sensorData.findMany({
                where: { deviceId },
                orderBy: { createdAt: 'desc' },
                take: limit,
            });
        } catch (error) {
            this.logger.error(`Error fetching latest readings: ${error.message}`);
            throw error;
        }
    }

    /**
     * Obtiene estadísticas de un dispositivo
     */
    async getDeviceStats(deviceId: number, hours: number = 24) {
        try {
            const since = new Date(Date.now() - hours * 60 * 60 * 1000);

            const readings = await this.prisma.sensorData.findMany({
                where: {
                    deviceId,
                    createdAt: { gte: since },
                },
                orderBy: { createdAt: 'asc' },
            });

            if (readings.length === 0) {
                return {
                    count: 0,
                    avgGas: 0,
                    maxGas: 0,
                    minGas: 0,
                    thresholdExceeded: 0,
                };
            }

            const gasValues = readings
                .map(r => r.gasConcentrationPpm)
                .filter(v => v !== null) as number[];

            return {
                count: readings.length,
                avgGas: gasValues.reduce((a, b) => a + b, 0) / gasValues.length,
                maxGas: Math.max(...gasValues),
                minGas: Math.min(...gasValues),
                thresholdExceeded: readings.filter(r => r.thresholdPassed).length,
            };
        } catch (error) {
            this.logger.error(`Error fetching device stats: ${error.message}`);
            throw error;
        }
    }
}
