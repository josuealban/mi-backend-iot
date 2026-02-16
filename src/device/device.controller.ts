import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { DeviceService } from './device.service';
import { CreateDeviceDto } from './dto/create-device.dto';
import { UpdateDeviceDto } from './dto/update-device.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/auth/decorators/get-user.decorator';

@ApiTags('device')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('device')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) { }

  @Post()
  @ApiOperation({
    summary: 'Crear nuevo dispositivo',
    description: 'Crea un nuevo dispositivo asociado al usuario autenticado'
  })
  @ApiResponse({
    status: 201,
    description: 'Dispositivo creado exitosamente',
    schema: {
      example: {
        id: 1,
        name: 'Sensor de temperatura',
        description: 'Sensor para monitorear temperatura ambiente',
        location: 'Sala principal',
        userId: 1,
        isActive: true,
        createdAt: '2025-12-02T16:00:00.000Z'
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos'
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado'
  })
  create(
    @Body() createDeviceDto: CreateDeviceDto,
    @GetUser('id') userId: number
  ) {
    return this.deviceService.create(createDeviceDto, userId);
  }

  @Get()
  @ApiOperation({
    summary: 'Obtener todos los dispositivos',
    description: 'Retorna una lista de todos los dispositivos registrados'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de dispositivos obtenida exitosamente',
    schema: {
      example: [
        {
          id: 1,
          name: 'Sensor de temperatura',
          description: 'Sensor para monitorear temperatura ambiente',
          location: 'Sala principal',
          userId: 1,
          isActive: true,
          createdAt: '2025-12-02T16:00:00.000Z'
        },
        {
          id: 2,
          name: 'Sensor de humedad',
          description: 'Sensor para monitorear humedad',
          location: 'Sala secundaria',
          userId: 1,
          isActive: true,
          createdAt: '2025-12-02T15:00:00.000Z'
        }
      ]
    }
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado'
  })
  findAll(@GetUser('id') userId: number) {
    return this.deviceService.findAll(userId);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener dispositivo por ID',
    description: 'Retorna la información completa de un dispositivo con sus datos de sensores y alertas recientes'
  })
  @ApiParam({
    name: 'id',
    description: 'ID del dispositivo',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Dispositivo encontrado exitosamente'
  })
  @ApiResponse({
    status: 404,
    description: 'Dispositivo no encontrado'
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado'
  })
  findOne(@Param('id') id: string) {
    return this.deviceService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar dispositivo',
    description: 'Actualiza los datos básicos de un dispositivo'
  })
  @ApiParam({
    name: 'id',
    description: 'ID del dispositivo',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Dispositivo actualizado exitosamente'
  })
  update(
    @Param('id') id: string,
    @Body() updateDeviceDto: UpdateDeviceDto
  ) {
    return this.deviceService.update(+id, updateDeviceDto);
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Desactivar dispositivo',
    description: 'Desactiva un dispositivo del sistema (soft delete)'
  })
  @ApiParam({
    name: 'id',
    description: 'ID del dispositivo a desactivar',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Dispositivo desactivado exitosamente',
    schema: {
      example: {
        id: 1,
        name: 'Sensor de temperatura',
        description: 'Sensor para monitorear temperatura ambiente',
        location: 'Sala principal',
        userId: 1,
        isActive: false,
        createdAt: '2025-12-02T16:00:00.000Z'
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Dispositivo no encontrado'
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado'
  })
  deactivate(@Param('id') id: string) {
    return this.deviceService.desactive(+id);
  }

  @Post(':id/settings')
  @ApiOperation({
    summary: 'Crear configuración para un dispositivo',
    description: 'Crea la configuración inicial de umbrales y ajustes para un dispositivo'
  })
  @ApiParam({
    name: 'id',
    description: 'ID del dispositivo',
    example: 1
  })
  @ApiResponse({
    status: 201,
    description: 'Configuración creada exitosamente',
    schema: {
      example: {
        id: 1,
        deviceId: 1,
        mq2ThresholdPpm: 300.0,
        mq3ThresholdPpm: 150.0,
        mq5ThresholdPpm: 200.0,
        mq9ThresholdPpm: 100.0,
        mq2R0: 5.5,
        mq3R0: 2.0,
        mq5R0: 20.0,
        mq9R0: 12.0,
        buzzerEnabled: true,
        ledEnabled: true,
        notifyUser: true,
        notificationCooldown: 300,
        autoShutoff: false
      }
    }
  })
  createSettings(
    @Param('id') id: string,
    @Body() settingsDto: any
  ) {
    return this.deviceService.createSettings(+id, settingsDto);
  }

  @Patch(':id/settings')
  @ApiOperation({
    summary: 'Actualizar configuración de un dispositivo',
    description: 'Actualiza los umbrales y ajustes de un dispositivo existente'
  })
  @ApiParam({
    name: 'id',
    description: 'ID del dispositivo',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Configuración actualizada exitosamente'
  })
  updateSettings(
    @Param('id') id: string,
    @Body() settingsDto: any
  ) {
    return this.deviceService.updateSettings(+id, settingsDto);
  }

  @Get(':id/settings')
  @ApiOperation({
    summary: 'Obtener configuración de un dispositivo',
    description: 'Obtiene la configuración actual de umbrales y ajustes'
  })
  @ApiParam({
    name: 'id',
    description: 'ID del dispositivo',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Configuración obtenida exitosamente'
  })
  getSettings(@Param('id') id: string) {
    return this.deviceService.getSettings(+id);
  }
}