import { Injectable } from '@nestjs/common';
import { NotificationRepository } from '../domain/repository/notification.repository';

@Injectable()
export class RegisterDeviceTokenUseCase {
    constructor(private readonly notificationRepository: NotificationRepository) { }

    async execute(userId: number, token: string) {
        return this.notificationRepository.registerDeviceToken(userId, token);
    }
}
