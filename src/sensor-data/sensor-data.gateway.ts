import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseFilters, UsePipes, ValidationPipe } from '@nestjs/common';
import { SensorDataService } from './sensor-data.service';
import { SensorReadingDto } from './dto/sensor-reading.dto';
import { DeviceCommandDto } from './dto/device-command.dto';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: {
    origin: '*', // En producción, especificar los orígenes permitidos
    credentials: true,
  },
  // Usar namespace root (/) para compatibilidad con ESP32
  // La librería arduinoWebSockets tiene problemas con namespaces personalizados
  namespace: '/',
})
export class SensorDataGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(SensorDataGateway.name);

  // Mapa para trackear dispositivos conectados: deviceKey -> socketId
  private connectedDevices = new Map<string, string>();

  // Mapa para trackear sockets: socketId -> deviceKey
  private socketToDevice = new Map<string, string>();

  constructor(
    private sensorDataService: SensorDataService,
    private prisma: PrismaService,
  ) { }

  /**
   * Maneja nuevas conexiones WebSocket
   */
  async handleConnection(client: Socket) {
    this.logger.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.logger.log(`New WebSocket connection attempt`);
    this.logger.log(`Client ID: ${client.id}`);
    this.logger.log(`Client IP: ${client.handshake.address}`);

    // Log de todos los datos del handshake para debugging
    this.logger.debug(`Handshake auth: ${JSON.stringify(client.handshake.auth)}`);
    this.logger.debug(`Handshake query: ${JSON.stringify(client.handshake.query)}`);
    this.logger.debug(`Handshake headers: ${JSON.stringify(client.handshake.headers)}`);

    const deviceKey = client.handshake.auth?.deviceKey || client.handshake.query?.deviceKey;

    if (!deviceKey) {
      this.logger.warn(`❌ Connection rejected: No device key provided`);
      this.logger.warn(`Auth: ${JSON.stringify(client.handshake.auth)}`);
      this.logger.warn(`Query: ${JSON.stringify(client.handshake.query)}`);
      client.emit('error', { message: 'Device key is required' });
      client.disconnect();
      return;
    }

    this.logger.log(`Device Key received: ${deviceKey}`);

    // Verificar que el dispositivo existe en la base de datos
    try {
      const device = await this.prisma.device.findUnique({
        where: { deviceKey: deviceKey as string },
      });

      if (!device) {
        this.logger.warn(`Connection rejected: Invalid device key (${client.id})`);
        client.emit('error', { message: 'Invalid device key' });
        client.disconnect();
        return;
      }

      // Registrar el dispositivo como conectado
      this.connectedDevices.set(deviceKey as string, client.id);
      this.socketToDevice.set(client.id, deviceKey as string);

      // Actualizar estado del dispositivo a ONLINE
      await this.prisma.device.update({
        where: { id: device.id },
        data: {
          status: 'ONLINE',
          lastSeen: new Date()
        },
      });

      this.logger.log(
        `✅ Device connected: ${device.name} (${deviceKey}) - Socket: ${client.id}`
      );

      // Enviar confirmación de conexión al ESP32
      client.emit('connected', {
        message: 'Successfully connected to server',
        deviceId: device.id,
        deviceName: device.name,
        timestamp: new Date().toISOString(),
      });

      // Enviar configuración inicial al dispositivo
      const settings = await this.prisma.deviceSettings.findUnique({
        where: { deviceId: device.id },
      });

      if (settings) {
        client.emit('config', {
          gasThreshold: settings.gasThresholdPpm,
          voltageThreshold: settings.voltageThreshold,
          buzzerEnabled: settings.buzzerEnabled,
          ledEnabled: settings.ledEnabled,
          calibrationR0: settings.calibrationR0,
        });
      }

    } catch (error) {
      this.logger.error(`Error during connection: ${error.message}`, error.stack);
      client.emit('error', { message: 'Internal server error' });
      client.disconnect();
    }
  }

  /**
   * Maneja desconexiones
   */
  async handleDisconnect(client: Socket) {
    const deviceKey = this.socketToDevice.get(client.id);

    if (deviceKey) {
      this.connectedDevices.delete(deviceKey);
      this.socketToDevice.delete(client.id);

      try {
        // Actualizar estado del dispositivo a OFFLINE
        const device = await this.prisma.device.findUnique({
          where: { deviceKey },
        });

        if (device) {
          await this.prisma.device.update({
            where: { id: device.id },
            data: {
              status: 'OFFLINE',
              lastSeen: new Date()
            },
          });

          this.logger.log(`❌ Device disconnected: ${device.name} (${deviceKey})`);
        }
      } catch (error) {
        this.logger.error(`Error during disconnection: ${error.message}`);
      }
    } else {
      this.logger.log(`Client disconnected: ${client.id}`);
    }
  }

  /**
   * Recibe datos del sensor desde el ESP32
   */
  @SubscribeMessage('sensor_data')
  @UsePipes(new ValidationPipe({ transform: true }))
  async handleSensorData(
    @MessageBody() data: SensorReadingDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      this.logger.debug(
        `Received sensor data from ${client.id}: ` +
        `Raw=${data.rawValue}, Gas=${data.gasConcentrationPpm} PPM`
      );

      // Procesar la lectura del sensor
      const result = await this.sensorDataService.processSensorReading(data);

      // Enviar confirmación al ESP32
      client.emit('sensor_data_ack', {
        success: true,
        timestamp: new Date().toISOString(),
      });

      // Si se superó el umbral, enviar comando para activar buzzer/LED
      if (result.thresholdPassed) {
        const command = {
          ledState: result.shouldActivateLed,
          buzzerState: result.shouldActivateBuzzer,
          message: 'Gas threshold exceeded!',
        };

        client.emit('command', command);

        this.logger.warn(
          `⚠️ THRESHOLD EXCEEDED - Sending command to device: ` +
          `LED=${command.ledState}, Buzzer=${command.buzzerState}`
        );
      }

      // Emitir datos en tiempo real a los clientes web conectados
      this.server.emit('sensor_update', {
        deviceKey: data.deviceKey,
        ...result.data,
        thresholdPassed: result.thresholdPassed,
      });

      return { success: true };
    } catch (error) {
      this.logger.error(`Error handling sensor data: ${error.message}`, error.stack);

      client.emit('error', {
        message: 'Error processing sensor data',
        details: error.message,
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Permite enviar comandos a un dispositivo específico (desde el frontend)
   */
  @SubscribeMessage('send_command')
  async handleSendCommand(
    @MessageBody() data: DeviceCommandDto,
    @ConnectedSocket() client: Socket,
  ) {
    try {
      const socketId = this.connectedDevices.get(data.deviceKey);

      if (!socketId) {
        this.logger.warn(`Device ${data.deviceKey} is not connected`);
        return { success: false, message: 'Device is not connected' };
      }

      // Enviar comando al ESP32
      this.server.to(socketId).emit('command', {
        ledState: data.ledState,
        buzzerState: data.buzzerState,
        message: data.message,
      });

      this.logger.log(
        `Command sent to device ${data.deviceKey}: ` +
        `LED=${data.ledState}, Buzzer=${data.buzzerState}`
      );

      return { success: true, message: 'Command sent successfully' };
    } catch (error) {
      this.logger.error(`Error sending command: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  /**
   * Heartbeat para mantener la conexión activa
   */
  @SubscribeMessage('ping')
  async handlePing(@ConnectedSocket() client: Socket) {
    const deviceKey = this.socketToDevice.get(client.id);

    if (deviceKey) {
      // Actualizar lastSeen
      const device = await this.prisma.device.findUnique({
        where: { deviceKey },
      });

      if (device) {
        await this.prisma.device.update({
          where: { id: device.id },
          data: { lastSeen: new Date() },
        });
      }
    }

    client.emit('pong', { timestamp: new Date().toISOString() });
  }

  /**
   * Obtiene la lista de dispositivos conectados
   */
  getConnectedDevices(): string[] {
    return Array.from(this.connectedDevices.keys());
  }

  /**
   * Verifica si un dispositivo está conectado
   */
  isDeviceConnected(deviceKey: string): boolean {
    return this.connectedDevices.has(deviceKey);
  }
}

