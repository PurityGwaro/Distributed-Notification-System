import { IsEmail, IsString, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

class UserPreferenceDto {
  @ApiPropertyOptional({ example: true, description: 'Email notification preference' })
  @IsOptional()
  email?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Push notification preference' })
  @IsOptional()
  push?: boolean;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'John Doe', description: 'User name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'user@example.com', description: 'User email' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'device_push_token', description: 'Push notification token' })
  @IsOptional()
  @IsString()
  push_token?: string;

  @ApiPropertyOptional({
    type: UserPreferenceDto,
    description: 'User notification preferences',
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UserPreferenceDto)
  preferences?: UserPreferenceDto;
}
