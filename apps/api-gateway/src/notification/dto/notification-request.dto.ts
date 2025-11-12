import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsObject,
  IsInt,
  Min,
  Max,
  IsOptional,
  ValidateNested,
  IsUrl,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@common/interfaces/notification.interface';

class UserDataDto {
  @ApiProperty({ example: 'John Doe', description: 'User name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    example: 'https://example.com/verify',
    description: 'Link for the notification',
  })
  @IsUrl()
  @IsNotEmpty()
  link: string;

  @ApiPropertyOptional({
    example: { custom_field: 'value' },
    description: 'Additional metadata',
  })
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}

export class NotificationRequestDto {
  @ApiProperty({
    enum: NotificationType,
    example: NotificationType.EMAIL,
    description: 'Type of notification',
  })
  @IsEnum(NotificationType)
  @IsNotEmpty()
  notification_type: NotificationType;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'User ID',
  })
  @IsNotEmpty()
  @IsString()
  user_id: string;

  @ApiProperty({
    example: 'welcome_email',
    description: 'Template code or path',
  })
  @IsNotEmpty()
  @IsString()
  template_code: string;

  @ApiProperty({
    type: UserDataDto,
    description: 'User data for template variables',
  })
  @ValidateNested()
  @Type(() => UserDataDto)
  @IsNotEmpty()
  variables: UserDataDto;

  @ApiProperty({
    example: 'req_123456789',
    description: 'Unique request ID for idempotency',
  })
  @IsNotEmpty()
  @IsString()
  request_id: string;

  @ApiProperty({
    example: 1,
    description: 'Priority level (1-10)',
    minimum: 1,
    maximum: 10,
  })
  @IsInt()
  @Min(1)
  @Max(10)
  priority: number;

  @ApiPropertyOptional({
    example: { campaign: 'summer_sale' },
    description: 'Additional metadata',
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
