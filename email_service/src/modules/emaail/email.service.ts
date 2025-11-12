import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Email } from './entities/email.entity';
import * as amqp from 'amqplib';
import { CircuitBreakerService } from '../../common/circuit-breaker.service';
import { TemplateClientService } from '../../common/services/template-client.service';

export interface SendEmailPayload {
  to: string;
  subject?: string;
  text?: string;
  html?: string;
  template_code?: string;
  template_variables?: Record<string, any>;
  request_id?: string;
  correlation_id?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;
  private circuitBreaker: CircuitBreakerService;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Email)
    private readonly emailRepo: Repository<Email>,
    private readonly templateClient: TemplateClientService,
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

    // Initialize circuit breaker with custom settings
    this.circuitBreaker = new CircuitBreakerService({
      failureThreshold: 5, // Open circuit after 5 consecutive failures
      resetTimeout: 30000, // Try half-open after 30 seconds
      successThreshold: 2, // Close circuit after 2 successes in half-open
    });
  }

  /**
   * Send email with idempotency and template support
   */
  async sendEmail(payload: SendEmailPayload, attempt = 1): Promise<Email> {
    const MAX_RETRIES = 3;
    const BACKOFF_MS = 1000;

    const correlationId = payload.correlation_id || 'N/A';
    const logPrefix = `[CID:${correlationId}]`;

    // Check for idempotency - if request_id exists, return existing result
    if (payload.request_id) {
      const existing = await this.emailRepo.findOne({
        where: { request_id: payload.request_id },
      });

      if (existing) {
        this.logger.log(
          `${logPrefix} Duplicate request detected: ${payload.request_id}. Returning existing result.`,
        );
        return existing;
      }
    }

    // Process template if template_code is provided
    let subject = payload.subject || '';
    let text = payload.text || '';
    let html = payload.html || '';

    if (payload.template_code) {
      try {
        const processed = await this.templateClient.processTemplate(
          payload.template_code,
          payload.template_variables || {},
          correlationId,
        );

        subject = processed.subject;
        // For email, content can be used as both text and html
        text = processed.content;
        html = processed.content;

        this.logger.log(
          `${logPrefix} Template ${payload.template_code} processed successfully`,
        );
      } catch (error) {
        this.logger.error(
          `${logPrefix} Template processing failed: ${error.message}`,
          error.stack,
        );
        throw error;
      }
    }

    // Validate required fields
    if (!subject || (!text && !html)) {
      throw new Error('Subject and content (text or html) are required');
    }

    // Create email record
    const email = this.emailRepo.create({
      to: payload.to,
      subject,
      text,
      html,
      status: 'pending',
      request_id: payload.request_id,
      template_code: payload.template_code,
      template_variables: payload.template_variables,
      correlation_id: correlationId,
    });

    if (attempt === 1) {
      await this.emailRepo.save(email);
    }

    try {
      // Use circuit breaker to protect SMTP calls
      await this.circuitBreaker.execute(async () => {
        await this.transporter.sendMail({
          from: this.configService.get('EMAIL_FROM'),
          to: payload.to,
          subject,
          text,
          html,
        });
      });

      email.status = 'sent';
      await this.emailRepo.save(email);
      this.logger.log(`${logPrefix} Email sent to ${payload.to}`);
      return email;
    } catch (err) {
      // Check if circuit breaker is open
      const circuitState = this.circuitBreaker.getState();
      if (err.message.includes('Circuit breaker is OPEN')) {
        this.logger.error(
          `${logPrefix} Circuit breaker is OPEN. Email to ${payload.to} rejected. State: ${circuitState}`,
        );
        email.status = 'failed';
        await this.emailRepo.save(email);
        await this.publishToFailedQueue(payload);
        throw err; // Propagate circuit breaker error
      }

      this.logger.warn(
        `${logPrefix} Attempt ${attempt} failed: ${err.message}`,
      );

      if (attempt < MAX_RETRIES) {
        await new Promise((res) => setTimeout(res, BACKOFF_MS * attempt));
        return this.sendEmail(payload, attempt + 1);
      } else {
        email.status = 'failed';
        await this.emailRepo.save(email);
        await this.publishToFailedQueue(payload);
        this.logger.error(
          `${logPrefix} Email permanently failed: ${payload.to}`,
        );
        throw new Error(`Email delivery failed after ${MAX_RETRIES} attempts`);
      }
    }
  }

  /**
   * Backward compatibility method
   */
  async sendEmailLegacy(
    to: string,
    subject: string,
    text: string,
    html?: string,
    attempt = 1,
  ): Promise<Email> {
    return this.sendEmail({ to, subject, text, html }, attempt);
  }

  // Publish permanently failed email to failed queue
  private async publishToFailedQueue(payload: any) {
    const connection = await amqp.connect(
      this.configService.get('RABBITMQ_URL'),
    );
    const channel = await connection.createChannel();
    await channel.assertQueue('failed_email_queue', { durable: true });
    channel.sendToQueue(
      'failed_email_queue',
      Buffer.from(JSON.stringify(payload)),
      { persistent: true },
    );
    await channel.close();
    await connection.close();
  }

  /**
   * Get circuit breaker statistics
   */
  getCircuitBreakerStats() {
    return this.circuitBreaker.getStats();
  }

  /**
   * Manually reset circuit breaker (for admin/debug purposes)
   */
  resetCircuitBreaker() {
    this.circuitBreaker.reset();
    this.logger.log('Circuit breaker has been manually reset');
  }
}
