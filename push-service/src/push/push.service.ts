import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as Handlebars from 'handlebars';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';
import { createClient, RedisClientType } from 'redis';

enum NotificationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

interface OneSignalResponse {
  id: string;
  recipients: number;
}

interface ApiGatewayResponse {
  success: boolean;
  message: string;
}

@Injectable()
export class PushService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.AmqpConnectionManager;
  private channelWrapper: ChannelWrapper;
  private retryAttempts = new Map<string, number>();
  private redisClient: RedisClientType;

  constructor(private readonly httpService: HttpService) {}

  async onModuleInit() {
    await this.connectRedis();
    await this.connectRabbitMQ();
  }

  private async connectRedis() {
    const redisHost = process.env.REDIS_HOST || 'redis';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');

    this.redisClient = createClient({
      socket: {
        host: redisHost,
        port: redisPort,
      },
      password: process.env.REDIS_PASSWORD,
    });

    this.redisClient.on('error', (err) =>
      console.error('Redis Client Error', err),
    );
    this.redisClient.on('connect', () =>
      console.log('Push Service: Redis connected'),
    );

    await this.redisClient.connect();
  }

  private async connectRabbitMQ() {
    const rabbitMQUrl =
      process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';

    this.connection = amqp.connect([rabbitMQUrl]);

    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel: any) => {
        await channel.assertQueue('push.queue', { durable: true });
        await channel.assertQueue('failed.queue', { durable: true });

        await channel.prefetch(1);
        await channel.consume('push.queue', async (msg: any) => {
          if (msg) {
            await this.processPushMessage(msg, channel);
          }
        });
      },
    });

    await this.channelWrapper.waitForConnect();
    console.log('Push Service connected to RabbitMQ');
  }

  private async processPushMessage(msg: any, channel: any) {
    const message = JSON.parse(msg.content.toString());
    const correlationId = message.notification_id;

    try {
      console.log(`Processing push notification: ${correlationId}`);

      if (!message.user_push_token) {
        throw new Error('No push token available for user');
      }

      await this.updateStatus(correlationId, NotificationStatus.PROCESSING);

      const titleTemplate = Handlebars.compile(
        message.template.subject || 'Notification',
      );
      const bodyTemplate = Handlebars.compile(message.template.content);

      const title = titleTemplate(message.variables);
      const body = bodyTemplate(message.variables);

      const fcmResponse = await this.sendPushNotification({
        token: message.user_push_token,
        title,
        body,
        data: message.metadata,
      });

      console.log(`Push notification sent successfully: ${correlationId}`);

      await this.updateStatus(
        correlationId,
        NotificationStatus.DELIVERED,
        null,
        {
          fcm_message_id: fcmResponse?.messageId,
          device_token: message.user_push_token,
        },
      );

      channel.ack(msg);
      this.retryAttempts.delete(correlationId);
    } catch (error: any) {
      console.error(`Failed to send push notification: ${error.message}`);

      const attempts = this.retryAttempts.get(correlationId) || 0;

      if (attempts < 3) {
        this.retryAttempts.set(correlationId, attempts + 1);
        const delay = Math.pow(2, attempts) * 1000;

        await this.updateStatus(
          correlationId,
          NotificationStatus.RETRYING,
          `Retry attempt ${attempts + 1}/3: ${error.message}`,
        );

        setTimeout(() => {
          channel.nack(msg, false, true);
        }, delay);

        console.log(
          `Retrying push (attempt ${attempts + 1}/3) after ${delay}ms`,
        );
      } else {
        console.log(`Moving to dead letter queue: ${correlationId}`);
        await channel.sendToQueue('failed.queue', Buffer.from(msg.content), {
          persistent: true,
        });

        await this.updateStatus(
          correlationId,
          NotificationStatus.FAILED,
          `Failed after 3 attempts: ${error.message}`,
        );

        channel.ack(msg);
        this.retryAttempts.delete(correlationId);
      }
    }
  }

  private async sendPushNotification(payload: any) {
    const oneSignalAppId = process.env.ONESIGNAL_APP_ID;
    const oneSignalApiKey = process.env.ONESIGNAL_API_KEY;

    if (!oneSignalAppId || !oneSignalApiKey) {
      console.warn('OneSignal not configured - simulating push send');
      return { messageId: `simulated_${Date.now()}` };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.post<OneSignalResponse>(
          'https://onesignal.com/api/v1/notifications',
          {
            app_id: oneSignalAppId,
            include_player_ids: [payload.token],
            headings: { en: payload.title },
            contents: { en: payload.body },
            data: payload.data,
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${oneSignalApiKey}`,
            },
          },
        ),
      );

      return { messageId: response.data.id };
    } catch (error: any) {
      console.error(
        'OneSignal API Error:',

        error.response?.data || error.message,
      );
      throw new Error(`OneSignal send failed: ${error.message}`);
    }
  }

  private async updateStatus(
    notificationId: string,
    status: NotificationStatus,
    error?: string,
    metadata?: any,
  ) {
    try {
      const currentStatus: string | null = await this.redisClient.get(
        `status:${notificationId}`,
      );

      if (currentStatus) {
        const statusObj = JSON.parse(currentStatus);
        const updatedStatus = {
          ...statusObj,
          status: status,
          updated_at: new Date().toISOString(),
          error: error || statusObj.error,
          metadata: metadata || statusObj.metadata,
          attempts:
            (statusObj.attempts || 0) +
            (status === NotificationStatus.RETRYING ? 1 : 0),
        };

        await this.redisClient.setEx(
          `status:${notificationId}`,
          86400,
          JSON.stringify(updatedStatus),
        );

        console.log(`Status updated in Redis: ${notificationId} -> ${status}`);
      }

      const apiGatewayUrl =
        process.env.API_GATEWAY_URL || 'http://localhost:3000';
      try {
        await firstValueFrom(
          this.httpService.post<ApiGatewayResponse>(
            `${apiGatewayUrl}/api/v1/notifications/status`,
            {
              notification_id: notificationId,
              status: status,
              error: error,
              metadata: metadata,
            },
          ),
        );
        console.log(
          `Status updated via API Gateway: ${notificationId} -> ${status}`,
        );
      } catch (apiError: any) {
        console.warn(
          'Failed to update status via API Gateway (non-critical):',
          apiError.message,
        );
      }
    } catch (err: any) {
      console.error('Failed to update status:', err.message);
    }
  }

  async onModuleDestroy() {
    await this.channelWrapper.close();
    await this.connection.close();
    await this.redisClient.quit();
  }
}
