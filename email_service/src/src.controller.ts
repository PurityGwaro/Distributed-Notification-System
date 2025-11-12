import { Controller, Get } from '@nestjs/common';
import { RabbitmqService } from './modules/rabbitmq/rabbitmq.service';
import { DataSource } from 'typeorm';

@Controller()
export class AppController {
  constructor(
    private readonly rabbitmqService: RabbitmqService,
    private readonly dataSource: DataSource,
  ) {}

  @Get('health')
  async healthCheck() {
    try {
      // Check DB connection
      await this.dataSource.query('SELECT 1');

      // Check RabbitMQ connection (simple ping)
      if (!this.rabbitmqService.isConnected()) {
        throw new Error('RabbitMQ not connected');
      }

      return { status: 'ok', db: true, rabbitmq: true };
    } catch (err) {
      return { status: 'error', message: err.message };
    }
  }
}
