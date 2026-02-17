import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
  InternalServerErrorException,
  Logger
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from 'src/users/dto/create-user.dto';
import * as bcrypt from 'bcrypt';
import { LoginDto } from './dto/login-dto';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { Prisma } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) { }

  async register(createUserDto: CreateUserDto) {
    try {

      // Verificar si el usuario ya existe
      const existingUser = await this.prismaService.user.findUnique({
        where: { email: createUserDto.email }
      });

      if (existingUser) {
        throw new ConflictException('El email ya está registrado');
      }

      // Extraer y hashear la contraseña
      const { password, ...data } = createUserDto;
      const hashedPassword = await bcrypt.hash(password, 10);

      // Crear el usuario
      const user = await this.prismaService.user.create({
        data: {
          username: data.username,
          email: data.email,
          password: hashedPassword
        },
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true,
          createdAt: true
        }
      });

      // Generar tokens
      const accessToken = this.getJwtToken(
        { id: user.id },
        { expiresIn: '1h' }
      );

      const refreshToken = this.getJwtToken(
        { id: user.id },
        { expiresIn: '7d' }
      );

      return {
        user,
        accessToken: accessToken,
        refreshToken: refreshToken
      };

    } catch (error) {
      // Log del error
      this.logger.error(`Error en register: ${error.message}`, error.stack);

      // Si ya es una excepción HTTP, la relanzamos
      if (error instanceof ConflictException ||
        error instanceof BadRequestException) {
        throw error;
      }

      // Manejar errores específicos de Prisma
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException('El email ya está registrado');
        }
      }

      // Error genérico
      throw new InternalServerErrorException(
        'Error al registrar el usuario. Por favor, intenta de nuevo.'
      );
    }
  }

  async login(loginDto: LoginDto) {
    try {
      const { email, password } = loginDto;

      // Buscar usuario por email (incluir password para verificación)
      const user = await this.prismaService.user.findUnique({
        where: { email },
        select: {
          id: true,
          username: true,
          email: true,
          password: true,
          isActive: true,
          lastLogin: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!user) {
        throw new UnauthorizedException('Credenciales inválidas');
      }

      // Verificar si el usuario está activo
      if (!user.isActive) {
        throw new UnauthorizedException('Usuario desactivado');
      }

      // Verificar contraseña
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        throw new UnauthorizedException('Credenciales inválidas');
      }

      // Generar tokens
      const accessToken = this.getJwtToken(
        { id: user.id },
        { expiresIn: '1h' }
      );

      const refreshToken = this.getJwtToken(
        { id: user.id },
        { expiresIn: '7d' }
      );

      return {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          isActive: user.isActive
        },
        accessToken: accessToken,
        refreshToken: refreshToken
      };

    } catch (error) {
      // Log del error
      this.logger.error(`Error en login: ${error.message}`, error.stack);

      // Si ya es una excepción HTTP, la relanzamos
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // Error genérico
      throw new InternalServerErrorException(
        'Error al iniciar sesión. Por favor, intenta de nuevo.'
      );
    }
  }

  async refreshToken(refreshTokenDto: { refreshToken: string }) {
    try {
      const { refreshToken } = refreshTokenDto;

      // Verificar el token
      const payload = this.jwtService.verify(refreshToken);

      // Buscar el usuario
      const user = await this.prismaService.user.findUnique({
        where: { id: payload.id },
        select: {
          id: true,
          username: true,
          email: true,
          isActive: true
        }
      });

      if (!user) {
        throw new UnauthorizedException('Token de actualización inválido');
      }

      if (!user.isActive) {
        throw new UnauthorizedException('Usuario desactivado');
      }

      // Generar nuevos tokens
      const newAccessToken = this.getJwtToken(
        { id: user.id },
        { expiresIn: '1h' }
      );

      const newRefreshToken = this.getJwtToken(
        { id: user.id },
        { expiresIn: '7d' }
      );

      return {
        user,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      throw new UnauthorizedException('Token de actualización expirado o inválido');
    }
  }

  private getJwtToken(payload: JwtPayload, options?: JwtSignOptions): string {
    return this.jwtService.sign(payload, options);
  }
}


