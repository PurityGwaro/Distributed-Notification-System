import { Injectable, Logger } from '@nestjs/common';
import { PushProvider } from './push_provider.adapter';

export interface NotificationPayload {
  deviceToken: string;
  title: string;
  body: string;
  data?: any;
}

@Injectable()
export class PushNotificationsService {
  private readonly logger = new Logger(PushNotificationsService.name);

  constructor(private readonly pushProvider: PushProvider) {}

  async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      if (!payload.deviceToken || !payload.body) {
          throw new Error('Invalid notification payload: Missing deviceToken or body.');
      }

      this.logger.log(`Sending notification to device: ${payload.deviceToken}`);
      
      const response = await this.pushProvider.sendMessage(payload);

      this.logger.log(`Notification sent successfully. Response: ${JSON.stringify(response)}`);
    } catch (error) {
      this.logger.error(`Failed to send push notification to ${payload.deviceToken}: ${error.message}`);
    }
  }
  }
