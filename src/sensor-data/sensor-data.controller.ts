import { Controller, Post, Get, Body, Param, HttpCode, Logger } from '@nestjs/common';
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
    @ApiOperation({ summary: 'ESP32 obtiene configuración' })
    @ApiResponse({ status: 200, description: 'Configuración obtenida' })
    async getConfig(@Param('deviceKey') deviceKey: string) {
        const device = await this.prisma.device.findUnique({
            where: { deviceKey },
            include: { deviceSettings: true },
        });

        if (!device || !device.deviceSettings) {
            return {
                gasThreshold: 500,
                voltageThreshold: 2.5,
                buzzerEnabled: true,
                ledEnabled: true,
                calibrationR0: 10.0,
            };
        }

        return {
            gasThreshold: device.deviceSettings.gasThresholdPpm,
            voltageThreshold: device.deviceSettings.voltageThreshold,
            buzzerEnabled: device.deviceSettings.buzzerEnabled,
            ledEnabled: device.deviceSettings.ledEnabled,
            calibrationR0: device.deviceSettings.calibrationR0,
        };
    }
}
