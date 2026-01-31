import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NotificationsController } from './notifications.controller';
import { FirebaseNotificationService } from './infrastructure/firebase-notification.service';
import { SendNotificationUseCase } from './application/send-notification.use-case';
import { RegisterDeviceTokenUseCase } from './application/register-device-token.use-case';
import { GetNotificationsUseCase } from './application/get-notifications.use-case';
import { NotificationRepository } from './domain/repository/notification.repository';
import { PrismaNotificationRepository } from './infrastructure/prisma-notification.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [ConfigModule, PrismaModule],
  controllers: [NotificationsController],
  providers: [
    FirebaseNotificationService,
    SendNotificationUseCase,
    RegisterDeviceTokenUseCase,
    GetNotificationsUseCase,
    {
      provide: NotificationRepository,
      useClass: PrismaNotificationRepository,
    },
  ],
  exports: [SendNotificationUseCase],
})
export class NotificationsModule { }
