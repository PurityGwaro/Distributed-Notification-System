import { Controller, Logger, Get, Param } from '@nestjs/common';
import { PushService } from './push.service';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { ApiResponseDto } from '../common/dto/api-response.dto';

@ApiTags('push')
@Controller('push')
export class PushController {
  private readonly logger = new Logger(PushController.name);

  constructor(private readonly pushService: PushService) {}

  @Get('notification/:id')
  @ApiOperation({ summary: 'Get notification status by ID' })
  @ApiParam({ name: 'id', description: 'Notification ID' })
  async getNotificationStatus(@Param('id') id: string) {
    try {
      const notification = await this.pushService.getNotificationStatus(id);
      if (!notification) {
        return ApiResponseDto.error('Notification not found', 'Not found');
      }
      return ApiResponseDto.success(
        notification,
        'Notification retrieved successfully',
      );
    } catch (error) {
      return ApiResponseDto.error(
        error.message,
        'Failed to retrieve notification',
      );
    }
  }

  @Get('notifications/status/:status')
  @ApiOperation({ summary: 'Get notifications by status' })
  @ApiParam({ name: 'status', description: 'Status (pending, sent, failed)' })
  async getNotificationsByStatus(@Param('status') status: string) {
    try {
      const notifications =
        await this.pushService.getNotificationsByStatus(status);
      return ApiResponseDto.success(
        notifications,
        `Retrieved ${notifications.length} notifications with status: ${status}`,
      );
    } catch (error) {
      return ApiResponseDto.error(
        error.message,
        'Failed to retrieve notifications',
      );
    }
  }
}
