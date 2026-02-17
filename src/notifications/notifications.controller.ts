import { Controller, Post, Body, UseGuards, Logger, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { SendNotificationUseCase } from './application/send-notification.use-case';
import { NotificationsService } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly sendNotificationUseCase: SendNotificationUseCase,
  ) { }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiSecurity('bearer')
  @ApiOperation({ summary: 'Obtener notificaciones del usuario' })
  findAll() {
    return this.notificationsService.findAll();
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
}