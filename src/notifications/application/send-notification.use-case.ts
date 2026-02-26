import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FirebaseNotificationService } from '../infrastructure/firebase-notification.service';
import { NotificationRepository } from '../domain/repository/notification.repository';

@Injectable()
export class SendNotificationUseCase {
    private readonly logger = new Logger(SendNotificationUseCase.name);

    constructor(
        private readonly notificationRepo: NotificationRepository,
        private readonly firebaseService: FirebaseNotificationService,
    ) { }

    /**
     * Envía una notificación push a un usuario específico.
     * El sonido se elige automáticamente basándose en la severidad dentro del objeto data.
     */
    async execute(
        userId: number,
        title: string,
        body: string,
        data?: Record<string, string>,
    ) {
        try {
            const user = await this.notificationRepo.findUserDeviceToken(userId);

            if (!user) {
                this.logger.warn(`User with ID ${userId} not found or has no device token`);
                return { success: false, message: 'User not found or no token' };
            }

            // Determinar sonido según severidad (data.severity)
            const severity = data?.severity || 'LOW';
            const sounds = {
                'LOW': 'low',
                'MEDIUM': 'medium',
                'HIGH': 'high',
                'CRITICAL': 'critical',
            };

            const selectedSound = sounds[severity as keyof typeof sounds] || 'default';

            // 1. Enviar la notificación push a través de Firebase
            const response = await this.firebaseService.sendPushNotification(
                user.device_token,
                title,
                body,
                data,
                selectedSound
            );

            // 2. Guardar en la base de datos para el historial
            // Intentamos extraer alertId si viene en la data
            const alertId = data?.alertId ? parseInt(data.alertId) : undefined;

            await this.notificationRepo.create({
                userId,
                alertId,
                title,
                message: body,
                type: 'ALERT',
                sent: !!response,
            });

            return { success: true, response };
        } catch (error) {
            this.logger.error(`Error sending notification to user ${userId}`, error);
            throw error;
        }
    }
}
