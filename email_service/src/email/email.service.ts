import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as sgMail from '@sendgrid/mail';
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

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.AmqpConnectionManager;
  private channelWrapper: ChannelWrapper;
  private retryAttempts = new Map<string, number>();
  private redisClient: RedisClientType;
  private isProcessing = false;

  constructor(private readonly httpService: HttpService) {
    // Initialize SendGrid
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      console.error('SENDGRID_API_KEY environment variable is not set');
    } else {
      sgMail.setApiKey(apiKey);
    }
  }

  async onModuleInit() {

    // Connect to Redis
    await this.connectRedis();

    // Connect to RabbitMQ
    await this.connectRabbitMQ();

    // Verify SendGrid
    await this.verifySendGrid();
  }

  private async verifySendGrid() {
    if (!process.env.SENDGRID_API_KEY) {
      console.error('SendGrid API key not configured');
      console.error('Set SENDGRID_API_KEY environment variable');
      return;
    }

    if (!process.env.FROM_EMAIL) {
      console.error('FROM_EMAIL not configured');
      console.error('Set FROM_EMAIL to your verified sender email');
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
            console.error(' Redis max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          const delay = Math.min(retries * 100, 3000);
          return delay;
        },
      },
      password: process.env.REDIS_PASSWORD,
    });

    this.redisClient.on('error', (err) =>
      console.error('Redis Client Error:', err.message),
    );
    this.redisClient.on('connect', () =>
      console.log('Email Service: Redis connected'),
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
        ' RabbitMQ disconnected:',
        // @ts-expect-error: RabbitMQ error type is unknown and may not contain "message"
        err?.message || 'Unknown error',
      ),
    );

    this.connection.on('connectFailed', (err) =>
      console.error(
        ' RabbitMQ connection failed:',
        // @ts-expect-error: RabbitMQ error type does not strictly match TypeScript's expected shape
        err?.message || 'Unknown error',
      ),
    );

    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel: any) => {

        await channel.assertQueue('email.queue', {
          durable: true,
          arguments: {
            'x-message-ttl': 86400000,
          },
        });
        await channel.assertQueue('failed.queue', { durable: true });

        const queueInfo = await channel.checkQueue('email.queue');

        await channel.prefetch(1);

        const consumerTag = await channel.consume(
          'email.queue',
          async (msg: any) => {
            if (msg) {
              await this.processEmailMessage(msg, channel);
            } else {
              console.log('Received null message');
            }
          },
          { noAck: false },
        );

        const queueInfoAfter = await channel.checkQueue('email.queue');

        if (queueInfoAfter.messageCount > 0) {
          console.log(
            `⚡ ${queueInfoAfter.messageCount} message(s) waiting to be processed...`,
          );
        }
      },
    });

    this.channelWrapper.on('error', (err) => {
      console.error(' Channel error:', err.message);
    });

    this.channelWrapper.on('close', () => {
      console.log('Channel closed');
    });

    await this.channelWrapper.waitForConnect();
    console.log('Email Service connected to RabbitMQ and ready');
  }

  private async processEmailMessage(msg: ConsumeMessage, channel: any) {
    let correlationId = 'unknown';

    try {
      const messageContent = msg.content.toString();

      const message = JSON.parse(messageContent);
      correlationId = message.notification_id;

      await this.updateStatus(correlationId, NotificationStatus.PROCESSING);

      const titleTemplate = Handlebars.compile(
        message.template.subject || 'Notification',
      );
      const bodyTemplate = Handlebars.compile(message.template.content);

      const subject = titleTemplate(message.variables || {});
      const html = bodyTemplate(message.variables || {});

      // Send email via SendGrid
      const emailMsg = {
        to: message.user_email,
        from: process.env.FROM_EMAIL,
        subject: subject,
        html: html,
      };

      const response = await sgMail.send(emailMsg);

      await this.updateStatus(
        correlationId,
        NotificationStatus.DELIVERED,
        null,
        {
          sendgrid_message_id: response[0].headers['x-message-id'],
          recipient: message.user_email,
          sent_at: new Date().toISOString(),
          status_code: response[0].statusCode,
        },
      );

      channel.ack(msg);
      this.retryAttempts.delete(correlationId);
    } catch (error) {
      console.error(`\n FAILED TO SEND EMAIL`);
      console.error(`   Notification ID: ${correlationId}`);
      console.error(`   Error: ${error.message}`);

      // SendGrid specific error details
      if (error.response) {
        console.error(`   Status: ${error.code}`);
        console.error(`   Body: ${JSON.stringify(error.response.body)}`);
      }

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
            'x-original-queue': 'email.queue',
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
      }
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
          this.httpService.post(
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
      } catch (apiError) {
        console.warn(
          `Failed to update status via API Gateway (non-critical): ${apiError.message}`,
        );
      }
    } catch (err) {
      console.error(` Failed to update status: ${err.message}`);
    }
  }

  async onModuleDestroy() {

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
    } catch (error) {
      console.error(' Error during shutdown:', error.message);
    }

    console.log('👋 Email Service shut down complete');
  }
}
