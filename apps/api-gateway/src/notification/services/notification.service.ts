import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from './redis.service';
import { RabbitMQService } from './rabbitmq.service';
import { NotificationRequestDto } from '../dto/notification-request.dto';
import { NotificationStatusDto } from '../dto/notification-status.dto';
import {
  NotificationStatus,
  NotificationType,
} from '@common/interfaces/notification.interface';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private redisService: RedisService,
    private rabbitMQService: RabbitMQService,
  ) {}

  async createNotification(notificationDto: NotificationRequestDto) {
    // Check for idempotency
    const idempotencyKey = `notification:${notificationDto.request_id}`;
    const exists = await this.redisService.exists(idempotencyKey);

    if (exists) {
      const existingNotification = await this.redisService.get(idempotencyKey);
      throw new ConflictException({
        message: 'Notification with this request_id already exists',
        notification: existingNotification ? JSON.parse(existingNotification) : null,
      });
    }

    // Generate notification ID
    const notificationId = uuidv4();

    // Create notification payload
    const notification = {
      notification_id: notificationId,
      ...notificationDto,
      status: NotificationStatus.PENDING,
      created_at: new Date().toISOString(),
    };

    // Store in Redis for tracking
    await this.redisService.set(
      idempotencyKey,
      JSON.stringify(notification),
      86400, // 24 hours
    );

    await this.redisService.set(
      `notification:${notificationId}`,
      JSON.stringify(notification),
      86400,
    );

    // Publish to appropriate queue
    await this.rabbitMQService.publishToQueue(
      notificationDto.notification_type,
      notification,
    );

    this.logger.log(`Notification ${notificationId} created and queued`);

    return {
      notification_id: notificationId,
      status: NotificationStatus.PENDING,
      message: 'Notification queued successfully',
    };
  }

  async getNotificationStatus(notificationId: string) {
    const notification = await this.redisService.get(
      `notification:${notificationId}`,
    );

    if (!notification) {
      throw new BadRequestException('Notification not found');
    }

    return JSON.parse(notification);
  }

  async updateNotificationStatus(statusDto: NotificationStatusDto) {
    const notificationKey = `notification:${statusDto.notification_id}`;
    const notification = await this.redisService.get(notificationKey);

    if (!notification) {
      throw new BadRequestException('Notification not found');
    }

    const parsedNotification = JSON.parse(notification);
    const updatedNotification = {
      ...parsedNotification,
      status: statusDto.status,
      updated_at: statusDto.timestamp || new Date().toISOString(),
      error: statusDto.error || undefined,
    };

    await this.redisService.set(
      notificationKey,
      JSON.stringify(updatedNotification),
      86400,
    );

    this.logger.log(
      `Notification ${statusDto.notification_id} status updated to ${statusDto.status}`,
    );

    return updatedNotification;
  }

  async checkRateLimit(userId: string, limit: number = 100): Promise<boolean> {
    const rateLimitKey = `rate_limit:${userId}`;
    const count = await this.redisService.incr(rateLimitKey);

    if (count === 1) {
      await this.redisService.expire(rateLimitKey, 60); // 1 minute window
    }

    return count <= limit;
  }
}
