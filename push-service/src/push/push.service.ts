import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as Handlebars from 'handlebars';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';
import { createClient, RedisClientType } from 'redis';
import { ConsumeMessage } from 'amqplib';

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
    await this.verifyOneSignal();
  }

  private async verifyOneSignal() {
    if (!process.env.ONESIGNAL_APP_ID || !process.env.ONESIGNAL_API_KEY) {
      console.error('OneSignal not configured');
      console.error(
        'Set ONESIGNAL_APP_ID and ONESIGNAL_API_KEY environment variables',
      );
      return;
    }
  }

  private async connectRedis() {
    const redisHost = process.env.REDIS_HOST || 'redis';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');

    this.redisClient = createClient({
      socket: {
        host: redisHost,
        port: redisPort,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            return new Error('Max reconnection attempts reached');
          }
          const delay = Math.min(retries * 100, 3000);
          console.log(`Reconnecting to Redis... (attempt ${retries})`);
          return delay;
        },
      },
      password: process.env.REDIS_PASSWORD,
    });

    this.redisClient.on('error', (err) =>
      console.error('Redis Client Error:', err.message),
    );
    this.redisClient.on('connect', () =>
      console.log('Push Service: Redis connected'),
    );
    this.redisClient.on('reconnecting', () =>
      console.log('Redis reconnecting...'),
    );

    await this.redisClient.connect();
  }

  private async connectRabbitMQ() {
    const rabbitMQUrl =
      process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';

    this.connection = amqp.connect([rabbitMQUrl], {
      heartbeatIntervalInSeconds: 30,
      reconnectTimeInSeconds: 5,
    });

    this.connection.on('connect', () =>
      console.log('RabbitMQ connection established'),
    );
    this.connection.on('disconnect', (err) =>
      console.error(
        'RabbitMQ disconnected:',
        // @ts-expect-error: RabbitMQ error type
        err?.message || 'Unknown error',
      ),
    );

    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel: any) => {
        await channel.assertQueue('push.queue', {
          durable: true,
          arguments: {
            'x-message-ttl': 86400000,
          },
        });
        await channel.assertQueue('failed.queue', { durable: true });

        const queueInfo = await channel.checkQueue('push.queue');
        console.log('📊 Queue Status BEFORE consuming:');
        console.log(`   Messages in queue: ${queueInfo.messageCount}`);
        console.log(`   Consumers: ${queueInfo.consumerCount}`);

        await channel.prefetch(1);

        await channel.consume(
          'push.queue',
          async (msg: any) => {
            if (msg) {
              console.log('\n' + '='.repeat(60));
              console.log('🎉 MESSAGE RECEIVED FROM QUEUE!');
              console.log('='.repeat(60));
              await this.processPushMessage(msg, channel);
            } else {
              console.log('Received null message');
            }
          },
          { noAck: false },
        );

        const queueInfoAfter = await channel.checkQueue('push.queue');

        if (queueInfoAfter.messageCount > 0) {
          console.log(
            `⚡ ${queueInfoAfter.messageCount} message(s) waiting to be processed...`,
          );
        }
      },
    });

    this.channelWrapper.on('error', (err) => {
      console.error('Channel error:', err.message);
    });

    this.channelWrapper.on('close', () => {
      console.log('Channel closed');
    });

    await this.channelWrapper.waitForConnect();
    console.log('Push Service connected to RabbitMQ and ready');
  }

  private async processPushMessage(msg: ConsumeMessage, channel: any) {
    let correlationId = 'unknown';

    try {
      const messageContent = msg.content.toString();
      console.log('📝 Raw message content:', messageContent);

      const message = JSON.parse(messageContent);
      correlationId = message.notification_id;

      if (!message.user_push_token) {
        console.error('No push token available for user');
        await this.updateStatus(
          correlationId,
          NotificationStatus.FAILED,
          'No push token available',
        );
        channel.ack(msg);
        return;
      }

      await this.updateStatus(correlationId, NotificationStatus.PROCESSING);

      const titleTemplate = Handlebars.compile(
        message.template.subject || 'Notification',
      );
      const bodyTemplate = Handlebars.compile(message.template.content || '');

      const title = titleTemplate(message.variables || {});
      const body = bodyTemplate(message.variables || {});

      const response = await this.sendPushNotification({
        token: message.user_push_token,
        title,
        body,
        data: message.metadata,
      });


      await this.updateStatus(
        correlationId,
        NotificationStatus.DELIVERED,
        null,
        {
          onesignal_id: response.messageId,
          device_token: message.user_push_token,
          user_id: message.user_id,
          sent_at: new Date().toISOString(),
        },
      );

      channel.ack(msg);
      this.retryAttempts.delete(correlationId);

    } catch (error: any) {
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
      } else {
        await channel.sendToQueue('failed.queue', msg.content, {
          persistent: true,
          headers: {
            'x-original-queue': 'push.queue',
            'x-failed-at': new Date().toISOString(),
            'x-error': error.message,
          },
        });

        await this.updateStatus(
          correlationId,
          NotificationStatus.FAILED,
          `Failed after 3 attempts: ${error.message}`,
        );

        channel.ack(msg);
        this.retryAttempts.delete(correlationId);
        console.log(`PUSH NOTIFICATION FAILED`);
      }
    }
  }

  private async sendPushNotification(payload: any) {
    const oneSignalAppId = process.env.ONESIGNAL_APP_ID;
    const oneSignalApiKey = process.env.ONESIGNAL_API_KEY;

    if (!oneSignalAppId || !oneSignalApiKey) {
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
            timeout: 10000,
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
      const currentStatus = await this.redisClient.get(
        `status:${notificationId}`,
      );

      let updatedStatus;
      if (currentStatus) {
        const statusObj = JSON.parse(currentStatus);
        updatedStatus = {
          ...statusObj,
          status: status,
          updated_at: new Date().toISOString(),
          error: error || statusObj.error,
          metadata: metadata || statusObj.metadata,
          attempts:
            (statusObj.attempts || 0) +
            (status === NotificationStatus.RETRYING ? 1 : 0),
        };
      } else {
        updatedStatus = {
          notification_id: notificationId,
          status: status,
          updated_at: new Date().toISOString(),
          error: error,
          metadata: metadata,
          attempts: status === NotificationStatus.RETRYING ? 1 : 0,
        };
      }

      await this.redisClient.setEx(
        `status:${notificationId}`,
        86400,
        JSON.stringify(updatedStatus),
      );


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
            {
              timeout: 5000,
            },
          ),
        );
      } catch (apiError: any) {
        console.warn(
          `Failed to update status via API Gateway (non-critical): ${apiError.message}`,
        );
      }
    } catch (err: any) {
      console.error(`Failed to update status: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    console.log('Shutting down Push Service...');

    try {
      if (this.channelWrapper) {
        await this.channelWrapper.close();
        console.log('Channel closed');
      }

      if (this.connection) {
        await this.connection.close();
        console.log('RabbitMQ connection closed');
      }

      if (this.redisClient) {
        await this.redisClient.quit();
        console.log('Redis connection closed');
      }
    } catch (error: any) {
      console.error('Error during shutdown:', error.message);
    }

    console.log('Push Service shut down complete');
  }
}
