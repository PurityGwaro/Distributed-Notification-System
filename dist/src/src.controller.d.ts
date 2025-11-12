import { RabbitmqService } from './modules/rabbitmq/rabbitmq.service';
import { DataSource } from 'typeorm';
export declare class AppController {
    private readonly rabbitmqService;
    private readonly dataSource;
    constructor(rabbitmqService: RabbitmqService, dataSource: DataSource);
    healthCheck(): Promise<{
        status: string;
        db: boolean;
        rabbitmq: boolean;
        message?: undefined;
    } | {
        status: string;
        message: any;
        db?: undefined;
        rabbitmq?: undefined;
    }>;
}
