import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { RabbitMQService } from './rabbitmq.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { RedisService } from './redis.service';

@Module({
  imports: [HttpModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    RabbitMQService,
    CircuitBreakerService,
    RedisService,
  ],
})
export class NotificationModule {}