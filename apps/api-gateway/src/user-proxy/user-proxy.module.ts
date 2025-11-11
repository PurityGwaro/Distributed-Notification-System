import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { UserProxyController } from './controllers/user-proxy.controller';
import { AuthProxyController } from './controllers/auth-proxy.controller';
import { UserServiceConnectionService } from './services/user-service-connection.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USER_SERVICE',
        transport: Transport.RMQ,
        options: {
          urls: [process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672'],
          queue: 'user_queue',
          queueOptions: {
            durable: true,
          },
        },
      },
    ]),
  ],
  controllers: [UserProxyController, AuthProxyController],
  providers: [UserServiceConnectionService],
})
export class UserProxyModule {}
