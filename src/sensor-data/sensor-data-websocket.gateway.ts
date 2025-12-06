import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'ws';
import { Logger } from '@nestjs/common';
import { SensorDataService } from './sensor-data.service';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway(3001, {
    transports: ['websocket'],
})
export class SensorDataWebSocketGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(SensorDataWebSocketGateway.name);
    private connectedDevices = new Map<string, any>();

    constructor(
        private sensorDataService: SensorDataService,
        private prisma: PrismaService,
    ) { }

    async handleConnection(client: any) {
        this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        this.logger.log(`New WebSocket connection`);
        this.logger.log(`Client IP: ${client._socket.remoteAddress}`);

        // Esperar el primer mensaje con el deviceKey
        client.on('message', async (data: string) => {
            try {
                const message = JSON.parse(data);
                this.logger.log(`Message received: ${JSON.stringify(message)}`);

                // Autenticación
                if (message.type === 'auth' && message.deviceKey) {
                    const device = await this.prisma.device.findUnique({
                        where: { deviceKey: message.deviceKey },
                        include: { deviceSettings: true },
                    });

                    if (!device) {
                        this.logger.warn(`Invalid device key: ${message.deviceKey}`);
                        client.send(JSON.stringify({ type: 'error', message: 'Invalid device key' }));
                        client.close();
                        return;
                    }

                    this.connectedDevices.set(message.deviceKey, client);
                    client.deviceKey = message.deviceKey;
                    client.deviceId = device.id;

                    await this.prisma.device.update({
                        where: { id: device.id },
                        data: { status: 'ONLINE', lastSeen: new Date() },
                    });

                    this.logger.log(`✅ Device authenticated: ${device.name} (${message.deviceKey})`);

                    client.send(JSON.stringify({
                        type: 'connected',
                        deviceId: device.id,
                        deviceName: device.name,
                        message: 'Successfully connected',
                        timestamp: new Date().toISOString(),
                    }));

                    // Enviar configuración
                    if (device.deviceSettings) {
                        client.send(JSON.stringify({
                            type: 'config',
                            gasThreshold: device.deviceSettings.gasThresholdPpm,
                            voltageThreshold: device.deviceSettings.voltageThreshold,
                            buzzerEnabled: device.deviceSettings.buzzerEnabled,
                            ledEnabled: device.deviceSettings.ledEnabled,
                            calibrationR0: device.deviceSettings.calibrationR0,
                        }));
                    }
                }

                // Datos del sensor
                else if (message.type === 'sensor_data' && client.deviceKey) {
                    const result = await this.sensorDataService.processSensorReading({
                        deviceKey: client.deviceKey,
                        rawValue: message.rawValue,
                        voltage: message.voltage,
                        gasConcentrationPpm: message.gasConcentrationPpm,
                        rsRoRatio: message.rsRoRatio,
                        temperature: message.temperature,
                        humidity: message.humidity,
                    });

                    client.send(JSON.stringify({
                        type: 'ack',
                        success: true,
                        timestamp: new Date().toISOString(),
                    }));

                    if (result.thresholdPassed) {
                        client.send(JSON.stringify({
                            type: 'command',
                            ledState: result.shouldActivateLed,
                            buzzerState: result.shouldActivateBuzzer,
                            message: 'Gas threshold exceeded!',
                        }));
                    }
                }

                // Ping
                else if (message.type === 'ping') {
                    if (client.deviceId) {
                        await this.prisma.device.update({
                            where: { id: client.deviceId },
                            data: { lastSeen: new Date() },
                        });
                    }
                    client.send(JSON.stringify({
                        type: 'pong',
                        timestamp: new Date().toISOString(),
                    }));
                }
            } catch (error) {
                this.logger.error(`Error processing message: ${error.message}`);
                client.send(JSON.stringify({ type: 'error', message: error.message }));
            }
        });
    }

    async handleDisconnect(client: any) {
        if (client.deviceKey) {
            this.connectedDevices.delete(client.deviceKey);

            if (client.deviceId) {
                await this.prisma.device.update({
                    where: { id: client.deviceId },
                    data: { status: 'OFFLINE', lastSeen: new Date() },
                });
            }

            this.logger.log(`❌ Device disconnected: ${client.deviceKey}`);
        }
    }

    sendCommandToDevice(deviceKey: string, command: any) {
        const client = this.connectedDevices.get(deviceKey);
        if (client) {
            client.send(JSON.stringify({
                type: 'command',
                ...command,
            }));
            return true;
        }
        return false;
    }
}
