export interface UserDeviceToken {
    device_token: string;
    username: string;
    email: string;
}

export abstract class NotificationRepository {
    abstract registerDeviceToken(userId: number, token: string): Promise<void>;
    abstract findUserDeviceToken(userId: number): Promise<UserDeviceToken | null>;
    abstract findAll(userId: number): Promise<any[]>;
    abstract create(data: {
        userId: number;
        alertId?: number;
        title: string;
        message: string;
        type?: 'ALERT' | 'INFO' | 'WARNING' | 'SUCCESS';
        sent?: boolean;
    }): Promise<any>;
}
