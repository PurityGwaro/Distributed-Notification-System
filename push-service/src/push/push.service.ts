import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../database/entities/notification.entity';
import * as admin from 'firebase-admin';

export interface SendPushPayload {
  device_token: string;
  title: string;
  body: string;
  data?: any;
  request_id?: string;
  correlation_id?: string;
}

@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {
    // Initialize Firebase Admin SDK once
    if (!admin.apps.length) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert(
            JSON.parse(process.env.FCM_CREDENTIALS),
          ),
        });
        this.logger.log('Firebase Admin SDK initialized successfully');
      } catch (error) {
        this.logger.error(
          `Failed to initialize Firebase Admin SDK: ${error.message}`,
        );
      }
    }
  }

  /**
   * Send push notification with idempotency support
   */
  async sendPush(payload: SendPushPayload, retryCount = 0): Promise<any> {
    const correlationId = payload.correlation_id || 'N/A';
    const logPrefix = `[CID:${correlationId}]`;

    // Check for idempotency - if request_id exists, return existing result
    if (payload.request_id) {
      const existing = await this.notificationRepo.findOne({
        where: { request_id: payload.request_id },
      });

      if (existing) {
        this.logger.log(
          `${logPrefix} Duplicate request detected: ${payload.request_id}. Returning existing result.`,
        );
        return {
          success: true,
          message: 'Notification already processed',
          notificationId: existing.id,
          status: existing.status,
        };
      }
    }

    // Create notification in DB
    const notification = this.notificationRepo.create({
      device_token: payload.device_token,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      status: 'pending',
      retry_count: retryCount,
      request_id: payload.request_id,
      correlation_id: correlationId,
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

      this.logger.log(`${logPrefix} Push sent successfully: ${response}`);
      return {
        success: true,
        messageId: response,
        notificationId: notification.id,
      };
    } catch (error) {
      notification.status = 'failed';
      notification.error_message = error.message;
      notification.retry_count = retryCount;
      await this.notificationRepo.save(notification);

      this.logger.error(`${logPrefix} Failed to send push: ${error.message}`);
      throw error; // Re-throw to trigger retry logic in consumer
    }
  }

  /**
   * Backward compatibility method
   */
  async sendPushLegacy(payload: any, retryCount = 0): Promise<any> {
    return this.sendPush(
      {
        device_token: payload.device_token,
        title: payload.title,
        body: payload.body,
        data: payload.data,
      },
      retryCount,
    );
  }

  async getNotificationStatus(notificationId: string): Promise<Notification> {
    return this.notificationRepo.findOne({ where: { id: notificationId } });
  }

  async getNotificationsByStatus(status: string): Promise<Notification[]> {
    return this.notificationRepo.find({ where: { status } });
  }
}
