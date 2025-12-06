import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Prisma, User } from '@prisma/client';
import { ApiResponse } from 'src/interfaces/api-response-interface';

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

  async desactive(id: number): Promise<ApiResponse<any>> {
    try {
      const deactivatedUser = await this.prismaService.user.update({
        where: { id },
        data: { isActive: false },
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true,
          createdAt: true,
        }
      });

      return this.buildResponse(true, 'Usuario desactivado exitosamente', deactivatedUser, 200);

    } catch (error) {
      this.logger.error(`Error en desactive: ${error.message}`, error.stack);

      if (error instanceof NotFoundException) {
        throw error;
      }
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


