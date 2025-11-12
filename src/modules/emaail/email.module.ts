import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from './email.service';
import { EmailConsumer } from './email.consumer';
import { Email } from './entities/email.entity';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [RabbitmqModule, TypeOrmModule.forFeature([Email])],
  providers: [EmailService, EmailConsumer],
})
export class EmailModule {}
