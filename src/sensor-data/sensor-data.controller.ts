import { Controller, Post, Get, Body, Param, HttpCode, Logger, Patch, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SensorDataService } from './sensor-data.service';
import { GasAlertDto } from './dto/sensor-reading.dto';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@ApiTags('sensor-data')
@Controller('sensor-data')
export class SensorDataController {
    private readonly logger = new Logger(SensorDataController.name);

    constructor(
        private sensorDataService: SensorDataService,
        private prisma: PrismaService,
    ) { }

    /**
     * ESP32 envía alerta de gas detectado (solo cuando se detecta gas)
     * Los datos en tiempo real van por WebSocket, no por este endpoint
     */
    @Post('alert')
    @HttpCode(200)
    @ApiOperation({ summary: 'Recibir alerta de gas desde ESP32 (solo cuando detecta)' })
    @ApiResponse({ status: 200, description: 'Alerta procesada correctamente' })
    async receiveGasAlert(@Body() data: GasAlertDto) {
        this.logger.warn(
            `🚨 ALERTA DE GAS recibida: ${data.gasType} - ` +
            `${data.gasConcentrationPpm} PPM - Sensor: ${data.sensorSource} - ` +
            `Device: ${data.deviceKey}`
        );

        const result = await this.sensorDataService.processGasAlert(data);

        return {
            success: true,
            message: 'Gas alert processed',
            severity: result.severity,
            gasType: result.gasType,
            shouldActivateBuzzer: result.shouldActivateBuzzer,
            shouldActivateLed: result.shouldActivateLed,
        };
    }

    @Patch('config/:deviceKey')
    @HttpCode(200)
    @ApiOperation({ summary: 'Actualizar configuración/calibración desde ESP32' })
    async updateConfig(
        @Param('deviceKey') deviceKey: string,
        @Body() data: any
    ) {
        try {

            const device = await this.prisma.device.findUnique({
                where: { deviceKey },
                include: { deviceSettings: true },
            });

            if (!device) throw new Error('Device not found');

            const settingsData: any = {};
            if (data.mq2R0 !== undefined) settingsData.mq2R0 = data.mq2R0;
            if (data.mq3R0 !== undefined) settingsData.mq3R0 = data.mq3R0;
            if (data.mq5R0 !== undefined) settingsData.mq5R0 = data.mq5R0;
            if (data.mq9R0 !== undefined) settingsData.mq9R0 = data.mq9R0;

            if (data.mq2Threshold !== undefined) settingsData.mq2ThresholdPpm = data.mq2Threshold;
            if (data.mq3Threshold !== undefined) settingsData.mq3ThresholdPpm = data.mq3Threshold;
            if (data.mq5Threshold !== undefined) settingsData.mq5ThresholdPpm = data.mq5Threshold;
            if (data.mq9Threshold !== undefined) settingsData.mq9ThresholdPpm = data.mq9Threshold;

            if (device.deviceSettings) {
                await this.prisma.deviceSettings.update({
                    where: { deviceId: device.id },
                    data: settingsData,
                });
            } else {
                await this.prisma.deviceSettings.create({
                    data: {
                        deviceId: device.id,
                        ...settingsData
                    },
                });
            }

            return { success: true, message: 'Config updated' };
        } catch (error) {
            this.logger.error(`❌ Error actualizando config: ${error.message}`);
            return { success: false, message: error.message };
        }
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

            if (!device || !device.deviceSettings) {
                return {
                    mq2Threshold: 300.0, mq3Threshold: 150.0, mq5Threshold: 200.0, mq9Threshold: 100.0,
                    mq2R0: 5.5, mq3R0: 2.0, mq5R0: 20.0, mq9R0: 12.0,
                    buzzerEnabled: true,
                    ledEnabled: true
                };
            }

            const s = device.deviceSettings;

            return {
                mq2Threshold: s.mq2ThresholdPpm,
                mq3Threshold: s.mq3ThresholdPpm,
                mq5Threshold: s.mq5ThresholdPpm,
                mq9Threshold: s.mq9ThresholdPpm,
                mq2R0: s.mq2R0,
                mq3R0: s.mq3R0,
                mq5R0: s.mq5R0,
                mq9R0: s.mq9R0,
                buzzerEnabled: s.buzzerEnabled,
                ledEnabled: s.ledEnabled,
            };
        } catch (error) {
            this.logger.error(`❌ Error obteniendo configuración: ${error.message}`);
            return {
                mq2Threshold: 300.0, mq3Threshold: 150.0, mq5Threshold: 200.0, mq9Threshold: 100.0,
                mq2R0: 5.5, mq3R0: 2.0, mq5R0: 20.0, mq9R0: 12.0,
                buzzerEnabled: true,
                ledEnabled: true
            };
        }
    }

    @Patch('alerts/:id/resolve')
    @UseGuards(JwtAuthGuard)
    @ApiOperation({ summary: 'Resolver una alerta activa' })
    @ApiResponse({ status: 200, description: 'Alerta resuelta' })
    async resolveAlert(
        @Param('id', ParseIntPipe) alertId: number,
        @GetUser('id') userId: number
    ) {
        const result = await this.sensorDataService.resolveAlert(alertId, userId);
        return {
            success: true,
            data: result,
        };
    }

    @Post('actuator')
    @HttpCode(200)
    @ApiOperation({ summary: 'Control manual de actuadores (ventana/ventilador)' })
    async manualControl(@Body() data: { deviceKey: string, actuator: 'window' | 'fan', status: boolean }) {

        await this.sensorDataService.handleManualControl(data.deviceKey, data.actuator, data.status);

        return {
            success: true,
            message: `Comando ${data.actuator} ${data.status ? 'activado' : 'desactivado'} enviado.`
        };
    }

    @Post('calibrate')
    @HttpCode(200)
    @ApiOperation({ summary: 'Solicitar calibración remota del dispositivo' })
    async remoteCalibration(@Body() data: { deviceKey: string }) {
        await this.sensorDataService.remoteCalibration(data.deviceKey);
        return {
            success: true,
            message: 'Comando de calibración enviado al dispositivo.'
        };
    }
}