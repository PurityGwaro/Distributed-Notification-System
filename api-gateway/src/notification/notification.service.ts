import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import {
  CreateNotificationDto,
  UpdateStatusDto,
  NotificationType,
  NotificationStatus,
  ApiResponse,
} from './dto/notification.dto';
import { RabbitMQService } from './rabbitmq.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { RedisService } from './redis.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class NotificationService {
  constructor(
    private readonly httpService: HttpService,
    private readonly rabbitMQService: RabbitMQService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly redisService: RedisService,
  ) {}

  async sendNotification(
    dto: CreateNotificationDto,
    user: any,
    correlationId?: string,
  ): Promise<ApiResponse<any>> {
    try {
      // Check for duplicate request (idempotency)
      const isDuplicate = await this.redisService.checkDuplicate(
        dto.request_id,
      );
      if (isDuplicate) {
        const existingNotificationId =
          await this.redisService.getRequestMapping(dto.request_id);
        return {
          success: false,
          message: 'Duplicate request detected',
          error: 'Request already processed',
          data: { notification_id: existingNotificationId },
        };
      }

      // Validate user exists and get preferences
      const userServiceUrl =
        process.env.USER_SERVICE_URL || 'http://localhost:3001';
      const userResponse = await firstValueFrom(
        this.httpService.get(`${userServiceUrl}/api/v1/users/${dto.user_id}`),
      );

      if (!userResponse.data.success) {
        throw new BadRequestException('User not found');
      }

      const targetUser = userResponse.data.data;

      // Check authorization - users can only send notifications to themselves
      // (In production, you'd have role-based permissions)
      if (user.userId !== dto.user_id) {
        throw new ForbiddenException(
          'You can only send notifications to yourself',
        );
      }

      // Check user preferences
      if (
        dto.notification_type === NotificationType.EMAIL &&
        !targetUser.preferences.email
      ) {
        return {
          success: false,
          message: 'User has disabled email notifications',
        };
      }

      if (
        dto.notification_type === NotificationType.PUSH &&
        !targetUser.preferences.push
      ) {
        return {
          success: false,
          message: 'User has disabled push notifications',
        };
      }

      // Get template
      const templateServiceUrl =
        process.env.TEMPLATE_SERVICE_URL || 'http://localhost:3004';
      const templateResponse = await firstValueFrom(
        this.httpService.get(
          `${templateServiceUrl}/api/v1/templates/${dto.template_code}`,
        ),
      );

      if (!templateResponse.data.success) {
        throw new BadRequestException('Template not found');
      }

      // Generate notification ID
      const notificationId = uuidv4();

      // Prepare message
      const message = {
        notification_id: notificationId,
        request_id: dto.request_id,
        user_id: dto.user_id,
        user_email: targetUser.email,
        user_push_token: targetUser.push_token,
        template: templateResponse.data.data,
        variables: dto.variables,
        priority: dto.priority,
        metadata: dto.metadata,
        timestamp: new Date().toISOString(),
      };

      // Route to appropriate queue
      const queue =
        dto.notification_type === NotificationType.EMAIL
          ? 'email_queue'
          : 'push_queue';

      await this.circuitBreaker.execute(async () => {
        await this.rabbitMQService.publishToQueue(queue, message, {
          correlation_id: correlationId,
          request_id: dto.request_id,
        });
      }, 'rabbitmq');

      // Mark request as processed
      await this.redisService.markProcessed(dto.request_id, notificationId);

      // Store initial status
      await this.redisService.setStatus(notificationId, {
        status: NotificationStatus.PENDING,
        created_at: new Date().toISOString(),
        notification_type: dto.notification_type,
        user_id: dto.user_id,
      });

      return {
        success: true,
        message: 'Notification queued successfully',
        data: {
          notification_id: notificationId,
          status: NotificationStatus.PENDING,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to queue notification',
        error: error.message,
      };
    }
  }

  async getStatus(notificationId: string): Promise<ApiResponse<any>> {
    try {
      const status = await this.redisService.getStatus(notificationId);

      if (!status) {
        return {
          success: false,
          message: 'Notification not found',
        };
      }

      return {
        success: true,
        message: 'Status retrieved successfully',
        data: status,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to get status',
        error: error.message,
      };
    }
  }

  async updateNotificationStatus(
    dto: UpdateStatusDto,
  ): Promise<ApiResponse<any>> {
    try {
      const currentStatus = await this.redisService.getStatus(
        dto.notification_id,
      );

      if (!currentStatus) {
        return {
          success: false,
          message: 'Notification not found',
        };
      }

      const updatedStatus = {
        ...currentStatus,
        status: dto.status,
        updated_at: new Date().toISOString(),
        error: dto.error,
        metadata: dto.metadata,
      };

      await this.redisService.setStatus(dto.notification_id, updatedStatus);

      return {
        success: true,
        message: 'Status updated successfully',
        data: updatedStatus,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to update status',
        error: error.message,
      };
    }
  }
}
