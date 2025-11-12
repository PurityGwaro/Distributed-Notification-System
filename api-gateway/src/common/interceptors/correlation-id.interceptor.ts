import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    // Get or generate correlation ID
    const correlationId =
      request.headers['x-correlation-id'] ||
      request.headers['x-request-id'] ||
      uuidv4();

    // Attach correlation ID to request object for use in services
    request.correlationId = correlationId;

    // Add correlation ID to response headers
    response.setHeader('x-correlation-id', correlationId);

    return next.handle().pipe(
      tap(() => {
        // Log correlation ID for debugging
        console.log(
          `[${correlationId}] ${request.method} ${request.url} - ${response.statusCode}`,
        );
      }),
    );
  }
}
