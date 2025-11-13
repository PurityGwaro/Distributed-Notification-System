import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { HealthModule } from './health/health.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [HttpModule, EmailModule, HealthModule],
})
export class AppModule {}