import { Module } from '@nestjs/common';
import { PushModule } from './push/push.module';
import { HealthModule } from './health/health.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule, PushModule, HealthModule],
})
export class AppModule {}