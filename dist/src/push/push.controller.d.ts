import { PushService } from './push.service';
export declare class PushController {
    private readonly pushService;
    private readonly logger;
    constructor(pushService: PushService);
    handlePush(data: any): Promise<{
        success: boolean;
        messageId: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        messageId?: undefined;
    }>;
}
