import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as amqp from 'amqp-connection-manager';
import { ChannelWrapper } from 'amqp-connection-manager';
import { ConfirmChannel, Options } from 'amqplib';

@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.AmqpConnectionManager;
  private channelWrapper: ChannelWrapper;

  async onModuleInit() {
    const rabbitMQUrl =
      process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672';

    this.connection = amqp.connect([rabbitMQUrl]);

    this.channelWrapper = this.connection.createChannel({
      json: true,
      setup: async (channel: ConfirmChannel) => {
        await channel.assertExchange('notifications.direct', 'direct', {
          durable: true,
        });
        await channel.assertQueue('email_queue', { durable: true });
        await channel.assertQueue('push_queue', { durable: true });
        await channel.assertQueue('failed_queue', { durable: true });

        await channel.bindQueue('email_queue', 'notifications.direct', 'email');
        await channel.bindQueue('push_queue', 'notifications.direct', 'push');
      },
    });

    await this.channelWrapper.waitForConnect();
    console.log('RabbitMQ connected');
  }

  async publishToQueue(
    queue: string,
    message: any,
    headers?: Record<string, any>,
  ): Promise<void> {
    const routingKey = queue.split('_')[0]; // email_queue -> email, push_queue -> push
    const options: Options.Publish = {
      persistent: true,
      headers: {
        request_id: message.request_id || headers?.request_id,
        correlation_id: headers?.correlation_id,
        timestamp: new Date().toISOString(),
        ...headers,
      },
    };

    await this.channelWrapper.publish(
      'notifications.direct',
      routingKey,
      Buffer.from(JSON.stringify(message)),
      options,
    );
  }

  async onModuleDestroy() {
    await this.channelWrapper.close();
    await this.connection.close();
  }
}
