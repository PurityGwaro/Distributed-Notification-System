import { Injectable, OnModuleInit } from '@nestjs/common';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { EmailService } from './email.service';

@Injectable()
export class EmailConsumer implements OnModuleInit {
  constructor(
    private readonly rabbitmqService: RabbitmqService,
    private readonly emailService: EmailService,
  ) {}

  async onModuleInit() {
    await this.rabbitmqService.consume('email_queue', async (data) => {
      const { to, subject, text, html } = data;
      await this.emailService.sendEmail(to, subject, text, html);
    });
  }
}
