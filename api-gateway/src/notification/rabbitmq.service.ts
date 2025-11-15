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
        await channel.assertQueue('email.queue', {
          durable: true,
          arguments: {
            'x-message-ttl': 86400000,
          },
        });
        await channel.assertQueue('push.queue', { durable: true });
        await channel.assertQueue('failed.queue', { durable: true });
      },
    });

    await this.channelWrapper.waitForConnect();
  }

  async publishToQueue(
    queue: string,
    message: any,
    headers?: Record<string, any>,
  ): Promise<void> {
    const options: Options.Publish = {
      // Use Options.Publish type
      persistent: true,
      headers: {
        request_id: message.request_id || headers?.request_id,
        correlation_id: headers?.correlation_id,
        timestamp: new Date().toISOString(),
        ...headers,
      },
    };

    await this.channelWrapper.sendToQueue(
      queue,
      message, // json:true handles serialization automatically
      options,
    );
  }

  async onModuleDestroy() {
    await this.channelWrapper.close();
    await this.connection.close();
  }
}
