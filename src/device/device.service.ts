import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { ApiResponse } from 'src/interfaces/api-response-interface';

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  private readonly deviceDataSelect = {
    id: true,
    name: true,
    description: true,
    location: true,
    deviceKey: true,
    userId: true,
    createdAt: true,
    status: true,
    lastSeen: true,
  }

  private buildResponse<T>(success: boolean, message: string, data: T, statusCode: number): ApiResponse<T> {
    return {
      success,
      message,
      data,
      statusCode
    }
  }

  constructor(
    private readonly prismaService: PrismaService,
  ) { }

  async create(createDeviceDto: CreateDeviceDto, userId: number): Promise<ApiResponse<any>> {
    try {
      const device = await this.prismaService.device.create({
        data: {
          ...createDeviceDto,
          deviceKey: this.generateDeviceKey(),
          userId: userId
        },
        select: this.deviceDataSelect
      });

      return this.buildResponse(true, 'Dispositivo creado exitosamente', device, 201);

    } catch (error) {
      this.logger.error(`Error en create: ${error.message} `, error.stack);

      // Manejar errores específicos de Prisma
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new NotFoundException('Usuario no encontrado');
        }
      }

      throw new InternalServerErrorException(
        'Error al crear el dispositivo. Por favor, intenta de nuevo.'
      );
    }
  }

  async findAll(userId: number): Promise<ApiResponse<any>> {
    try {
      const devices = await this.prismaService.device.findMany({
        where: { userId },
        select: {
          ...this.deviceDataSelect,
        },
        orderBy: {
          lastSeen: 'desc'
        }
      });

      return this.buildResponse(true, 'Dispositivos obtenidos exitosamente', devices, 200);
    } catch (error) {
      this.logger.error(`Error en findAll: ${error.message} `, error.stack);

      throw new InternalServerErrorException(
        'Error al obtener los dispositivos. Por favor, intenta de nuevo.'
      );
    }
  }

  // ⭐ NUEVO MÉTODO - DEBE ESTAR AQUÍ
  async findOne(id: number): Promise<ApiResponse<any>> {
    try {
      const device = await this.prismaService.device.findUnique({
        where: { id },
        include: {
          deviceSettings: true,
          alerts: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!device) {
        throw new NotFoundException(`Dispositivo con ID ${id} no encontrado`);
      }

      return this.buildResponse(true, 'Dispositivo obtenido exitosamente', device, 200);
    } catch (error) {
      this.logger.error(`Error en findOne: ${error.message}`, error.stack);

      if (error instanceof NotFoundException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Dispositivo con ID ${id} no encontrado`);
        }
      }

      throw new InternalServerErrorException(
        'Error al obtener el dispositivo. Por favor, intenta de nuevo.'
      );
    }
  }

  async update(id: number, updateDeviceDto: UpdateDeviceDto): Promise<ApiResponse<any>> {
    try {
      const device = await this.prismaService.device.update({
        where: { id },
        data: updateDeviceDto,
        select: this.deviceDataSelect
      });

      return this.buildResponse(true, 'Dispositivo actualizado exitosamente', device, 200);

    } catch (error) {
      this.logger.error(`Error en update: ${error.message} `, error.stack);

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Dispositivo con ID ${id} no encontrado`);
        }
      }

      throw new InternalServerErrorException(
        'Error al actualizar el dispositivo. Por favor, intenta de nuevo.'
      );
    }
  }

  async desactive(id: number) {
    try {
      // Desactivar el dispositivo
      const deactivatedDevice = await this.prismaService.device.update({
        where: { id },
        data: { isActive: false },
        select: this.deviceDataSelect
      });

      return this.buildResponse(true, 'Dispositivo desactivado exitosamente', deactivatedDevice, 200);

    } catch (error) {
      this.logger.error(`Error en desactive: ${error.message} `, error.stack);

      // Si ya es una excepción HTTP, la relanzamos
      if (error instanceof NotFoundException) {
        throw error;
      }

      // Manejar error de Prisma cuando el registro no existe
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Dispositivo con ID ${id} no encontrado`);
        }
      }

      return this.buildResponse(false, 'Error al desactivar el dispositivo', null, 500);
    }
  }

  async createSettings(deviceId: number, settingsDto: any): Promise<ApiResponse<any>> {
    try {
      // Verificar que el dispositivo existe
      const device = await this.prismaService.device.findUnique({
        where: { id: deviceId },
      });

      if (!device) {
        throw new NotFoundException(`Dispositivo con ID ${deviceId} no encontrado`);
      }

      // Verificar que no exista ya una configuración
      const existing = await this.prismaService.deviceSettings.findUnique({
        where: { deviceId },
      });

      if (existing) {
        throw new ConflictException('El dispositivo ya tiene configuración. Use PATCH para actualizar.');
      }

      // Crear configuración
      const settings = await this.prismaService.deviceSettings.create({
        data: {
          deviceId,
          mq2ThresholdPpm: settingsDto.mq2ThresholdPpm ?? 300.0,
          mq3ThresholdPpm: settingsDto.mq3ThresholdPpm ?? 150.0,
          mq5ThresholdPpm: settingsDto.mq5ThresholdPpm ?? 200.0,
          mq9ThresholdPpm: settingsDto.mq9ThresholdPpm ?? 100.0,
          mq2R0: settingsDto.mq2R0 ?? 5.5,
          mq3R0: settingsDto.mq3R0 ?? 2.0,
          mq5R0: settingsDto.mq5R0 ?? 20.0,
          mq9R0: settingsDto.mq9R0 ?? 12.0,
          buzzerEnabled: settingsDto.buzzerEnabled ?? true,
          ledEnabled: settingsDto.ledEnabled ?? true,
          notifyUser: settingsDto.notifyUser ?? true,
          notificationCooldown: settingsDto.notificationCooldown ?? 300,
          autoShutoff: settingsDto.autoShutoff ?? false,
        },
      });


      return this.buildResponse(true, 'Configuración creada exitosamente', settings, 201);

    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Error al crear configuración: ${error.message} `);

      return this.buildResponse(false, 'Error al crear la configuración', null, 500);
    }
  }

  async updateSettings(deviceId: number, settingsDto: any): Promise<ApiResponse<any>> {
    try {
      // Verificar que existe la configuración
      const existing = await this.prismaService.deviceSettings.findUnique({
        where: { deviceId },
      });

      if (!existing) {
        throw new NotFoundException(`No se encontró configuración para el dispositivo ${deviceId} `);
      }

      // Actualizar solo los campos proporcionados
      const settings = await this.prismaService.deviceSettings.update({
        where: { deviceId },
        data: {
          ...(settingsDto.mq2ThresholdPpm !== undefined && { mq2ThresholdPpm: settingsDto.mq2ThresholdPpm }),
          ...(settingsDto.mq3ThresholdPpm !== undefined && { mq3ThresholdPpm: settingsDto.mq3ThresholdPpm }),
          ...(settingsDto.mq5ThresholdPpm !== undefined && { mq5ThresholdPpm: settingsDto.mq5ThresholdPpm }),
          ...(settingsDto.mq9ThresholdPpm !== undefined && { mq9ThresholdPpm: settingsDto.mq9ThresholdPpm }),
          ...(settingsDto.mq2R0 !== undefined && { mq2R0: settingsDto.mq2R0 }),
          ...(settingsDto.mq3R0 !== undefined && { mq3R0: settingsDto.mq3R0 }),
          ...(settingsDto.mq5R0 !== undefined && { mq5R0: settingsDto.mq5R0 }),
          ...(settingsDto.mq9R0 !== undefined && { mq9R0: settingsDto.mq9R0 }),
          ...(settingsDto.buzzerEnabled !== undefined && { buzzerEnabled: settingsDto.buzzerEnabled }),
          ...(settingsDto.ledEnabled !== undefined && { ledEnabled: settingsDto.ledEnabled }),
          ...(settingsDto.notifyUser !== undefined && { notifyUser: settingsDto.notifyUser }),
          ...(settingsDto.notificationCooldown !== undefined && { notificationCooldown: settingsDto.notificationCooldown }),
          ...(settingsDto.autoShutoff !== undefined && { autoShutoff: settingsDto.autoShutoff }),
        },
      });

      return this.buildResponse(true, 'Configuración actualizada exitosamente', settings, 200);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error al actualizar configuración: ${error.message} `);
      return this.buildResponse(false, 'Error al actualizar la configuración', null, 500);
    }
  }

  async getSettings(deviceId: number): Promise<ApiResponse<any>> {
    try {
      const settings = await this.prismaService.deviceSettings.findUnique({
        where: { deviceId },
      });

      if (!settings) {
        throw new NotFoundException(`No se encontró configuración para el dispositivo ${deviceId} `);
      }

      return this.buildResponse(true, 'Configuración obtenida exitosamente', settings, 200);

    } catch (error) {

      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error al obtener configuración: ${error.message} `);

      return this.buildResponse(false, 'Error al obtener la configuración', null, 500);
    }
  }

  /**
   * Genera una clave única para el dispositivo
   */
  private generateDeviceKey(): string {
    return randomUUID();
  }
}