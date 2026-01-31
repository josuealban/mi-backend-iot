export interface UserDeviceToken {
    device_token: string;
    username: string;
    email: string;
}

export abstract class NotificationRepository {
    abstract registerDeviceToken(userId: number, token: string): Promise<void>;
    abstract findUserDeviceToken(userId: number): Promise<UserDeviceToken | null>;
    abstract findAll(userId: number): Promise<any[]>;
}
