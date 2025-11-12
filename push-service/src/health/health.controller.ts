import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly rabbitmqService: RabbitmqService) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  getHealth() {
    const isRabbitConnected = this.rabbitmqService.isConnected();

    return {
      status: 'ok',
      service: 'push-service',
      timestamp: new Date().toISOString(),
      rabbitmq: {
        connected: isRabbitConnected,
        status: isRabbitConnected ? 'healthy' : 'unhealthy',
      },
    };
  }
}
