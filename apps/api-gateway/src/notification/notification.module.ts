import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { NotificationController } from './controllers/notification.controller';
import { StatusController } from './controllers/status.controller';
import { NotificationService } from './services/notification.service';
import { RedisService } from './services/redis.service';
import { RabbitMQService } from './services/rabbitmq.service';
import { JwtStrategy } from '../common/strategies/jwt.strategy';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'your-secret-key-change-this-in-production',
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') || '1d') as any,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [NotificationController, StatusController],
  providers: [NotificationService, RedisService, RabbitMQService, JwtStrategy],
  exports: [NotificationService, RedisService, RabbitMQService],
})
export class NotificationModule {}
