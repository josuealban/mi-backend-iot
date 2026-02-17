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
        // Prevenir inicialización múltiple
        if (admin.apps.length > 0) {
            return;
        }

        // OPCIÓN 1: Usar credenciales en Base64 (RECOMENDADO PARA RAILWAY/PRODUCCIÓN)
        const firebaseBase64 = this.configService.get<string>('FIREBASE_CREDENTIALS_BASE64');

        if (firebaseBase64) {
            try {

                const serviceAccount = JSON.parse(
                    Buffer.from(firebaseBase64, 'base64').toString('utf-8')
                );

                admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                });

                return;
            } catch (error) {
                this.logger.error('❌ Failed to initialize Firebase from Base64:', error.message);
                this.logger.debug('Base64 decode error details:', error);
            }
        }

        this.logger.warn(
            '⚠️ Firebase credentials not configured. Push notifications will be disabled.\n' +
            'Please set either:\n' +
            '  - FIREBASE_CREDENTIALS_BASE64 (for production/Railway)\n' +
            '  - FIREBASE_CREDENTIALS_PATH (for local development)'
        );
    }

    /**
     * Envía una notificación push a un dispositivo específico
     */
    async sendPushNotification(
        token: string,
        title: string,
        body: string,
        data?: Record<string, string>,
        sound: string = 'default'
    ): Promise<string | null> {
        // Verificar si Firebase está inicializado
        if (admin.apps.length === 0) {
            this.logger.warn('Firebase not initialized. Skipping notification.');
            return null;
        }

        if (!token) {
            this.logger.warn('No token provided for notification');
            return null;
        }

        try {
            const message: admin.messaging.Message = {
                token: token,
                notification: {
                    title,
                    body,
                },
                data: data || {},
                android: {
                    priority: 'high',
                    notification: {
                        sound: sound,
                        channelId: sound, // Usar el mismo nombre del sonido como ID del canal
                        priority: 'high',
                        color: data?.color || '#3b82f6',
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            sound: sound,
                            badge: 1,
                        },
                    },
                },
            };

            const response = await admin.messaging().send(message);
            return response;
        } catch (error) {
            this.logger.error(
                `❌ Error sending notification to token: ${token.substring(0, 20)}...`,
                error.message
            );

            // Detalles específicos de errores comunes
            if (error.code === 'messaging/invalid-registration-token' ||
                error.code === 'messaging/registration-token-not-registered') {
                this.logger.warn('Token is invalid or expired. User may need to re-register.');
            }

            return null;
        }
    }

    /**
     * Envía notificaciones a múltiples dispositivos
     */
    async sendMulticastNotification(
        tokens: string[],
        title: string,
        body: string,
        data?: Record<string, string>,
    ): Promise<admin.messaging.BatchResponse | null> {
        if (admin.apps.length === 0) {
            this.logger.warn('Firebase not initialized. Skipping multicast notification.');
            return null;
        }

        if (!tokens || tokens.length === 0) {
            this.logger.warn('No tokens provided for multicast notification');
            return null;
        }

        try {
            const message: admin.messaging.MulticastMessage = {
                tokens: tokens,
                notification: {
                    title,
                    body,
                },
                data: data || {},
            };

            const response = await admin.messaging().sendEachForMulticast(message);


            if (response.failureCount > 0) {
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        this.logger.warn(`Failed to send to token ${idx}: ${resp.error}`);
                    }
                });
            }

            return response;
        } catch (error) {
            this.logger.error('❌ Error sending multicast notification:', error.message);
            return null;
        }
    }

    /**
     * Verifica si Firebase está correctamente inicializado
     */
    isInitialized(): boolean {
        return admin.apps.length > 0;
    }

    /**
     * Obtiene estadísticas de Firebase
     */
    getStats() {
        return {
            initialized: this.isInitialized(),
            appsCount: admin.apps.length,
            environment: this.configService.get<string>('NODE_ENV'),
            credentialSource: this.configService.get<string>('FIREBASE_CREDENTIALS_BASE64')
                ? 'Base64'
                : this.configService.get<string>('FIREBASE_CREDENTIALS_PATH')
                    ? 'File'
                    : 'None',
        };
    }
}