import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailService } from './email.service';
import { EmailConsumer } from './email.consumer';
import { EmailController } from './email.controller';
import { Email } from './entities/email.entity';
import { RabbitmqModule } from '../rabbitmq/rabbitmq.module';
import { TemplateClientService } from '../../common/services/template-client.service';

@Module({
  imports: [RabbitmqModule, TypeOrmModule.forFeature([Email])],
  controllers: [EmailController],
  providers: [EmailService, EmailConsumer, TemplateClientService],
})
export class EmailModule {}
