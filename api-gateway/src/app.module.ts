import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './auth/auth.module';
import { NotificationModule } from './notification/notification.module';
import { HealthModule } from './health/health.module';
import { RateLimitMiddleware } from './common/middleware/rate-limit.middleware';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';
import { RedisService } from './notification/redis.service';

@Module({
  imports: [
    JwtModule.register({
      secret:
        process.env.JWT_SECRET ||
        'your-super-secret-jwt-key-change-in-production',
      signOptions: { expiresIn: '24h' },
    }),
    AuthModule,
    NotificationModule,
    HealthModule,
  ],
  providers: [
    RedisService,
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimitMiddleware).forRoutes('api/v1/notifications');
  }
}
