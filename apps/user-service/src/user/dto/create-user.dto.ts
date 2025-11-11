import { IsEmail, IsNotEmpty, IsString, MinLength, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class UserPreferenceDto {
  @ApiProperty({ example: true, description: 'Email notification preference' })
  @IsNotEmpty()
  email: boolean;

  @ApiProperty({ example: true, description: 'Push notification preference' })
  @IsNotEmpty()
  push: boolean;
}

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe', description: 'User name' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'user@example.com', description: 'User email' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({ example: 'device_push_token', description: 'Push notification token' })
  @IsOptional()
  @IsString()
  push_token?: string;

  @ApiProperty({
    type: UserPreferenceDto,
    description: 'User notification preferences',
  })
  @IsObject()
  @ValidateNested()
  @Type(() => UserPreferenceDto)
  preferences: UserPreferenceDto;

  @ApiProperty({ example: 'SecurePassword123!', description: 'User password', minLength: 6 })
  @IsNotEmpty()
  @IsString()
  @MinLength(6)
  password: string;
}
