import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { EmailService, SendEmailPayload } from './email.service';

@Injectable()
export class EmailConsumer implements OnModuleInit {
  private readonly logger = new Logger(EmailConsumer.name);

  constructor(
    private readonly rabbitmqService: RabbitmqService,
    private readonly emailService: EmailService,
  ) {}

  async onModuleInit() {
    await this.rabbitmqService.consume('email_queue', async (data, message) => {
      // Extract correlation_id from message headers if available
      const correlationId =
        message?.properties?.headers?.['x-correlation-id'] || undefined;

      const logPrefix = `[CID:${correlationId || 'N/A'}]`;
      this.logger.log(`${logPrefix} Processing email message`);

      // Build payload with all new fields
      const payload: SendEmailPayload = {
        to: data.to,
        subject: data.subject,
        text: data.text,
        html: data.html,
        template_code: data.template_code,
        template_variables: data.template_variables,
        request_id: data.request_id,
        correlation_id: correlationId,
      };

      await this.emailService.sendEmail(payload);
    });
  }
}
