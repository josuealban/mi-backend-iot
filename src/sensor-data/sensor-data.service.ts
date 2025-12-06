import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SensorReadingDto } from './dto/sensor-reading.dto';
import { AlertType, AlertSeverity, NotificationType } from '@prisma/client';

@Injectable()
export class SensorDataService {
    private readonly logger = new Logger(SensorDataService.name);

    constructor(private prisma: PrismaService) { }

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
            await this.prisma.notification.create({
                data: {
                    userId: device.userId,
                    alertId: alert.id,
                    title: `⚠️ Gas Alert - ${device.name}`,
                    message: `Gas concentration of ${data.gasConcentrationPpm?.toFixed(2)} PPM detected at ${device.location || 'unknown location'}`,
                    type: NotificationType.ALERT,
                    read: false,
                    sent: true,
                },
            });

            this.logger.warn(
                `ALERT CREATED: Device ${device.name} - Gas ${data.gasConcentrationPpm?.toFixed(2)} PPM - Severity: ${severity}`
            );
        } catch (error) {
            this.logger.error(`Error creating alert: ${error.message}`, error.stack);
        }
    }

    /**
     * Determina la severidad de la alerta basada en la concentración de gas
     */
    private determineSeverity(gasPpm?: number): AlertSeverity {
        if (!gasPpm) return AlertSeverity.LOW;

        if (gasPpm >= 1000) return AlertSeverity.CRITICAL;
        if (gasPpm >= 600) return AlertSeverity.HIGH;
        if (gasPpm >= 400) return AlertSeverity.MEDIUM;
        return AlertSeverity.LOW;
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
