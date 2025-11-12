import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { RabbitmqModule } from './modules/rabbitmq/rabbitmq.module';
import { ConfigModule } from '@nestjs/config';
import { EmailModule } from './modules/emaail/email.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Email } from './modules/emaail/entities/email.entity';

@Module({
  imports: [
    // Load environment variables globally
    ConfigModule.forRoot({ isGlobal: true }),

    // TypeORM setup for production
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT!,
      username: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
      entities: [Email], // you can also use glob pattern like __dirname + '/**/*.entity{.ts,.js}'
      synchronize: false, // ⚠️ disable in production
      logging: ['error'], // log only errors in production
    }),

    // RabbitMQ service module
    RabbitmqModule,

    // Feature module containing EmailService
    EmailModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
