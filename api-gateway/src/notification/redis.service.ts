import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createClient, RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: RedisClientType;

  async onModuleInit() {
    const redisHost = process.env.REDIS_HOST || 'redis';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');

    this.client = createClient({
      socket: {
        host: redisHost,
        port: redisPort,
      },
    });

    this.client.on('error', (err) => console.error('Redis Client Error', err));
    this.client.on('connect', () => console.log('Redis connected'));

    await this.client.connect();
  }

  async checkDuplicate(requestId: string): Promise<boolean> {
    const exists = await this.client.exists(`request:${requestId}`);
    return exists === 1;
  }

  async markProcessed(
    requestId: string,
    notificationId: string,
  ): Promise<void> {
    await this.client.setEx(`request:${requestId}`, 3600, notificationId);
  }

  async getRequestMapping(requestId: string): Promise<string | null> {
    return await this.client.get(`request:${requestId}`);
  }

  async setStatus(notificationId: string, status: any): Promise<void> {
    await this.client.setEx(
      `status:${notificationId}`,
      86400, // 24 hours
      JSON.stringify(status),
    );
  }

  async getStatus(notificationId: string): Promise<any> {
    const status = await this.client.get(`status:${notificationId}`);
    return status ? JSON.parse(status) : null;
  }

  async checkRateLimit(key: string): Promise<boolean> {
    const limit = parseInt(process.env.RATE_LIMIT_MAX || '100');
    const window = parseInt(process.env.RATE_LIMIT_WINDOW || '60'); // seconds

    const current = await this.client.incr(key);

    if (current === 1) {
      await this.client.expire(key, window);
    }

    return current <= limit;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
