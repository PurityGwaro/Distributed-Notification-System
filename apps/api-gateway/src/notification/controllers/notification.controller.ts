import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { NotificationService } from '../services/notification.service';
import { NotificationRequestDto } from '../dto/notification-request.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { User } from '@common/interfaces/user.interface';

@ApiTags('notifications')
@Controller('api/v1/notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new notification request' })
  @ApiResponse({ status: 201, description: 'Notification queued successfully' })
  @ApiResponse({ status: 409, description: 'Duplicate request_id' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async createNotification(
    @Body() notificationDto: NotificationRequestDto,
    @CurrentUser() user: User,
  ) {
    // Check rate limit
    const rateLimitAllowed = await this.notificationService.checkRateLimit(
      user.id,
      100,
    );

    if (!rateLimitAllowed) {
      throw new BadRequestException(
        'Rate limit exceeded. Please try again later.',
      );
    }

    const result =
      await this.notificationService.createNotification(notificationDto);

    return {
      success: true,
      message: result.message,
      data: result,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get notification status by ID' })
  @ApiResponse({ status: 200, description: 'Notification status retrieved' })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async getNotificationStatus(@Param('id') id: string) {
    const notification =
      await this.notificationService.getNotificationStatus(id);

    return {
      success: true,
      message: 'Notification status retrieved successfully',
      data: notification,
    };
  }
}
