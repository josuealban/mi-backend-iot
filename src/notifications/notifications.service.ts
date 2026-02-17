import { Injectable } from '@nestjs/common';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class NotificationsService {

  constructor(private readonly prismaService: PrismaService) { }

  findAll() {
    return this.prismaService.notification.findMany({
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
}