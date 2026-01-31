// src/users/users.controller.ts
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

@ApiTags('users')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get()
  @ApiOperation({
    summary: 'Obtener todos los usuarios',
    description: 'Retorna una lista de todos los usuarios registrados en el sistema'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios obtenida exitosamente',
    schema: {
      example: [
        {
          id: 1,
          username: 'John Doe',
          email: 'john.doe@example.com',
          isActive: true,
          createdAt: '2025-12-02T16:00:00.000Z'
        },
        {
          id: 2,
          username: 'Jane Smith',
          email: 'jane.smith@example.com',
          isActive: true,
          createdAt: '2025-12-02T15:00:00.000Z'
        }
      ]
    }
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado - Token JWT inválido o ausente'
  })
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener usuario por ID',
    description: 'Retorna la información de un usuario específico'
  })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario encontrado',
    schema: {
      example: {
        id: 1,
        username: 'John Doe',
        email: 'john.doe@example.com',
        isActive: true,
        createdAt: '2025-12-02T16:00:00.000Z'
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado'
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado'
  })
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar usuario',
    description: 'Actualiza la información de un usuario (nombre de usuario y/o email)'
  })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario actualizado exitosamente',
    schema: {
      example: {
        success: true,
        message: 'Usuario actualizado exitosamente',
        data: {
          id: 1,
          username: 'John Doe Updated',
          email: 'john.updated@example.com',
          isActive: true,
          createdAt: '2025-12-02T16:00:00.000Z',
          updatedAt: '2025-12-03T10:30:00.000Z'
        },
        statusCode: 200
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado'
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos'
  })
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(+id, updateUserDto);
  }

  @Patch(':id/password')
  @ApiOperation({
    summary: 'Cambiar contraseña',
    description: 'Cambia la contraseña de un usuario verificando la contraseña actual'
  })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Contraseña cambiada exitosamente',
    schema: {
      example: {
        success: true,
        message: 'Contraseña actualizada exitosamente',
        statusCode: 200
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Contraseña actual incorrecta'
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado'
  })
  changePassword(@Param('id') id: string, @Body() changePasswordDto: ChangePasswordDto) {
    return this.usersService.changePassword(+id, changePasswordDto);
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Desactivar usuario',
    description: 'Desactiva un usuario del sistema (soft delete)'
  })
  @ApiParam({
    name: 'id',
    description: 'ID del usuario a desactivar',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario desactivado exitosamente',
    schema: {
      example: {
        id: 1,
        username: 'John Doe',
        email: 'john.doe@example.com',
        isActive: false,
        createdAt: '2025-12-02T16:00:00.000Z'
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado'
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado'
  })
  remove(@Param('id') id: string) {
    return this.usersService.desactive(+id);
  }
}