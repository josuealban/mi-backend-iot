import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  ConflictException,
} from '@nestjs/common';
import { CreateDeviceDto } from './dto/create-device.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(
    private readonly prismaService: PrismaService,
  ) { }

  async create(createDeviceDto: CreateDeviceDto, userId: number) {
    try {
      const device = await this.prismaService.device.create({
        data: {
          ...createDeviceDto,
          deviceKey: this.generateDeviceKey(),
          userId: userId
        },
        select: {
          id: true,
          name: true,
          description: true,
          location: true,
          deviceKey: true,
          userId: true,
          createdAt: true,
        }
      });

      return device;

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

  async findAll() {
    try {
      const devices = await this.prismaService.device.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          location: true,
          deviceKey: true,
          userId: true,
          createdAt: true,
        }
      });

      return devices;

    } catch (error) {
      this.logger.error(`Error en findAll: ${error.message} `, error.stack);

      throw new InternalServerErrorException(
        'Error al obtener los dispositivos. Por favor, intenta de nuevo.'
      );
    }
  }

  async desactive(id: number) {
    try {
      // Verificar que el dispositivo existe
      const existingDevice = await this.prismaService.device.findUnique({
        where: { id }
      });

      if (!existingDevice) {
        throw new NotFoundException(`Dispositivo con ID ${id} no encontrado`);
      }

      // Desactivar el dispositivo
      const deactivatedDevice = await this.prismaService.device.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          name: true,
          description: true,
          location: true,
          deviceKey: true,
          userId: true,
          createdAt: true,
        }
      });

      return {
        message: 'Dispositivo desactivado exitosamente',
        device: deactivatedDevice
      };

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

      throw new InternalServerErrorException('Error al desactivar el dispositivo');
    }
  }

  async createSettings(deviceId: number, settingsDto: any) {
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
          gasThresholdPpm: settingsDto.gasThresholdPpm ?? 150.0,
          voltageThreshold: settingsDto.voltageThreshold ?? 2.5,
          buzzerEnabled: settingsDto.buzzerEnabled ?? true,
          ledEnabled: settingsDto.ledEnabled ?? true,
          notifyUser: settingsDto.notifyUser ?? true,
          notificationCooldown: settingsDto.notificationCooldown ?? 300,
          autoShutoff: settingsDto.autoShutoff ?? false,
          calibrationR0: settingsDto.calibrationR0 ?? 10.0,
        },
      });

      this.logger.log(`Configuración creada para dispositivo ${deviceId} `);
      return settings;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ConflictException) {
        throw error;
      }
      this.logger.error(`Error al crear configuración: ${error.message} `);
      throw new InternalServerErrorException('Error al crear la configuración');
    }
  }

  async updateSettings(deviceId: number, settingsDto: any) {
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
          ...(settingsDto.gasThresholdPpm !== undefined && { gasThresholdPpm: settingsDto.gasThresholdPpm }),
          ...(settingsDto.voltageThreshold !== undefined && { voltageThreshold: settingsDto.voltageThreshold }),
          ...(settingsDto.buzzerEnabled !== undefined && { buzzerEnabled: settingsDto.buzzerEnabled }),
          ...(settingsDto.ledEnabled !== undefined && { ledEnabled: settingsDto.ledEnabled }),
          ...(settingsDto.notifyUser !== undefined && { notifyUser: settingsDto.notifyUser }),
          ...(settingsDto.notificationCooldown !== undefined && { notificationCooldown: settingsDto.notificationCooldown }),
          ...(settingsDto.autoShutoff !== undefined && { autoShutoff: settingsDto.autoShutoff }),
          ...(settingsDto.calibrationR0 !== undefined && { calibrationR0: settingsDto.calibrationR0 }),
        },
      });

      this.logger.log(`Configuración actualizada para dispositivo ${deviceId} `);
      return settings;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error al actualizar configuración: ${error.message} `);
      throw new InternalServerErrorException('Error al actualizar la configuración');
    }
  }

  async getSettings(deviceId: number) {
    try {
      const settings = await this.prismaService.deviceSettings.findUnique({
        where: { deviceId },
      });

      if (!settings) {
        throw new NotFoundException(`No se encontró configuración para el dispositivo ${deviceId} `);
      }

      return settings;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Error al obtener configuración: ${error.message} `);
      throw new InternalServerErrorException('Error al obtener la configuración');
    }
  }

  /**
   * Genera una clave única para el dispositivo
   */
  private generateDeviceKey(): string {
    return randomUUID();
  }
}


