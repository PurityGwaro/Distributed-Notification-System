import { Repository } from 'typeorm';
import { Notification } from '../database/entities/notification.entity';
export declare class PushService {
    private readonly notificationRepo;
    private readonly logger;
    constructor(notificationRepo: Repository<Notification>);
    sendPush(payload: any): Promise<{
        success: boolean;
        messageId: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        messageId?: undefined;
    }>;
}
