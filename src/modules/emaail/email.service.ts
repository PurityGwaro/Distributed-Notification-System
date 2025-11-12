import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Email } from './entities/email.entity';
import * as amqp from 'amqplib';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
  ) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('EMAIL_HOST'),
      port: this.configService.get('EMAIL_PORT'),
      secure: false,
      auth: {
        user: this.configService.get('EMAIL_USER'),
        pass: this.configService.get('EMAIL_PASS'),
      },
    });
  }

  async sendEmail(to: string, subject: string, text: string, html?: string, attempt = 1) {
  const MAX_RETRIES = 3;
  const BACKOFF_MS = 1000;

  const email = this.emailRepo.create({ to, subject, text, html, status: 'pending' });
  if (attempt === 1) await this.emailRepo.save(email);

  try {
    await this.transporter.sendMail({
      from: this.configService.get('EMAIL_FROM'),
      to,
      subject,
      text,
      html,
    });

    email.status = 'sent';
    await this.emailRepo.save(email);
    this.logger.log(`✅ Email sent to ${to}`);
  } catch (err) {
    this.logger.warn(`Attempt ${attempt} failed: ${err.message}`);

    if (attempt < MAX_RETRIES) {
      await new Promise(res => setTimeout(res, BACKOFF_MS * attempt));
      return this.sendEmail(to, subject, text, html, attempt + 1);
    } else {
      email.status = 'failed';
      await this.emailRepo.save(email);
      await this.publishToFailedQueue({ to, subject, text, html });
      this.logger.error(`❌ Email permanently failed: ${to}`);
    }
  }
}

// Publish permanently failed email to failed queue
private async publishToFailedQueue(payload: any) {
  const connection = await amqp.connect(this.configService.get('RABBITMQ_URL'));
  const channel = await connection.createChannel();
  await channel.assertQueue('failed_email_queue', { durable: true });
  channel.sendToQueue('failed_email_queue', Buffer.from(JSON.stringify(payload)), { persistent: true });
  await channel.close();
  await connection.close();
}
}