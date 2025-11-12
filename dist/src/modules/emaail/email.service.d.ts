import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Email } from './entities/email.entity';
export declare class EmailService {
    private readonly configService;
    private readonly emailRepo;
    private readonly logger;
    private transporter;
    constructor(configService: ConfigService, emailRepo: Repository<Email>);
    sendEmail(to: string, subject: string, text: string, html?: string, attempt?: number): any;
    private publishToFailedQueue;
}
