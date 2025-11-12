import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsUUID,
  IsString,
  IsOptional,
  IsInt,
  IsObject,
} from 'class-validator';

export enum NotificationType {
  EMAIL = 'email',
  PUSH = 'push',
}

export enum NotificationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

export class UserData {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  link: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}

export class CreateNotificationDto {
  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  notification_type: NotificationType;

  @ApiProperty()
  @IsUUID()
  user_id: string;

  @ApiProperty()
  @IsString()
  template_code: string;

  @ApiProperty()
  @IsObject()
  variables: UserData;

  @ApiProperty()
  @IsString()
  request_id: string;

  @ApiProperty({ default: 1 })
  @IsInt()
  priority: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class UpdateStatusDto {
  @ApiProperty()
  @IsString()
  notification_id: string;

  @ApiProperty({ enum: NotificationStatus })
  @IsEnum(NotificationStatus)
  status: NotificationStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  error?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class ApiResponse<T> {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ required: false })
  data?: T;

  @ApiProperty({ required: false })
  error?: string;

  @ApiProperty()
  message: string;
}
