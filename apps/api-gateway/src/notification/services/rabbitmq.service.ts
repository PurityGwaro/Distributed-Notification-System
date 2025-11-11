import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';
import { Channel, ConsumeMessage } from 'amqplib';
import { NotificationType } from '@common/interfaces/notification.interface';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.AmqpConnectionManager;
  private channelWrapper: ChannelWrapper;
  private readonly logger = new Logger(RabbitMQService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const rabbitMQUrl = this.configService.get<string>('RABBITMQ_URL');
    const exchange = this.configService.get<string>('RABBITMQ_EXCHANGE');

    this.connection = amqp.connect([rabbitMQUrl]);

    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel: Channel) => {
        await channel.assertExchange(exchange, 'direct', { durable: true });

        const emailQueue = this.configService.get<string>('RABBITMQ_EMAIL_QUEUE');
        const pushQueue = this.configService.get<string>('RABBITMQ_PUSH_QUEUE');
        const failedQueue = this.configService.get<string>('RABBITMQ_FAILED_QUEUE');

        await channel.assertQueue(emailQueue, { durable: true });
        await channel.assertQueue(pushQueue, { durable: true });
        await channel.assertQueue(failedQueue, { durable: true });

        await channel.bindQueue(emailQueue, exchange, 'email');
        await channel.bindQueue(pushQueue, exchange, 'push');
        await channel.bindQueue(failedQueue, exchange, 'failed');

        this.logger.log('RabbitMQ channels and queues setup completed');
      },
    });

    this.connection.on('connect', () => {
      this.logger.log('Connected to RabbitMQ');
    });

    this.connection.on('disconnect', (err) => {
      this.logger.error('Disconnected from RabbitMQ', err);
    });
  }

  async onModuleDestroy() {
    await this.channelWrapper.close();
    await this.connection.close();
  }

  async publishToQueue(
    notificationType: NotificationType,
    message: any,
  ): Promise<void> {
    const exchange = this.configService.get<string>('RABBITMQ_EXCHANGE') || 'notifications.direct';
    const routingKey = notificationType === NotificationType.EMAIL ? 'email' : 'push';

    try {
      await this.channelWrapper.publish(exchange, routingKey, message);

      this.logger.log(`Message published to ${routingKey} queue`);
    } catch (error) {
      this.logger.error(`Failed to publish message to ${routingKey} queue`, error);
      throw error;
    }
  }

  async publishToFailedQueue(message: any): Promise<void> {
    const exchange = this.configService.get<string>('RABBITMQ_EXCHANGE') || 'notifications.direct';

    try {
      await this.channelWrapper.publish(exchange, 'failed', message);

      this.logger.log('Message published to failed queue');
    } catch (error) {
      this.logger.error('Failed to publish message to failed queue', error);
      throw error;
    }
  }

  getChannel(): ChannelWrapper {
    return this.channelWrapper;
  }
}
