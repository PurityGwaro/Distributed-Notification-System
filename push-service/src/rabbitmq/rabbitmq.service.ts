import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import * as amqp from 'amqplib';
import { ConfigService } from '@nestjs/config';
import { PushService } from '../push/push.service';

@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private connection: any = null;
  private channel: any = null;
  private readonly logger = new Logger(RabbitmqService.name);
  private isConnecting = false;

  // Configuration for exponential backoff
  private readonly MAX_RETRY_ATTEMPTS = 5;
  private readonly INITIAL_RETRY_DELAY = 1000; // 1 second
  private readonly MAX_RETRY_DELAY = 60000; // 60 seconds

  constructor(
    private readonly configService: ConfigService,
    private readonly pushService: PushService,
  ) {}

  async onModuleInit() {
    await this.connect();
    await this.setupQueues();
    await this.startConsuming();
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
          this.logger.warn('RabbitMQ connection closed. Reconnecting...');
          this.connection = null;
          this.channel = null;
          void this.connect();
        });

        this.connection.on('error', (err) => {
          this.logger.error('RabbitMQ connection error:', err.message);
        });

        this.channel = await this.connection.createChannel();
        this.logger.log('Connected to RabbitMQ');
      } catch (err) {
        this.logger.error(
          'RabbitMQ connection failed. Retrying in 5s...',
          err.message,
        );
        await new Promise((r) => setTimeout(r, 5000));
      }
    }

    this.isConnecting = false;
  }

  private async setupQueues() {
    if (!this.channel) {
      this.logger.warn('Channel not ready yet!');
      return;
    }

    try {
      // Create dead letter exchange
      await this.channel.assertExchange('dlx_push', 'direct', { durable: true });

      // Create dead letter queue
      await this.channel.assertQueue('push_queue_dlq', { durable: true });

      // Bind dead letter queue to exchange
      await this.channel.bindQueue('push_queue_dlq', 'dlx_push', 'push_failed');

      // Create main queue with dead letter configuration
      await this.channel.assertQueue('push_queue', {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'dlx_push',
          'x-dead-letter-routing-key': 'push_failed',
        },
      });

      this.logger.log('Queues and dead letter exchange configured successfully');
    } catch (error) {
      this.logger.error(`Failed to setup queues: ${error.message}`);
    }
  }

  private async startConsuming() {
    if (!this.channel) {
      this.logger.warn('Channel not ready yet!');
      return;
    }

    try {
      // Set prefetch to process one message at a time
      await this.channel.prefetch(1);

      // Consume messages from push_queue
      await this.channel.consume('push_queue', async (message) => {
        if (message) {
          await this.handleMessage(message);
        }
      });

      this.logger.log('Started consuming messages from push_queue');
    } catch (error) {
      this.logger.error(`Failed to start consuming: ${error.message}`);
    }
  }

  private async handleMessage(message: amqp.ConsumeMessage) {
    const content = JSON.parse(message.content.toString());

    // Extract correlation_id from message headers if available
    const correlationId =
      message.properties.headers?.['x-correlation-id'] || undefined;

    const logPrefix = `[CID:${correlationId || 'N/A'}]`;
    this.logger.log(`${logPrefix} Received message: ${JSON.stringify(content)}`);

    // Get retry count from message headers
    const retryCount = (message.properties.headers?.['x-retry-count'] as number) || 0;

    try {
      // Build payload with correlation_id
      const payload = {
        ...content,
        correlation_id: correlationId,
      };

      // Attempt to send push notification
      await this.pushService.sendPush(payload, retryCount);

      // Acknowledge message on success
      this.channel.ack(message);
      this.logger.log(`${logPrefix} Message processed successfully`);
    } catch (error) {
      this.logger.error(`${logPrefix} Failed to process message: ${error.message}`);

      // Implement exponential backoff retry logic
      if (retryCount < this.MAX_RETRY_ATTEMPTS) {
        const delay = this.calculateRetryDelay(retryCount);
        this.logger.log(
          `Retrying message (attempt ${retryCount + 1}/${this.MAX_RETRY_ATTEMPTS}) after ${delay}ms`,
        );

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Reject and requeue with incremented retry count
        this.channel.nack(message, false, false);

        // Republish with updated retry count
        await this.republishWithRetry(content, retryCount + 1);
      } else {
        // Max retries reached, send to dead letter queue
        this.logger.error(
          `Max retry attempts reached. Sending to dead letter queue.`,
        );
        this.channel.nack(message, false, false);
      }
    }
  }

  private calculateRetryDelay(retryCount: number): number {
    // Exponential backoff: delay = INITIAL_DELAY * 2^retryCount
    const delay = Math.min(
      this.INITIAL_RETRY_DELAY * Math.pow(2, retryCount),
      this.MAX_RETRY_DELAY,
    );
    return delay;
  }

  private async republishWithRetry(content: any, retryCount: number) {
    try {
      await this.channel.sendToQueue(
        'push_queue',
        Buffer.from(JSON.stringify(content)),
        {
          persistent: true,
          headers: {
            'x-retry-count': retryCount,
          },
        },
      );
      this.logger.log(`Message republished with retry count: ${retryCount}`);
    } catch (error) {
      this.logger.error(`Failed to republish message: ${error.message}`);
    }
  }

  // Safe queue creation with optional dead-letter
  async assertQueue(
    queue: string,
    options?: { deadLetterExchange?: string; deadLetterRoutingKey?: string },
  ) {
    if (!this.channel) {
      this.logger.warn('Channel not ready yet!');
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
      this.logger.warn('Channel not ready yet!');
      return;
    }

    try {
      await this.assertQueue(queue);
      this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
        persistent: true,
      });
      this.logger.log(`Message sent to queue "${queue}"`);
    } catch (err) {
      this.logger.error(`Failed to send message to "${queue}": ${err.message}`);
    }
  }

  isConnected() {
    return !!this.connection && !!this.channel;
  }

  async onModuleDestroy() {
    await this.channel?.close();
    await this.connection?.close();
    this.logger.log('RabbitMQ connection closed');
  }
}
