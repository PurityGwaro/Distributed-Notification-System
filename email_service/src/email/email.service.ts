import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import * as nodemailer from 'nodemailer';
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
  private transporter: nodemailer.Transporter;
  private retryAttempts = new Map<string, number>();
  private redisClient: RedisClientType;
  private isProcessing = false;

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
    console.log('🚀 Email Service initializing...');

    // Connect to Redis
    await this.connectRedis();

    // Connect to RabbitMQ
    await this.connectRabbitMQ();

    // Verify SMTP connection
    await this.verifySmtpConnection();
  }

  private async verifySmtpConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ SMTP connection verified');
    } catch (error) {
      console.error('❌ SMTP connection failed:', error.message);
      console.error('Check your SMTP_USER and SMTP_PASS environment variables');
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
            console.error('❌ Redis max reconnection attempts reached');
            return new Error('Max reconnection attempts reached');
          }
          const delay = Math.min(retries * 100, 3000);
          console.log(`🔄 Reconnecting to Redis... (attempt ${retries})`);
          return delay;
        },
      },
      password: process.env.REDIS_PASSWORD,
    });

    this.redisClient.on('error', (err) =>
      console.error('❌ Redis Client Error:', err.message),
    );
    this.redisClient.on('connect', () =>
      console.log('✅ Email Service: Redis connected'),
    );
    this.redisClient.on('reconnecting', () =>
      console.log('🔄 Redis reconnecting...'),
    );

    await this.redisClient.connect();
  }

  private async connectRabbitMQ() {
    const rabbitMQUrl =
      process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';

    console.log('🔌 Connecting to RabbitMQ...');
    console.log(`   URL: ${rabbitMQUrl.replace(/\/\/.*:.*@/, '//***:***@')}`);

    this.connection = amqp.connect([rabbitMQUrl], {
      heartbeatIntervalInSeconds: 30,
      reconnectTimeInSeconds: 5,
    });

    this.connection.on('connect', () =>
      console.log('✅ RabbitMQ connection established'),
    );
    this.connection.on('disconnect', (err) =>
      console.error(
        '❌ RabbitMQ disconnected:',
        // @ts-expect-error
        err?.message || 'Unknown error',
      ),
    );
    this.connection.on('connectFailed', (err) =>
      console.error(
        '❌ RabbitMQ connection failed:',
        // @ts-expect-error
        err?.message || 'Unknown error',
      ),
    );

    this.channelWrapper = this.connection.createChannel({
      json: true, // IMPORTANT: Match API Gateway's json:true setting
      setup: async (channel: any) => {
        console.log('⚙️ Setting up RabbitMQ channel...');

        // Assert queues
        await channel.assertQueue('email.queue', {
          durable: true,
          arguments: {
            'x-message-ttl': 86400000, // 24 hours
          },
        });
        await channel.assertQueue('failed.queue', { durable: true });

        console.log('📬 Queues asserted');

        // CHECK QUEUE STATUS BEFORE CONSUMING
        const queueInfo = await channel.checkQueue('email.queue');
        console.log('📊 Queue Status BEFORE consuming:');
        console.log(`   Messages in queue: ${queueInfo.messageCount}`);
        console.log(`   Consumers: ${queueInfo.consumerCount}`);

        // Set prefetch
        await channel.prefetch(1);
        console.log('⚙️ Prefetch set to 1');

        // Start consuming
        const consumerTag = await channel.consume(
          'email.queue',
          async (msg: any) => {
            if (msg) {
              console.log('\n' + '='.repeat(60));
              console.log('🎉 MESSAGE RECEIVED FROM QUEUE!');
              console.log('='.repeat(60));
              await this.processEmailMessage(msg, channel);
            } else {
              console.log('⚠️ Received null message');
            }
          },
          { noAck: false },
        );

        console.log(`✅ Consumer started with tag: ${consumerTag.consumerTag}`);

        // CHECK QUEUE STATUS AFTER CONSUMING
        const queueInfoAfter = await channel.checkQueue('email.queue');
        console.log('📊 Queue Status AFTER consumer setup:');
        console.log(`   Messages in queue: ${queueInfoAfter.messageCount}`);
        console.log(`   Consumers: ${queueInfoAfter.consumerCount}`);

        console.log('\n' + '🎧'.repeat(20));
        console.log('👂 EMAIL SERVICE IS NOW LISTENING FOR MESSAGES');
        console.log('🎧'.repeat(20) + '\n');

        // If there are messages, they should be consumed immediately
        if (queueInfoAfter.messageCount > 0) {
          console.log(
            `⚡ ${queueInfoAfter.messageCount} message(s) waiting to be processed...`,
          );
        }
      },
    });

    this.channelWrapper.on('error', (err) => {
      console.error('❌ Channel error:', err.message);
    });

    this.channelWrapper.on('close', () => {
      console.log('⚠️ Channel closed');
    });

    await this.channelWrapper.waitForConnect();
    console.log('✅ Email Service connected to RabbitMQ and ready');
  }

  private async processEmailMessage(msg: ConsumeMessage, channel: any) {
    let correlationId = 'unknown';

    try {
      // Parse message
      const messageContent = msg.content.toString();
      console.log('📝 Raw message content:', messageContent);

      const message = JSON.parse(messageContent);
      correlationId = message.notification_id;

      console.log(`\n=== PROCESSING EMAIL ===`);
      console.log(`Notification ID: ${correlationId}`);
      console.log(`Recipient: ${message.user_email}`);
      console.log(`Subject Template: ${message.template?.subject || 'N/A'}`);

      // Update status to PROCESSING
      await this.updateStatus(correlationId, NotificationStatus.PROCESSING);

      // Compile templates
      const titleTemplate = Handlebars.compile(
        message.template.subject || 'Notification',
      );
      const bodyTemplate = Handlebars.compile(message.template.content);

      const subject = titleTemplate(message.variables || {});
      const html = bodyTemplate(message.variables || {});

      console.log(`📧 Sending email with subject: "${subject}"`);

      // Send email
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_USER,
        to: message.user_email,
        subject: subject,
        html: html,
      });

      console.log(`✅ Email sent successfully!`);
      console.log(`   Message ID: ${info.messageId}`);
      console.log(`   Response: ${info.response}`);

      // Update status to DELIVERED
      await this.updateStatus(
        correlationId,
        NotificationStatus.DELIVERED,
        null,
        {
          smtp_message_id: info.messageId,
          recipient: message.user_email,
          sent_at: new Date().toISOString(),
        },
      );

      // Acknowledge message
      channel.ack(msg);
      this.retryAttempts.delete(correlationId);

      console.log(`✅ Message acknowledged and removed from queue`);
      console.log(`=== EMAIL PROCESSING COMPLETE ===\n`);
    } catch (error) {
      console.error(`\n❌ FAILED TO SEND EMAIL`);
      console.error(`   Notification ID: ${correlationId}`);
      console.error(`   Error: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);

      const attempts = this.retryAttempts.get(correlationId) || 0;

      if (attempts < 3) {
        // Retry with exponential backoff
        this.retryAttempts.set(correlationId, attempts + 1);
        const delay = Math.pow(2, attempts) * 1000;

        console.log(`🔄 Will retry in ${delay}ms (attempt ${attempts + 1}/3)`);

        // Update status to RETRYING
        await this.updateStatus(
          correlationId,
          NotificationStatus.RETRYING,
          `Retry attempt ${attempts + 1}/3: ${error.message}`,
        );

        setTimeout(() => {
          console.log(`🔄 Requeuing message for retry...`);
          channel.nack(msg, false, true);
        }, delay);
      } else {
        // Move to dead letter queue
        console.log(`☠️ Max retries exceeded. Moving to dead letter queue.`);

        await channel.sendToQueue('failed.queue', msg.content, {
          persistent: true,
          headers: {
            'x-original-queue': 'email.queue',
            'x-failed-at': new Date().toISOString(),
            'x-error': error.message,
          },
        });

        // Update status to FAILED
        await this.updateStatus(
          correlationId,
          NotificationStatus.FAILED,
          `Failed after 3 attempts: ${error.message}`,
        );

        channel.ack(msg);
        this.retryAttempts.delete(correlationId);
        console.log(`=== EMAIL PROCESSING FAILED ===\n`);
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
      // Update Redis
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
        86400, // 24 hours
        JSON.stringify(updatedStatus),
      );

      console.log(`📊 Redis status updated: ${notificationId} -> ${status}`);

      // Update via API Gateway
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
              timeout: 5000, // 5 second timeout
            },
          ),
        );
        console.log(
          `📡 API Gateway status updated: ${notificationId} -> ${status}`,
        );
      } catch (apiError) {
        // Don't fail if API Gateway is unavailable
        console.warn(
          `⚠️ Failed to update status via API Gateway (non-critical): ${apiError.message}`,
        );
      }
    } catch (err) {
      console.error(`❌ Failed to update status: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    console.log('🛑 Shutting down Email Service...');

    try {
      if (this.channelWrapper) {
        await this.channelWrapper.close();
        console.log('✅ Channel closed');
      }

      if (this.connection) {
        await this.connection.close();
        console.log('✅ RabbitMQ connection closed');
      }

      if (this.redisClient) {
        await this.redisClient.quit();
        console.log('✅ Redis connection closed');
      }
    } catch (error) {
      console.error('❌ Error during shutdown:', error.message);
    }

    console.log('👋 Email Service shut down complete');
  }
}
