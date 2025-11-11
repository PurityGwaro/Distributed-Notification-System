import { Controller, Logger } from '@nestjs/common';
import { EventPattern } from '@nestjs/microservices';
import { PushNotificationsService, NotificationPayload } from './push_notifications.service';

@Controller()
export class PushNotificationsController {
  private readonly logger = new Logger(PushNotificationsController.name);

  constructor(private readonly pushService: PushNotificationsService) {}

  @EventPattern('send_push_notification')
  async handlePushNotification(payload: NotificationPayload) {
    this.logger.log(`Received notification for token: ${payload.deviceToken}`);
    await this.pushService.sendNotification(payload);
  }
      }
