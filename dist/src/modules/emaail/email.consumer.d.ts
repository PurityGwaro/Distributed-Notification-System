import { OnModuleInit } from '@nestjs/common';
import { RabbitmqService } from '../rabbitmq/rabbitmq.service';
import { EmailService } from './email.service';
export declare class EmailConsumer implements OnModuleInit {
    private readonly rabbitmqService;
    private readonly emailService;
    constructor(rabbitmqService: RabbitmqService, emailService: EmailService);
    onModuleInit(): Promise<void>;
}
