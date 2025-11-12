import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsObject,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendEmailDto {
  @ApiProperty({
    description: 'Recipient email address',
    example: 'user@example.com',
  })
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @ApiProperty({
    description: 'Email subject (required if not using template)',
    example: 'Welcome to our service',
    required: false,
  })
  @IsString()
  @IsOptional()
  @ValidateIf((o) => !o.template_code)
  @IsNotEmpty()
  subject?: string;

  @ApiProperty({
    description: 'Plain text email body (required if not using template)',
    example: 'Hello, welcome to our service!',
    required: false,
  })
  @IsString()
  @IsOptional()
  text?: string;

  @ApiProperty({
    description: 'HTML email body (optional)',
    example: '<p>Hello, <strong>welcome</strong> to our service!</p>',
    required: false,
  })
  @IsString()
  @IsOptional()
  html?: string;

  @ApiProperty({
    description: 'Template code to use for email content',
    example: 'welcome_email',
    required: false,
  })
  @IsString()
  @IsOptional()
  template_code?: string;

  @ApiProperty({
    description: 'Variables to replace in template',
    example: { name: 'John Doe', link: 'https://example.com/verify' },
    required: false,
  })
  @IsObject()
  @IsOptional()
  template_variables?: Record<string, any>;

  @ApiProperty({
    description: 'Unique request ID for idempotency',
    example: 'req-123-abc',
    required: false,
  })
  @IsString()
  @IsOptional()
  request_id?: string;

  @ApiProperty({
    description: 'Correlation ID for request tracing',
    example: 'trace-456-def',
    required: false,
  })
  @IsString()
  @IsOptional()
  correlation_id?: string;
}
