import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RabbitmqModule } from './rabbitmq/rabbitmq.module';
import { ConfigModule } from '@nestjs/config';
import { PushModule } from './push/push.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './database/entities/notification.entity';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({ isGlobal: true }),

    // TypeORM setup for production
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [Notification],
      synchronize: process.env.NODE_ENV !== 'production',
      logging: ['error'],
    }),

    // RabbitMQ service module
    RabbitmqModule,

    // Push notification module
    PushModule,

    // Health check module
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
