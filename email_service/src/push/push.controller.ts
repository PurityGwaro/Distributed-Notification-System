import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { PushService } from './push.service';

@Controller()
export class PushController {
  private readonly logger = new Logger(PushController.name);

  constructor(private readonly pushService: PushService) {}

  // RabbitMQ will send messages with pattern 'push_notification'
  @MessagePattern('push_notification')
  async handlePush(@Payload() data: any) {
    this.logger.log(`Message received from queue: ${JSON.stringify(data)}`);
    return this.pushService.sendPush(data);
  }
}
