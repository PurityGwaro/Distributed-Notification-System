import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';
import { RabbitmqService } from './modules/rabbitmq/rabbitmq.service';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Notification Email Service')
    .setDescription('Email microservice API docs')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Send a test message via RabbitMQ
  const rabbit = app.get(RabbitmqService);

  if (rabbit.isConnected()) {
    await rabbit.sendToQueue('email_queue', {
      to: 'someone@example.com',
      subject: 'Hello from NestJS!',
      text: 'This is a test email sent via RabbitMQ!',
    });
  } else {
    console.warn('rabbitMQ service not connected yet!');
  }

  await app.listen(3000);
  console.log(' App running on http://localhost:3000');
}

bootstrap();
