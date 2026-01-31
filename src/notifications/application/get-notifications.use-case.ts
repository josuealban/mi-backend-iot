import { Injectable } from '@nestjs/common';
import { NotificationRepository } from '../domain/repository/notification.repository';

@Injectable()
export class GetNotificationsUseCase {
    constructor(private readonly notificationRepository: NotificationRepository) { }

    async execute(userId: number): Promise<any[]> {
        return this.notificationRepository.findAll(userId);
    }
}
