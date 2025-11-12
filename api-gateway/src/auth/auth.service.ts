import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { firstValueFrom } from 'rxjs';
import { LoginDto } from './dto/auth.dto';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly httpService: HttpService,
  ) {}

  async login(loginDto: LoginDto) {
    try {
      const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3001';
      
      // Call User Service to validate credentials
      const response = await firstValueFrom(
        this.httpService.post(`${userServiceUrl}/api/v1/users/login`, loginDto)
      );

      if (!response.data.success) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const user = response.data.data;

      // Generate JWT token
      const payload = { 
        sub: user.id, 
        email: user.email,
        name: user.name 
      };
      
      const access_token = this.jwtService.sign(payload);

      return {
        success: true,
        message: 'Login successful',
        data: {
          access_token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        },
      };
    } catch (error) {
      if (error.response?.status === 401) {
        throw new UnauthorizedException('Invalid email or password');
      }
      throw new UnauthorizedException('Authentication failed');
    }
  }

  async validateUser(userId: string) {
    try {
      const userServiceUrl = process.env.USER_SERVICE_URL || 'http://localhost:3001';
      const response = await firstValueFrom(
        this.httpService.get(`${userServiceUrl}/api/v1/users/${userId}`)
      );

      if (!response.data.success) {
        return null;
      }

      return response.data.data;
    } catch (error) {
      return null;
    }
  }
}