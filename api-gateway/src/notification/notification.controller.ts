import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import {
  CreateNotificationDto,
  UpdateStatusDto,
  ApiResponse as ApiResponseDto,
} from './dto/notification.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('notifications')
@Controller('api/v1/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send a notification (requires authentication)' })
  @ApiResponse({ status: 201, description: 'Notification queued successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async sendNotification(
    @Body() dto: CreateNotificationDto,
    @Request() req: any,
  ): Promise<ApiResponseDto<any>> {
    return this.notificationService.sendNotification(dto, req.user);
  }

  @Get('status/:notification_id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get notification status (requires authentication)',
  })
  @ApiResponse({ status: 200, description: 'Status retrieved successfully' })
  async getStatus(
    @Param('notification_id') notificationId: string,
  ): Promise<ApiResponseDto<any>> {
    return this.notificationService.getStatus(notificationId);
  }

  @Post('status')
  @ApiOperation({
    summary: 'Update notification status (internal use by worker services)',
  })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  async updateStatus(
    @Body() dto: UpdateStatusDto,
  ): Promise<ApiResponseDto<any>> {
    return this.notificationService.updateNotificationStatus(dto);
  }
}
