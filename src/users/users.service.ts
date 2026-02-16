// src/users/users.service.ts
import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
  UnauthorizedException
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, User } from '@prisma/client';
import { ApiResponse } from 'src/interfaces/api-response-interface';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcrypt';
import { ChangePasswordDto } from './dto/change-password.dto';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

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

  async findAll(): Promise<ApiResponse<any>> {
    try {
      const users = await this.prismaService.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      return this.buildResponse(true, 'Usuarios obtenidos exitosamente', users, 200);

    } catch (error) {
      this.logger.error(`Error en findAll: ${error.message}`, error.stack);

      throw new InternalServerErrorException(
        'Error al obtener los usuarios. Por favor, intenta de nuevo.'
      );
    }
  }

  async findOne(id: number): Promise<ApiResponse<Partial<User>>> {
    try {
      const user = await this.prismaService.user.findUnique({
        where: { id },
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      return this.buildResponse(true, 'Usuario encontrado exitosamente', user, 200);

    } catch (error) {
      this.logger.error(`Error en findOne: ${error.message}`, error.stack);

      if (error instanceof NotFoundException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
        }
      }

      throw new InternalServerErrorException(
        'Error al obtener el usuario. Por favor, intenta de nuevo.'
      );
    }
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<ApiResponse<any>> {
    try {
      // Verificar que el usuario existe
      const existingUser = await this.prismaService.user.findUnique({
        where: { id }
      });

      if (!existingUser) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      // Si se está actualizando el email, verificar que no esté en uso
      if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
        const emailExists = await this.prismaService.user.findUnique({
          where: { email: updateUserDto.email }
        });

        if (emailExists) {
          throw new BadRequestException('El email ya está en uso por otro usuario');
        }
      }

      // Actualizar usuario
      const updatedUser = await this.prismaService.user.update({
        where: { id },
        data: {
          ...(updateUserDto.username && { username: updateUserDto.username }),
          ...(updateUserDto.email && { email: updateUserDto.email }),
        },
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      return this.buildResponse(true, 'Usuario actualizado exitosamente', updatedUser, 200);

    } catch (error) {
      this.logger.error(`Error en update: ${error.message}`, error.stack);

      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
        }
        if (error.code === 'P2002') {
          throw new BadRequestException('El email ya está en uso');
        }
      }

      throw new InternalServerErrorException(
        'Error al actualizar el usuario. Por favor, intenta de nuevo.'
      );
    }
  }

  async changePassword(id: number, changePasswordDto: ChangePasswordDto): Promise<ApiResponse<any>> {
    try {
      // Buscar usuario con contraseña
      const user = await this.prismaService.user.findUnique({
        where: { id },
        select: {
          id: true,
          password: true,
        }
      });

      if (!user) {
        throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
      }

      // Verificar contraseña actual
      const isPasswordValid = await bcrypt.compare(
        changePasswordDto.currentPassword,
        user.password
      );

      if (!isPasswordValid) {
        throw new UnauthorizedException('La contraseña actual es incorrecta');
      }

      // Hashear nueva contraseña
      const hashedPassword = await bcrypt.hash(changePasswordDto.newPassword, 10);

      // Actualizar contraseña
      await this.prismaService.user.update({
        where: { id },
        data: {
          password: hashedPassword,
        }
      });

      return this.buildResponse(true, 'Contraseña actualizada exitosamente', null, 200);

    } catch (error) {
      this.logger.error(`Error en changePassword: ${error.message}`, error.stack);

      if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
        throw error;
      }

      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
        }
      }

      throw new InternalServerErrorException(
        'Error al cambiar la contraseña. Por favor, intenta de nuevo.'
      );
    }
  }

  async desactive(id: number): Promise<ApiResponse<any>> {
    try {
      // Desactivar el usuario
      const deactivatedUser = await this.prismaService.user.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      return this.buildResponse(true, 'Usuario desactivado exitosamente', deactivatedUser, 200);

    } catch (error) {
      this.logger.error(`Error en desactive: ${error.message}`, error.stack);

      // Si ya es una excepción HTTP, la relanzamos
      if (error instanceof NotFoundException) {
        throw error;
      }

      // Manejar error de Prisma cuando el registro no existe
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException(`Usuario con ID ${id} no encontrado`);
        }
      }

      throw new InternalServerErrorException(
        'Error al desactivar el usuario. Por favor, intenta de nuevo.'
      );
    }
  }
}