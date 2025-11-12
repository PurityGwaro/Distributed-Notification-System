import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
export declare class RabbitmqService implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private connection;
    private channel;
    private readonly logger;
    private isConnecting;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    private connect;
    assertQueue(queue: string, options?: {
        deadLetterExchange?: string;
        deadLetterRoutingKey?: string;
    }): Promise<void>;
    sendToQueue(queue: string, message: any): Promise<void>;
    consume(queue: string, callback: (msg: any) => void, prefetch?: number): Promise<void>;
    isConnected(): boolean;
    onModuleDestroy(): Promise<void>;
}
