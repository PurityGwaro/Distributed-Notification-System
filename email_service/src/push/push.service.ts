import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../database/entities/notification.entity';
import * as admin from 'firebase-admin';

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {
    // Initialize Firebase Admin SDK once
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(
          JSON.parse(process.env.FCM_CREDENTIALS!),
        ),
      });
    }
  }

  async sendPush(payload: any) {
    // Save notification in DB
    const notification = this.notificationRepo.create({
      device_token: payload.device_token,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      status: 'pending',
    });
    await this.notificationRepo.save(notification);

    try {
      const message = {
        token: payload.device_token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data || {},
      };

      const response = await admin.messaging().send(message);

      // Update status in DB
      notification.status = 'sent';
      await this.notificationRepo.save(notification);

      this.logger.log(`Push sent successfully: ${response}`);
      return { success: true, messageId: response };
    } catch (error) {
      notification.status = 'failed';
      await this.notificationRepo.save(notification);

      this.logger.error(`Failed to send push: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}
