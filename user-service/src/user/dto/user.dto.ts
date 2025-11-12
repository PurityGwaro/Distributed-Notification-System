import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
  MinLength,
} from 'class-validator';

export class UserPreference {
  @ApiProperty({ default: true })
  @IsBoolean()
  email: boolean;

  @ApiProperty({ default: true })
  @IsBoolean()
  push: boolean;
}

export class CreateUserDto {
  @ApiProperty({ example: 'John Doe' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  push_token?: string;

  @ApiProperty({
    example: { email: true, push: true },
    default: { email: true, push: true },
  })
  @IsObject()
  preferences: UserPreference;

  @ApiProperty({ example: 'password123', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;
}

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  push_token?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  preferences?: UserPreference;
}

export class LoginDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  password: string;
}
