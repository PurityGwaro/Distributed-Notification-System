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
        await channel.assertQueue('email.queue', { durable: true });
        await channel.assertQueue('push.queue', { durable: true });
        await channel.assertQueue('failed.queue', { durable: true });

        await channel.bindQueue('email.queue', 'notifications.direct', 'email');
        await channel.bindQueue('push.queue', 'notifications.direct', 'push');
      },
    });

    await this.channelWrapper.waitForConnect();
    console.log('RabbitMQ connected');
  }

  async publishToQueue(queue: string, message: any): Promise<void> {
    const routingKey = queue.split('.')[0];
    const options: Options.Publish = { persistent: true }; // <-- typed properly

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
