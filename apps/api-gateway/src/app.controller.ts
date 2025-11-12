import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getInfo() {
    return {
      service: 'API Gateway',
      version: '1.0.0',
      endpoints: {
        health: '/health',
        docs: '/api/docs',
        users: '/api/v1/users',
        auth: '/api/v1/auth',
        notifications: '/api/v1/notifications',
      },
    };
  }
}
