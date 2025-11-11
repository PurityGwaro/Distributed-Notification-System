import { Injectable, OnModuleInit, Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Injectable()
export class UserServiceConnectionService implements OnModuleInit {
  private readonly logger = new Logger(UserServiceConnectionService.name);

  constructor(
    @Inject('USER_SERVICE') private readonly userServiceClient: ClientProxy,
  ) {}

  async onModuleInit() {
    this.logger.log('Initializing User Service connection...');

    try {
      // Connect to RabbitMQ
      await this.userServiceClient.connect();
      this.logger.log('Connected to RabbitMQ');

      // Send a ping message to ensure connection is fully established
      await this.userServiceClient
        .send({ cmd: 'ping' }, {})
        .pipe(
          timeout(5000),
          catchError((error) => {
            this.logger.warn('Ping failed, but connection may still work:', error.message);
            return of(null);
          }),
        )
        .toPromise();

      this.logger.log('User Service connection established and ready');
    } catch (error) {
      this.logger.error('Failed to initialize User Service connection:', error);
      // Don't throw - allow app to start but log the error
    }
  }
}
