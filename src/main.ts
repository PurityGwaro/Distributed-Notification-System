import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import * as dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL!],
        queue: 'push.queue',
        queueOptions: { durable: true },
      },
    },
  );

  await app.listen();
  console.log('push Service running and listening to RabbitMQ...');
}
bootstrap();
