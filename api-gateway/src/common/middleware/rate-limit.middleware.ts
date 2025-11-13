import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RedisService } from '../../notification/redis.service';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  constructor(private readonly redisService: RedisService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const identifier = this.getIdentifier(req);
    const key = `rate_limit:${identifier}`;

    try {
      const isAllowed = await this.redisService.checkRateLimit(key);

      if (!isAllowed) {
        throw new HttpException(
          {
            success: false,
            message: 'Rate limit exceeded',
            error: 'Too many requests. Please try again later.',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      next();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      next();
    }
  }

  private getIdentifier(req: Request): string {
    const user = (req as any).user;
    return user?.userId || req.ip || 'anonymous';
  }
}
