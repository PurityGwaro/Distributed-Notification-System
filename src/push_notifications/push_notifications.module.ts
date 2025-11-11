import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { PushNotificationsController } from './push_notifications.controller';
import { PushNotificationsService } from './push_notifications.service';
import { PushProvider } from './push_provider.adapter';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'PUSH_SERVICE', 
        transport: Transport.RMQ,
        options: {
          urls: ['amqp://guest:guest@rabbitmq:5672'],
          queue: 'push_queue',
          queueOptions: {
            durable: false,
          },
        },
      },
    ]),
  ],
  controllers: [PushNotificationsController],
  providers: [PushNotificationsService, PushProvider], 
})
export class PushNotificationsModule {}
