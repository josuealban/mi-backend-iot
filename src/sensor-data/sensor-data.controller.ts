import { Controller, Post, Get, Body, Param, HttpCode, Logger, Patch } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SensorDataService } from './sensor-data.service';
import { SensorReadingDto } from './dto/sensor-reading.dto';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('sensor-data')
@Controller('sensor-data')
export class SensorDataController {
    private readonly logger = new Logger(SensorDataController.name);
    private pendingCommands = new Map<string, any>();

    constructor(
        private sensorDataService: SensorDataService,
        private prisma: PrismaService,
    ) { }

    @Post()
    @HttpCode(200)
    @ApiOperation({ summary: 'Recibir datos del sensor desde ESP32' })
    @ApiResponse({ status: 200, description: 'Datos procesados correctamente' })
    async receiveSensorData(@Body() data: SensorReadingDto) {
        this.logger.log(`📊 Datos recibidos de dispositivo: ${data.deviceKey}`);
        this.logger.log(`   Gas: ${data.gasConcentrationPpm} PPM`);
        this.logger.log(`   Voltage: ${data.voltage} V`);

        const result = await this.sensorDataService.processSensorReading(data);

        // Si hay alerta, preparar comando para el ESP32
        if (result.thresholdPassed) {
            this.pendingCommands.set(data.deviceKey, {
                ledState: result.shouldActivateLed,
                buzzerState: result.shouldActivateBuzzer,
                message: 'Gas threshold exceeded!',
                timestamp: new Date().toISOString(),
            });
        }

        return {
            success: true,
            message: 'Data received successfully',
            thresholdPassed: result.thresholdPassed,
            command: this.pendingCommands.get(data.deviceKey) || null,
        };
    }

    @Post('save-calibration/:deviceKey')
    @HttpCode(200)
    @ApiOperation({ summary: 'Guardar calibración R0 del sensor desde ESP32' })
    @ApiResponse({ status: 200, description: 'Calibración guardada exitosamente' })
    async saveCalibration(
        @Param('deviceKey') deviceKey: string,
        @Body() calibrationData: { calibrationR0: number }
    ) {
        try {
            this.logger.log(`🔧 Guardando calibración para dispositivo: ${deviceKey}`);
            this.logger.log(`   R0: ${calibrationData.calibrationR0} kΩ`);

            // Buscar el dispositivo
            const device = await this.prisma.device.findUnique({
                where: { deviceKey },
                include: { deviceSettings: true },
            });

            if (!device) {
                this.logger.error(`❌ Dispositivo no encontrado: ${deviceKey}`);
                return {
                    success: false,
                    message: 'Device not found',
                };
            }

            // Actualizar o crear configuración
            if (device.deviceSettings) {
                // Actualizar configuración existente
                const updated = await this.prisma.deviceSettings.update({
                    where: { deviceId: device.id },
                    data: {
                        calibrationR0: calibrationData.calibrationR0,
                    },
                });
                this.logger.log(`✅ Calibración actualizada para dispositivo ${device.name}`);
                this.logger.log(`   Valor anterior → nuevo: ${device.deviceSettings.calibrationR0} → ${updated.calibrationR0}`);
            } else {
                // Crear nueva configuración con valores por defecto
                await this.prisma.deviceSettings.create({
                    data: {
                        deviceId: device.id,
                        calibrationR0: calibrationData.calibrationR0,
                        gasThresholdPpm: 300.0,      // Valor por defecto
                        voltageThreshold: 1.5,        // Valor por defecto
                        buzzerEnabled: true,
                        ledEnabled: true,
                        notifyUser: true,
                        notificationCooldown: 300,
                        autoShutoff: false,
                    },
                });
                this.logger.log(`✅ Configuración creada con calibración para dispositivo ${device.name}`);
            }

            return {
                success: true,
                message: 'Calibration saved successfully',
                data: {
                    deviceKey,
                    deviceName: device.name,
                    calibrationR0: calibrationData.calibrationR0,
                },
            };
        } catch (error) {
            this.logger.error(`❌ Error guardando calibración: ${error.message}`, error.stack);
            return {
                success: false,
                message: 'Error saving calibration',
                error: error.message,
            };
        }
    }

    @Get('command/:deviceKey')
    @ApiOperation({ summary: 'ESP32 obtiene comandos pendientes (polling)' })
    @ApiResponse({ status: 200, description: 'Comando obtenido' })
    async getCommand(@Param('deviceKey') deviceKey: string) {
        const command = this.pendingCommands.get(deviceKey);

        if (command) {
            this.pendingCommands.delete(deviceKey);
            this.logger.log(`📤 Comando enviado a ${deviceKey}`);
            return command;
        }

        // Actualizar lastSeen
        await this.prisma.device.update({
            where: { deviceKey },
            data: { lastSeen: new Date(), status: 'ONLINE' },
        }).catch(() => { });

        return { ledState: false, buzzerState: false };
    }

    @Get('config/:deviceKey')
    @ApiOperation({ summary: 'ESP32 obtiene configuración actual' })
    @ApiResponse({ status: 200, description: 'Configuración obtenida' })
    async getConfig(@Param('deviceKey') deviceKey: string) {
        try {
            const device = await this.prisma.device.findUnique({
                where: { deviceKey },
                include: { deviceSettings: true },
            });

            if (!device) {
                this.logger.warn(`⚠️ Dispositivo no encontrado: ${deviceKey}, usando valores por defecto`);
                return {
                    gasThreshold: 300.0,
                    voltageThreshold: 1.5,
                    buzzerEnabled: true,
                    ledEnabled: true,
                    calibrationR0: 10.0,
                };
            }

            if (!device.deviceSettings) {
                this.logger.warn(`⚠️ Sin configuración para dispositivo ${device.name}, usando valores por defecto`);
                return {
                    gasThreshold: 300.0,
                    voltageThreshold: 1.5,
                    buzzerEnabled: true,
                    ledEnabled: true,
                    calibrationR0: 10.0,
                };
            }

            this.logger.log(`📋 Configuración enviada a ${device.name}: R0=${device.deviceSettings.calibrationR0} kΩ`);

            return {
                gasThreshold: device.deviceSettings.gasThresholdPpm,
                voltageThreshold: device.deviceSettings.voltageThreshold,
                buzzerEnabled: device.deviceSettings.buzzerEnabled,
                ledEnabled: device.deviceSettings.ledEnabled,
                calibrationR0: device.deviceSettings.calibrationR0,
            };
        } catch (error) {
            this.logger.error(`❌ Error obteniendo configuración: ${error.message}`);
            return {
                gasThreshold: 300.0,
                voltageThreshold: 1.5,
                buzzerEnabled: true,
                ledEnabled: true,
                calibrationR0: 10.0,
            };
        }
    }
}