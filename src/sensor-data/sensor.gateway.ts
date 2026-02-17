import {
    WebSocketGateway,
    WebSocketServer,
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';

interface SensorStreamData {
    deviceKey: string;
    mq2: { raw: number; ppm: number };
    mq3: { raw: number; ppm: number };
    mq5: { raw: number; ppm: number };
    mq9: { raw: number; ppm: number };
    temperature: number;
    humidity: number;
    timestamp: string;
}

@WebSocketGateway({
    cors: {
        origin: '*',
    },
})
export class SensorGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {

    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(SensorGateway.name);
    private connectedDevices = new Map<string, string>(); // socketId -> deviceKey

    constructor(private prisma: PrismaService) { }

    afterInit() {
    }

    handleConnection(client: Socket) {
    }

    handleDisconnect(client: Socket) {
        const deviceKey = this.connectedDevices.get(client.id);
        if (deviceKey) {
            this.connectedDevices.delete(client.id);

            // Marcar dispositivo como OFFLINE
            this.prisma.device.update({
                where: { deviceKey },
                data: { status: 'OFFLINE' },
            }).catch(() => { });
        }
    }

    /**
     * ESP32 se registra con su deviceKey al conectarse
     */
    @SubscribeMessage('register')
    async handleRegister(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { deviceKey: string }
    ) {
        this.connectedDevices.set(client.id, data.deviceKey);

        // Marcar dispositivo como ONLINE
        await this.prisma.device.update({
            where: { deviceKey: data.deviceKey },
            data: { status: 'ONLINE', lastSeen: new Date() },
        }).catch(() => { });

        // Unir al room del dispositivo para que los clientes de la app reciban sus datos
        client.join(`device:${data.deviceKey}`);

        return { status: 'ok', message: 'Registered successfully' };
    }

    /**
     * ESP32 envía lecturas de sensores en tiempo real (NO se guardan en DB)
     * Solo se retransmiten a los clientes de la app suscritos
     */
    @SubscribeMessage('sensorData')
    async handleSensorData(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: SensorStreamData
    ) {
        // Actualizar lastSeen
        await this.prisma.device.update({
            where: { deviceKey: data.deviceKey },
            data: { lastSeen: new Date(), status: 'ONLINE' },
        }).catch(() => { });

        // Reenviar datos a todos los clientes suscritos al room de este dispositivo
        this.server.to(`device:${data.deviceKey}`).emit('sensorUpdate', {
            deviceKey: data.deviceKey,
            mq2: data.mq2,
            mq3: data.mq3,
            mq5: data.mq5,
            mq9: data.mq9,
            temperature: data.temperature,
            humidity: data.humidity,
            timestamp: data.timestamp || new Date().toISOString(),
        });

        return { status: 'ok' };
    }

    /**
     * App se suscribe para recibir datos en tiempo real de un dispositivo
     */
    @SubscribeMessage('subscribe')
    handleSubscribe(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { deviceKey: string }
    ) {
        client.join(`device:${data.deviceKey}`);
        return { status: 'ok', message: `Subscribed to device ${data.deviceKey}` };
    }

    async sendActuatorCommand(deviceKey: string, actuator: 'window' | 'fan', status: boolean) {
        this.server.to(`device:${deviceKey}`).emit('actuatorCommand', {
            actuator,
            status
        });
    }

    async sendCalibrationCommand(deviceKey: string) {
        this.server.to(`device:${deviceKey}`).emit('calibrate', {
            timestamp: new Date().toISOString()
        });
    }

    /**
     * App se desuscribe de un dispositivo
     */
    @SubscribeMessage('unsubscribe')
    handleUnsubscribe(
        @ConnectedSocket() client: Socket,
        @MessageBody() data: { deviceKey: string }
    ) {
        client.leave(`device:${data.deviceKey}`);
        return { status: 'ok', message: `Unsubscribed from device ${data.deviceKey}` };
    }
}
