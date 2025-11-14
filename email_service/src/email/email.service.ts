import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as nodemailer from 'nodemailer';
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

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.AmqpConnectionManager;
  private channelWrapper: ChannelWrapper;
  private transporter: nodemailer.Transporter;
  private retryAttempts = new Map<string, number>();
  private redisClient: RedisClientType;

  constructor(private readonly httpService: HttpService) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async onModuleInit() {
    // Connect to Redis
    await this.connectRedis();

    // Connect to RabbitMQ
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
      console.log('Email Service: Redis connected'),
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
        await channel.assertQueue('email.queue', { durable: true });
        await channel.assertQueue('failed.queue', { durable: true });

        await channel.prefetch(1);
        await channel.consume('email.queue', async (msg: any) => {
          if (msg) {
            await this.processEmailMessage(msg, channel);
          }
        });
      },
    });

    await this.channelWrapper.waitForConnect();
    console.log('Email Service connected to RabbitMQ');
  }

  private async processEmailMessage(msg: any, channel: any) {
    const message = JSON.parse(msg.content.toString());
    const correlationId = message.notification_id;

    try {
      console.log(`Processing email for notification: ${correlationId}`);
      await this.updateStatus(correlationId, NotificationStatus.PROCESSING);

      const titleTemplate = Handlebars.compile(
        message.template.subject || 'Notification',
      );
      const bodyTemplate = Handlebars.compile(message.template.content);

      const subject = titleTemplate(message.variables);
      const html = bodyTemplate(message.variables);

      // Send email
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_USER,
        to: message.user_email,
        subject: subject,
        html: html,
      });

      console.log(`Email sent successfully: ${correlationId}`, info.messageId);

      // Update status to DELIVERED
      await this.updateStatus(
        correlationId,
        NotificationStatus.DELIVERED,
        null,
        { smtp_message_id: info.messageId, recipient: message.user_email },
      );

      // Acknowledge message
      channel.ack(msg);
      this.retryAttempts.delete(correlationId);
    } catch (error) {
      console.error(`Failed to send email: ${error.message}`);

      const attempts = this.retryAttempts.get(correlationId) || 0;

      if (attempts < 3) {
        // Retry with exponential backoff
        this.retryAttempts.set(correlationId, attempts + 1);
        const delay = Math.pow(2, attempts) * 1000;

        // Update status to RETRYING
        await this.updateStatus(
          correlationId,
          NotificationStatus.RETRYING,
          `Retry attempt ${attempts + 1}/3: ${error.message}`,
        );

        setTimeout(() => {
          channel.nack(msg, false, true);
        }, delay);

        console.log(
          `Retrying email (attempt ${attempts + 1}/3) after ${delay}ms`,
        );
      } else {
        // Move to dead letter queue
        console.log(`Moving to dead letter queue: ${correlationId}`);
        await channel.sendToQueue('failed.queue', Buffer.from(msg.content), {
          persistent: true,
        });

        // Update status to FAILED
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
          86400, // 24 hours
          JSON.stringify(updatedStatus),
        );

        console.log(`Status updated in Redis: ${notificationId} -> ${status}`);
      }

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
          ),
        );
        console.log(
          `Status updated via API Gateway: ${notificationId} -> ${status}`,
        );
      } catch (apiError) {
        // Don't fail if API Gateway is unavailable - Redis update is sufficient
        console.warn(
          'Failed to update status via API Gateway (non-critical):',
          apiError.message,
        );
      }
    } catch (err) {
      console.error('Failed to update status:', err.message);
    }
  }

  async onModuleDestroy() {
    await this.channelWrapper.close();
    await this.connection.close();
    await this.redisClient.quit();
  }
}
