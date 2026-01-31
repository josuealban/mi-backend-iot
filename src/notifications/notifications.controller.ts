import { Controller, Post, Body, UseGuards, Get } from '@nestjs/common';
import { RegisterDeviceTokenUseCase } from './application/register-device-token.use-case';
import { SendNotificationUseCase } from './application/send-notification.use-case';
import { GetNotificationsUseCase } from './application/get-notifications.use-case';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly registerDeviceTokenUseCase: RegisterDeviceTokenUseCase,
    private readonly sendNotificationUseCase: SendNotificationUseCase,
    private readonly getNotificationsUseCase: GetNotificationsUseCase,
  ) { }

  @Post('register-token')
  @UseGuards(JwtAuthGuard)
  async registerDeviceToken(
    @GetUser('id') userId: number,
    @Body() body: { token: string }
  ) {
    await this.registerDeviceTokenUseCase.execute(userId, body.token);
    return { success: true, message: 'Token registered successfully' };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getNotifications(@GetUser('id') userId: number) {
    return this.getNotificationsUseCase.execute(userId);
  }

  @Post('send-test')
  async sendTestNotification(
    @Body()
    body: {
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
