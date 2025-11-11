import {
  Controller,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { NotificationService } from '../services/notification.service';
import { NotificationStatusDto } from '../dto/notification-status.dto';

@ApiTags('status')
@Controller('api/v1')
export class StatusController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post(':notification_type/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update notification status (for internal service use)',
  })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async updateStatus(
    @Param('notification_type') notificationType: string,
    @Body() statusDto: NotificationStatusDto,
  ) {
    const notification =
      await this.notificationService.updateNotificationStatus(statusDto);

    return {
      success: true,
      message: 'Notification status updated successfully',
      data: notification,
    };
  }
}
