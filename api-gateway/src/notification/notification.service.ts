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
  ): Promise<ApiResponse<any>> {
    try {
      console.log('=== NOTIFICATION REQUEST START ===');
      console.log('User:', user);
      console.log('DTO:', dto);

      // Check for duplicate
      console.log('Checking duplicate for request_id:', dto.request_id);
      const isDuplicate = await this.redisService.checkDuplicate(
        dto.request_id,
      );
      if (isDuplicate) {
        console.log('Duplicate detected!');
        const existingNotificationId =
          await this.redisService.getRequestMapping(dto.request_id);
        return {
          success: false,
          message: 'Duplicate request detected',
          error: 'Request already processed',
          data: { notification_id: existingNotificationId },
        };
      }

      // Validate user
      const userServiceUrl =
        process.env.USER_SERVICE_URL || 'http://localhost:3001';
      console.log('USER_SERVICE_URL:', userServiceUrl);
      console.log('Fetching user:', dto.user_id);

      let userResponse;
      try {
        userResponse = await firstValueFrom(
          this.httpService.get(`${userServiceUrl}/api/v1/users/${dto.user_id}`),
        );
        console.log('User fetched successfully:', userResponse.data);
      } catch (error: any) {
        console.error('❌ USER SERVICE ERROR:', error.message);
        console.error('Error details:', error.response?.data || error);
        throw new Error(`Failed to fetch user: ${error.message}`);
      }

      if (!userResponse.data.success) {
        console.error('User not found in response');
        throw new BadRequestException('User not found');
      }

      const targetUser = userResponse.data.data;
      console.log('Target user:', targetUser);

      // Check authorization
      console.log('Checking authorization:', user.userId, 'vs', dto.user_id);
      if (user.userId !== dto.user_id) {
        console.error('Authorization failed!');
        throw new ForbiddenException(
          'You can only send notifications to yourself',
        );
      }

      // Check preferences
      console.log('Checking user preferences:', targetUser.preferences);
      if (
        dto.notification_type === NotificationType.EMAIL &&
        !targetUser.preferences.email
      ) {
        console.log('User has disabled email notifications');
        return {
          success: false,
          message: 'User has disabled email notifications',
        };
      }

      // Get template
      const templateServiceUrl =
        process.env.TEMPLATE_SERVICE_URL || 'http://localhost:3004';
      console.log('TEMPLATE_SERVICE_URL:', templateServiceUrl);
      console.log('Fetching template:', dto.template_code);

      let templateResponse;
      try {
        templateResponse = await firstValueFrom(
          this.httpService.get(
            `${templateServiceUrl}/api/v1/templates/${dto.template_code}`,
          ),
        );
        console.log('Template fetched successfully:', templateResponse.data);
      } catch (error: any) {
        console.error('❌ TEMPLATE SERVICE ERROR:', error.message);
        console.error('Error details:', error.response?.data || error);
        throw new Error(`Failed to fetch template: ${error.message}`);
      }

      if (!templateResponse.data.success) {
        console.error('Template not found in response');
        throw new BadRequestException('Template not found');
      }

      // Generate notification ID
      const notificationId = uuidv4();
      console.log('Generated notification_id:', notificationId);

      // Prepare message
      const message = {
        notification_id: notificationId,
        user_id: dto.user_id,
        user_email: targetUser.email,
        user_push_token: targetUser.push_token,
        template: templateResponse.data.data,
        variables: dto.variables,
        priority: dto.priority,
        metadata: dto.metadata,
        timestamp: new Date().toISOString(),
      };
      console.log('Message prepared:', message);

      // Route to queue
      const queue =
        dto.notification_type === NotificationType.EMAIL
          ? 'email.queue'
          : 'push.queue';
      console.log('Publishing to queue:', queue);

      try {
        await this.circuitBreaker.execute(async () => {
          await this.rabbitMQService.publishToQueue(queue, message);
        }, 'rabbitmq');
        console.log('✅ Message published to queue successfully');
      } catch (error: any) {
        console.error('❌ RABBITMQ ERROR:', error.message);
        throw new Error(`Failed to publish to queue: ${error.message}`);
      }

      // Mark as processed
      console.log('Marking request as processed');
      await this.redisService.markProcessed(dto.request_id, notificationId);

      // Store status
      console.log('Storing initial status');
      await this.redisService.setStatus(notificationId, {
        status: NotificationStatus.PENDING,
        created_at: new Date().toISOString(),
        notification_type: dto.notification_type,
        user_id: dto.user_id,
      });

      console.log('=== NOTIFICATION REQUEST SUCCESS ===');
      return {
        success: true,
        message: 'Notification queued successfully',
        data: {
          notification_id: notificationId,
          status: NotificationStatus.PENDING,
        },
      };
    } catch (error: any) {
      console.error('=== NOTIFICATION REQUEST FAILED ===');
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);

      return {
        success: false,
        message: 'Failed to queue notification',
        error: error.message || 'Unknown error',
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
