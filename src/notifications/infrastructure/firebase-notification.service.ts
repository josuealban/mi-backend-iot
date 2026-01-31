import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseNotificationService implements OnModuleInit {
    private readonly logger = new Logger(FirebaseNotificationService.name);

    constructor(private configService: ConfigService) { }

    onModuleInit() {
        this.initializeFirebase();
    }

    private initializeFirebase() {
        const firebaseCredentialsPath = this.configService.get<string>(
            'FIREBASE_CREDENTIALS_PATH',
        );

        if (!firebaseCredentialsPath) {
            this.logger.warn(
                'FIREBASE_CREDENTIALS_PATH not defined in .env. Firebase integration disabled.',
            );
            return;
        }

        if (admin.apps.length === 0) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const path = require('path');
                const absolutePath = path.resolve(
                    process.cwd(),
                    firebaseCredentialsPath,
                );
                // eslint-disable-next-line @typescript-eslint/no-var-requires
                const serviceAccount = require(absolutePath);

                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                });
                this.logger.log('Firebase Admin initialized successfully');
            } catch (error) {
                this.logger.error('Failed to initialize Firebase Admin', error);
            }
        }
    }

    async sendPushNotification(
        token: string,
        title: string,
        body: string,
        data?: Record<string, string>,
    ) {
        if (!token) {
            this.logger.warn('No token provided for notification');
            return;
        }

        try {
            const message: admin.messaging.Message = {
                token: token,
                notification: {
                    title,
                    body,
                },
                data: data,
            };

            const response = await admin.messaging().send(message);
            return response;
        } catch (error) {
            this.logger.error(`Error sending notification to ${token}`, error);
            return null;
        }
    }
}
