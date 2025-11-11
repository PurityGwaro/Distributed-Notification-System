import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  HttpException,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { firstValueFrom } from 'rxjs';
import { LoginDto } from '../dto/login.dto';

@ApiTags('auth')
@Controller('api/v1/auth')
export class AuthProxyController {
  constructor(
    @Inject('USER_SERVICE') private readonly userServiceClient: ClientProxy,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'User login' })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async login(@Body() loginDto: LoginDto) {
    try {
      const response = await firstValueFrom(
        this.userServiceClient.send({ cmd: 'login' }, loginDto),
      );
      return response;
    } catch (error) {
      console.error('Login error:', error);

      // Extract error details from RpcException
      // RpcException can be structured as error.error or directly as error
      const errorData = error.error || error;
      const statusCode = errorData.statusCode || error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = errorData.message || error.message || 'An error occurred';

      // Map status codes to appropriate HTTP exceptions
      if (statusCode === HttpStatus.NOT_FOUND) {
        throw new NotFoundException(message);
      } else if (statusCode === HttpStatus.UNAUTHORIZED) {
        throw new UnauthorizedException(message);
      } else if (statusCode === HttpStatus.BAD_REQUEST) {
        throw new BadRequestException(message);
      } else {
        throw new HttpException(message, statusCode);
      }
    }
  }
}
