import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GasAlertDto } from './dto/sensor-reading.dto';
import { AlertType, AlertSeverity, GasType, NotificationType } from '@prisma/client';
import { SendNotificationUseCase } from '../notifications/application/send-notification.use-case';
import { SensorGateway } from './sensor.gateway';

@Injectable()
export class SensorDataService {
    private readonly logger = new Logger(SensorDataService.name);

    constructor(
        private prisma: PrismaService,
        private sendNotificationUseCase: SendNotificationUseCase,
        private sensorGateway: SensorGateway
    ) { }

    /**
     * Procesa una alerta de gas detectado por un sensor MQ
     * No guarda datos en la DB, solo crea la alerta y notificación
     */
    async processGasAlert(data: GasAlertDto) {
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

            // 3. Determinar severidad y tipo de gas
            const settings = device.deviceSettings;
            const severity = this.determineSeverity(data.gasConcentrationPpm, settings, data.sensorSource);
            const gasType = this.mapGasType(data.gasType);
            const gasTypeLabel = this.getGasTypeLabel(gasType);

            // 4. Crear alerta y notificación
            if (settings?.notifyUser !== false) {
                await this.createAlertAndNotification(device, data, severity, gasType);
            }


            return {
                success: true,
                severity,
                gasType,
                shouldActivateBuzzer: settings?.buzzerEnabled ?? true,
                shouldActivateLed: settings?.ledEnabled ?? true,
            };
        } catch (error) {
            this.logger.error(`Error processing gas alert: ${error.message}`, error.stack);
            throw error;
        }
    }

    /**
     * Crea una alerta y notificación cuando se detecta gas
     */
    private async createAlertAndNotification(
        device: any,
        data: GasAlertDto,
        severity: AlertSeverity,
        gasType: GasType
    ) {
        try {
            // Cooldown de alertas eliminado para pruebas en tiempo real


            const gasTypeLabel = this.getGasTypeLabel(gasType);
            const severityText = this.getSeverityText(severity);

            // Crear la alerta
            const alert = await this.prisma.alert.create({
                data: {
                    deviceId: device.id,
                    alertType: AlertType.GAS_DETECTED,
                    severity,
                    gasType,
                    message: `${gasTypeLabel} detectado: ${data.gasConcentrationPpm?.toFixed(2)} PPM (Sensor: ${data.sensorSource})`,
                    gasValuePpm: data.gasConcentrationPpm,
                    voltageValue: data.voltage,
                    resolved: false,
                },
            });

            // La notificación se crea automáticamente dentro de sendNotificationUseCase.execute
            // para evitar duplicidad y asegurar que se registre tanto en envíos de alertas reales como de prueba.

            // Mapear color de severidad para Firebase
            const severityColors: Record<AlertSeverity, string> = {
                [AlertSeverity.CRITICAL]: '#ef4444', // Red 500
                [AlertSeverity.HIGH]: '#f97316',     // Orange 500
                [AlertSeverity.MEDIUM]: '#f59e0b',   // Yellow 500
                [AlertSeverity.LOW]: '#3b82f6',      // Blue 500
            };

            // Enviar notificación push al dispositivo del usuario
            try {
                const notificationBody = `${device.name}: ${data.gasConcentrationPpm?.toFixed(1)} PPM (${data.sensorSource})`;

                await this.sendNotificationUseCase.execute(
                    device.userId,
                    `${severityText}: ${gasTypeLabel}`,
                    notificationBody,
                    {
                        deviceId: device.id.toString(),
                        alertId: alert.id.toString(),
                        gasLevel: data.gasConcentrationPpm?.toFixed(1) || '0',
                        gasType: gasType,
                        sensorSource: data.sensorSource,
                        severity: severity,
                        resolved: 'false',
                        color: severityColors[severity],
                    }
                );
            } catch (error) {
                this.logger.error(`Failed to send push notification: ${error.message}`);
            }

        } catch (error) {
            this.logger.error(`Error creating alert: ${error.message}`, error.stack);
        }
    }

    /**
     * Mapea el string de gasType del ESP32 al enum GasType
     */
    private mapGasType(gasType: string): GasType {
        const mapping: Record<string, GasType> = {
            'LPG': GasType.LPG,
            'METHANE': GasType.METHANE,
            'ALCOHOL': GasType.ALCOHOL,
            'CO': GasType.CO,
            'SMOKE': GasType.SMOKE,
        };
        return mapping[gasType?.toUpperCase()] || GasType.UNKNOWN;
    }

    /**
     * Obtiene etiqueta descriptiva del tipo de gas
     */
    private getGasTypeLabel(gasType: GasType): string {
        switch (gasType) {
            case GasType.LPG:
                return 'Gas LPG/Propano';
            case GasType.METHANE:
                return 'Metano/Gas Natural';
            case GasType.ALCOHOL:
                return 'Alcohol/Etanol';
            case GasType.CO:
                return 'Monóxido / Humo (MQ9)';
            case GasType.SMOKE:
                return 'Humo / Incendio';
            default:
                return 'Gas Desconocido';
        }
    }

    /**
     * Determina la severidad de la alerta basada en la concentración de gas
     */
    private determineSeverity(gasPpm: number = 0, settings?: any, sensorSource?: string): AlertSeverity {
        // Obtener el umbral configurado para este sensor específico
        let threshold = 300; // Default

        if (settings && sensorSource) {
            const source = sensorSource.toUpperCase();
            if (source.includes('MQ2')) threshold = settings.mq2ThresholdPpm || 300;
            else if (source.includes('MQ3')) threshold = settings.mq3ThresholdPpm || 150;
            else if (source.includes('MQ5')) threshold = settings.mq5ThresholdPpm || 200;
            else if (source.includes('MQ9')) threshold = settings.mq9ThresholdPpm || 100;
        }

        // Determinar severidad relativa al umbral
        if (gasPpm >= threshold * 2.0) return AlertSeverity.CRITICAL;
        if (gasPpm >= threshold * 1.5) return AlertSeverity.HIGH;
        if (gasPpm >= threshold) return AlertSeverity.MEDIUM;
        return AlertSeverity.LOW;
    }

    /**
     * Obtiene el texto descriptivo de la severidad
     */
    private getSeverityText(severity: AlertSeverity): string {
        switch (severity) {
            case AlertSeverity.CRITICAL:
                return 'Nivel Critico';
            case AlertSeverity.HIGH:
                return 'Nivel Alto';
            case AlertSeverity.MEDIUM:
                return 'Nivel Medio';
            case AlertSeverity.LOW:
            default:
                return 'Nivel Bajo';
        }
    }

    /**
     * Resuelve una alerta activa
     */
    async resolveAlert(alertId: number, userId: number) {
        try {
            const alert = await this.prisma.alert.findUnique({
                where: { id: alertId },
            });

            if (!alert) {
                throw new NotFoundException(`Alerta con ID ${alertId} no encontrada`);
            }

            if (alert.resolved) {
                return alert;
            }

            return await this.prisma.alert.update({
                where: { id: alertId },
                data: {
                    resolved: true,
                    resolvedAt: new Date(),
                    resolvedBy: userId,
                },
            });
        } catch (error) {
            this.logger.error(`Error resolviendo alerta ${alertId}: ${error.message}`);
            throw error;
        }
    }
    /**
     * Maneja el control manual de actuadores desde la app
     */
    async handleManualControl(deviceKey: string, actuator: 'window' | 'fan', status: boolean) {
        // Enviar el comando al ESP32 vía WebSocket
        await this.sensorGateway.sendActuatorCommand(deviceKey, actuator, status);

        // Guardar el estado en la DB para persistencia
        try {
            const dataToUpdate = actuator === 'window' ? { windowStatus: status } : { fanStatus: status };
            await this.prisma.device.update({
                where: { deviceKey },
                data: dataToUpdate
            });
        } catch (error) {
            this.logger.error(`Error persisting manual control: ${error.message}`);
        }
    }

    /**
     * Obtiene el historial de alertas de todos los dispositivos de un usuario
     */
    async getAlertHistory(userId: number) {
        return this.prisma.alert.findMany({
            where: {
                device: {
                    userId: userId
                }
            },
            include: {
                device: true
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
    }

    /**
     * Envía comando de calibración remota al ESP32
     */
    async remoteCalibration(deviceKey: string) {
        await this.sensorGateway.sendCalibrationCommand(deviceKey);
    }
}
