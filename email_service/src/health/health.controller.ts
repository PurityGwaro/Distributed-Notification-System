import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckService,
  HealthCheck,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ConfigService } from '@nestjs/config';
import { RabbitmqService } from '../modules/rabbitmq/rabbitmq.service';
import * as nodemailer from 'nodemailer';

interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  checks: {
    rabbitmq: 'up' | 'down';
    database: 'up' | 'down';
    smtp: 'up' | 'down';
  };
  timestamp: string;
}

@Controller('health')
export class HealthController {
  private transporter: nodemailer.Transporter;

  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private rabbitmqService: RabbitmqService,
    private configService: ConfigService,
  ) {
    // Initialize SMTP transporter for health checks
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

  @Get()
  @HealthCheck()
  async check(): Promise<HealthCheckResponse> {
    const checks = {
      rabbitmq: 'down' as 'up' | 'down',
      database: 'down' as 'up' | 'down',
      smtp: 'down' as 'up' | 'down',
    };

    // Check RabbitMQ connection
    try {
      const isConnected = this.rabbitmqService.isConnected();
      checks.rabbitmq = isConnected ? 'up' : 'down';
    } catch {
      checks.rabbitmq = 'down';
    }

    // Check Database connection
    try {
      await this.db.pingCheck('database');
      checks.database = 'up';
    } catch {
      checks.database = 'down';
    }

    // Check SMTP server connectivity
    try {
      await this.transporter.verify();
      checks.smtp = 'up';
    } catch {
      checks.smtp = 'down';
    }

    // Determine overall health status
    const allHealthy = Object.values(checks).every((check) => check === 'up');
    const status = allHealthy ? 'healthy' : 'unhealthy';

    return {
      status,
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('terminus')
  @HealthCheck()
  async terminusCheck() {
    return this.health.check([
      () => this.db.pingCheck('database'),
      () => this.checkRabbitMQ(),
      () => this.checkSMTP(),
    ]);
  }

  /**
   * Custom RabbitMQ health indicator
   */
  private async checkRabbitMQ(): Promise<{
    rabbitmq: { status: 'up' | 'down' };
  }> {
    const isHealthy = this.rabbitmqService.isConnected();
    if (!isHealthy) {
      throw new Error('RabbitMQ connection is not established');
    }
    return {
      rabbitmq: {
        status: 'up' as const,
      },
    };
  }

  /**
   * Custom SMTP health indicator
   */
  private async checkSMTP(): Promise<{ smtp: { status: 'up' | 'down' } }> {
    try {
      await this.transporter.verify();
      return {
        smtp: {
          status: 'up' as const,
        },
      };
    } catch (error) {
      throw new Error(`SMTP server is unreachable: ${error.message}`);
    }
  }
}
