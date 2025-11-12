import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationStatus } from '@common/interfaces/notification.interface';

export class NotificationStatusDto {
  @ApiProperty({
    example: 'notif_123456789',
    description: 'Notification ID',
  })
  @IsNotEmpty()
  @IsString()
  notification_id: string;

  @ApiProperty({
    enum: NotificationStatus,
    example: NotificationStatus.DELIVERED,
    description: 'Notification status',
  })
  @IsEnum(NotificationStatus)
  @IsNotEmpty()
  status: NotificationStatus;

  @ApiPropertyOptional({
    example: '2025-11-10T12:00:00Z',
    description: 'Timestamp of status update',
  })
  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @ApiPropertyOptional({
    example: 'Failed to send email',
    description: 'Error message if failed',
  })
  @IsOptional()
  @IsString()
  error?: string;
}
