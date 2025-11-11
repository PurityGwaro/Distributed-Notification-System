import { Injectable, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { NotificationPayload } from './push_notifications.service';

export interface ProviderResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

@Injectable()
export class PushProvider {
  private readonly logger = new Logger(PushProvider.name);

  constructor() {
    if (admin.apps.length) {
        return;
    }

    const serviceAccountJsonString = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!serviceAccountJsonString) {
      this.logger.error('FIREBASE_SERVICE_ACCOUNT_JSON environment variable is not set. Push notifications will not function.');
      return; 
    }

    try {
      const serviceAccount = JSON.parse(serviceAccountJsonString);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      });

      this.logger.log('Firebase Admin SDK initialized successfully from environment variable.');
    } catch (e) {
      this.logger.error('Failed to parse or initialize Firebase Admin SDK from environment variable.', e.message);
    }
  }

  async sendMessage(payload: NotificationPayload): Promise<ProviderResponse> {
    if (!admin.apps.length) {
        return { success: false, error: 'Firebase Admin SDK is not initialized.' };
    }

    const message: admin.messaging.Message = {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      token: payload.deviceToken,
    };

    try {
      const response = await admin.messaging().send(message);

      return {
        success: true,
        messageId: response,
      };
    } catch (error) {
      this.logger.error(`FCM failed to send message to ${payload.deviceToken}: ${error.code || 'UNKNOWN'} - ${error.message}`);
      
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
