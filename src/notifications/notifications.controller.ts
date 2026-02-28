import { Controller, Post, Body, UseGuards, Logger, Get, Patch, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SendNotificationUseCase } from './application/send-notification.use-case';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { GetUser } from 'src/auth/decorators/get-user.decorator';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly sendNotificationUseCase: SendNotificationUseCase,
  ) { }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiSecurity('bearer')
  @ApiOperation({ summary: 'Obtener notificaciones del usuario' })
  findAll(@GetUser('id') userId: number) {
    return this.notificationsService.findAll(userId);
  }

  @Post('register-token')
  @UseGuards(JwtAuthGuard)
  @ApiSecurity('bearer')
  @ApiOperation({ summary: 'Registrar token de dispositivo (Push Notifications)' })
  @ApiResponse({ status: 200, description: 'Token registrado correctamente' })
  async registerToken(
    @GetUser('id') userId: number,
    @Body() body: { token: string },
  ) {
    this.logger.log(`Registrando token para usuario ${userId}`);
    await this.notificationsService.registerToken(userId, body.token);
    return { success: true, message: 'Token registrado correctamente' };
  }

  @Post('send-test')
  @ApiOperation({ summary: 'Enviar notificación de prueba (Solo para desarrollo)' })
  async sendTestNotification(
    @Body() body: {
      userId: number;
      title: string;
      body: string;
      data?: Record<string, string>;
    },
  ) {
    return this.sendNotificationUseCase.execute(
      body.userId,
      body.title,
      body.body,
      body.data,
    );
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard)
  @ApiSecurity('bearer')
  @ApiOperation({ summary: 'Marcar una notificación como leída' })
  async markAsRead(@Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.markAsRead(id);
  }

  @Patch('read-all')
  @UseGuards(JwtAuthGuard)
  @ApiSecurity('bearer')
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  async markAllAsRead(@GetUser('id') userId: number) {
    await this.notificationsService.markAllAsRead(userId);
    return { success: true };
  }
}