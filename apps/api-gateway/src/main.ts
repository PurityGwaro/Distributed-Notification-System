import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // Enable validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Warmup microservice connection before starting HTTP server
  // This ensures RabbitMQ is fully connected and ready
  console.log('Warming up microservice connections...');
  const microservices = app.get('USER_SERVICE');

  // Force connection by connecting
  await microservices.connect();

  // Give it a moment to fully establish
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('User Service connection ready');

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('Notification System API Gateway')
    .setDescription('API Gateway for Distributed Notification System')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('notifications', 'Notification management endpoints')
    .addTag('status', 'Status update endpoints')
    .addTag('health', 'Health check endpoints')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.API_GATEWAY_PORT || 3000;
  await app.listen(port);

  console.log(`API Gateway is running on: http://localhost:${port}`);
  console.log(`Swagger documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
