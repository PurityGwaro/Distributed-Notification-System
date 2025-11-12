import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import * as amqp from 'amqplib';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private connection: any = null;
  private channel: any = null;
  private readonly logger = new Logger(RabbitmqService.name);
  private isConnecting = false;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    await this.connect();
  }

  private async connect() {
    if (this.isConnecting) return;
    this.isConnecting = true;

    const rabbitUrl =
      this.configService.get<string>('RABBITMQ_URL') || 'amqp://localhost:5672';

    while (!this.connection) {
      try {
        this.connection = await amqp.connect(rabbitUrl);
        this.connection.on('close', () => {
          this.logger.warn('abbitMQ connection closed. Reconnecting...');
          this.connection = null;
          this.channel = null;
          void this.connect();
        });

        this.connection.on('error', (err) => {
          this.logger.error('rabbitMQ connection error:', err.message);
        });

        this.channel = await this.connection.createChannel();
        this.logger.log('Connected to RabbitMQ');
      } catch (err) {
        this.logger.error(
          'rabbitMQ connection failed. Retrying in 5s...',
          err.message,
        );
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    this.isConnecting = false;
  }

  // Safe queue creation with optional dead-letter
  async assertQueue(
    queue: string,
    options?: { deadLetterExchange?: string; deadLetterRoutingKey?: string },
  ) {
    if (!this.channel) {
      this.logger.warn('channel not ready yet!');
      return;
    }

    const args: any = {};
    if (options?.deadLetterExchange)
      args['x-dead-letter-exchange'] = options.deadLetterExchange;
    if (options?.deadLetterRoutingKey)
      args['x-dead-letter-routing-key'] = options.deadLetterRoutingKey;

    await this.channel.assertQueue(queue, { durable: true, arguments: args });
  }

  // Send message with error handling
  async sendToQueue(queue: string, message: any) {
    if (!this.channel) {
      this.logger.warn('channel not ready yet!');
      return;
    }

    try {
      await this.assertQueue(queue); // safe in dev; remove in prod if queues pre-created
      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        persistent: true,
      });
      this.logger.log(`message sent to queue "${queue}"`);
    } catch (err) {
      this.logger.error(`failed to send message to "${queue}": ${err.message}`);
    }
  }

  // Consume messages with callback and prefetch control
  async consume(
    queue: string,
    callback: (msg: any) => Promise<void> | void,
    prefetch = 5,
  ) {
    if (!this.channel) {
      this.logger.warn('channel not ready yet!');
      return;
    }

    await this.assertQueue(queue); // ensure queue exists
    await this.channel.prefetch(prefetch);

    await this.channel.consume(queue, (message) => {
      if (message) {
        void (async () => {
          try {
            const content = JSON.parse(message.content.toString());
            await callback(content);
            this.channel.ack(message);
          } catch (err) {
            this.logger.error('failed to process message:', err.message);
            this.channel.nack(message, false, false); // discard or send to DLX
          }
        })();
      }
    });

    this.logger.log(`listening to queue "${queue}" with prefetch=${prefetch}`);
  }

  isConnected() {
    return !!this.connection && !!this.channel;
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
    this.logger.log('rabbitMQ connection closed');
  }
}
