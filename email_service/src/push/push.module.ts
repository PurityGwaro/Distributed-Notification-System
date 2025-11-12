import { Module } from '@nestjs/common';
import { PushService } from './push.service';
import { PushController } from './push.controller';

@Module({
  providers: [PushService],
  controllers: [PushController],
  exports: [PushService], // export in case other modules need it
})
export class PushModule {}
