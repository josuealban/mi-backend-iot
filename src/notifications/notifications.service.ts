import { Injectable } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class NotificationsService {

  constructor(private readonly prismaService: PrismaService) { }

  findAll(userId: number) {
    return this.prismaService.notification.findMany({
      where: { userId },
      include: {
        alert: {
          include: {
            device: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }

  async registerToken(userId: number, token: string) {
    return this.prismaService.user.update({
      where: { id: userId },
      data: { deviceToken: token },
    });
  }

  async markAsRead(notificationId: number) {
    return this.prismaService.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: number) {
    return this.prismaService.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }
}