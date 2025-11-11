import { Controller, HttpStatus } from '@nestjs/common';
import { MessagePattern, Payload, RpcException } from '@nestjs/microservices';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';

@Controller()
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @MessagePattern({ cmd: 'login' })
  async login(@Payload() loginDto: LoginDto) {
    try {
      const result = await this.authService.login(loginDto);
      return {
        success: true,
        message: 'Login successful',
        data: result,
      };
    } catch (error) {
      console.error('Auth service error:', error);

      // Map NestJS HTTP exceptions to proper status codes
      const statusCode = error.status || HttpStatus.INTERNAL_SERVER_ERROR;
      const message = error.message || 'Login failed';

      throw new RpcException({
        statusCode,
        message,
        error: error.name || 'Error',
      });
    }
  }
}
