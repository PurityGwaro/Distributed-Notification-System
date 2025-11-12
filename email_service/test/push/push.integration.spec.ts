import { Test, TestingModule } from '@nestjs/testing';
import { PushModule } from '../../src/push/push.module';
import { PushService } from '../../src/push/push.service';
import { INestMicroservice } from '@nestjs/common';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import * as amqp from 'amqplib';
import { DatabaseModule } from '../../src/database/database.module';
import { Repository } from 'typeorm';
import { Notification } from '../../src/database/entities/notification.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('PushService Integration', () => {
  let app: INestMicroservice;
  let _service: PushService;
  let repo: Repository<Notification>;
  let channel: amqp.Channel;

  const testQueue = 'push.queue';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [DatabaseModule, PushModule],
    }).compile();

    app = module.createNestMicroservice<MicroserviceOptions>({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
        queue: testQueue,
        queueOptions: { durable: true },
      },
    });

    _service = module.get<PushService>(PushService);
    repo = module.get<Repository<Notification>>(
      getRepositoryToken(Notification),
    );

    await app.listen();

    // Setup RabbitMQ channel for test
    const connection = await amqp.connect(
      process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
    );
    channel = await connection.createChannel();
    await channel.assertQueue(testQueue, { durable: true });
  });

  afterAll(async () => {
    await app.close();
    await channel.close();
  });

  it('should receive a message and save notification', async () => {
    const payload = {
      device_token: 'integration-token',
      title: 'Integration Test',
      body: 'Hello',
      data: { test: 'yes' },
    };

    // Send test message
    channel.sendToQueue(testQueue, Buffer.from(JSON.stringify(payload)), {
      persistent: true,
    });

    // Poll DB until message is saved
    let notif;
    const maxAttempts = 50; // max 10 seconds
    let attempts = 0;
    while (!notif && attempts < maxAttempts) {
      notif = await repo.findOne({
        where: { device_token: 'integration-token' },
      });
      if (!notif) await new Promise((res) => setTimeout(res, 200)); // wait 200ms
      attempts++;
    }
    expect(notif).toBeDefined();
    expect(notif.title).toBe('payload.title');
    expect(['sent', 'failed']).toContain(notif.status);
  });
});
