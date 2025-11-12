import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getInfo() {
    return {
      service: 'push-service',
      version: '1.0.0',
      description: 'Push notification microservice',
      endpoints: {
        health: '/health',
        api_docs: '/api',
        notification_status: '/push/notification/:id',
        notifications_by_status: '/push/notifications/status/:status',
      },
    };
  }
}
