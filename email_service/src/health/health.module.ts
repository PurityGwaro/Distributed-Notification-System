import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { RabbitmqModule } from '../modules/rabbitmq/rabbitmq.module';

@Module({
  imports: [TerminusModule, RabbitmqModule],
  controllers: [HealthController],
})
export class HealthModule {}
