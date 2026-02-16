import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationRepository, UserDeviceToken } from '../domain/repository/notification.repository';

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
    private readonly logger = new Logger(PrismaNotificationRepository.name);

    constructor(private readonly prisma: PrismaService) { }

    async findUserDeviceToken(userId: number): Promise<UserDeviceToken | null> {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { deviceToken: true, username: true, email: true },
            });

            if (!user || !user.deviceToken) return null;

            return {
                device_token: user.deviceToken,
                username: user.username,
                email: user.email,
            };
        } catch (error) {
            this.logger.error(`Error finding user device token for user ${userId}`, error);
            throw error;
        }
    }

    async registerDeviceToken(userId: number, token: string): Promise<void> {
        try {
            await this.prisma.user.update({
                where: { id: userId },
                data: { deviceToken: token },
            });
        } catch (error) {
            this.logger.error(
                `Error registering device token for user ${userId}`,
                error,
            );
            throw error;
        }
    }

    async findAll(userId: number): Promise<any[]> {
        return this.prisma.notification.findMany({
            where: { userId },
            include: {
                alert: {
                    include: {
                        device: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}
