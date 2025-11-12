"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var RabbitmqService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RabbitmqService = void 0;
const common_1 = require("@nestjs/common");
const amqp = __importStar(require("amqplib"));
const config_1 = require("@nestjs/config");
let RabbitmqService = RabbitmqService_1 = class RabbitmqService {
    configService;
    connection;
    channel;
    logger = new common_1.Logger(RabbitmqService_1.name);
    isConnecting = false;
    constructor(configService) {
        this.configService = configService;
    }
    async onModuleInit() {
        this.connect();
    }
    async connect() {
        if (this.isConnecting)
            return;
        this.isConnecting = true;
        const rabbitUrl = this.configService.get('RABBITMQ_URL') || 'amqp://localhost:5672';
        while (!this.connection) {
            try {
                this.connection = await amqp.connect(rabbitUrl);
                this.connection.on('close', () => {
                    this.logger.warn('abbitMQ connection closed. Reconnecting...');
                    this.connection = null;
                    this.channel = null;
                    this.connect();
                });
                this.connection.on('error', (err) => {
                    this.logger.error('rabbitMQ connection error:', err.message);
                });
                this.channel = await this.connection.createChannel();
                this.logger.log('Connected to RabbitMQ');
            }
            catch (err) {
                this.logger.error('rabbitMQ connection failed. Retrying in 5s...', err.message);
                await new Promise((r) => setTimeout(r, 5000));
            }
        }
        this.isConnecting = false;
    }
    async assertQueue(queue, options) {
        if (!this.channel) {
            this.logger.warn('channel not ready yet!');
            return;
        }
        const args = {};
        if (options?.deadLetterExchange)
            args['x-dead-letter-exchange'] = options.deadLetterExchange;
        if (options?.deadLetterRoutingKey)
            args['x-dead-letter-routing-key'] = options.deadLetterRoutingKey;
        await this.channel.assertQueue(queue, { durable: true, arguments: args });
    }
    async sendToQueue(queue, message) {
        if (!this.channel) {
            this.logger.warn('channel not ready yet!');
            return;
        }
        try {
            await this.assertQueue(queue);
            this.channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
                persistent: true,
            });
            this.logger.log(`message sent to queue "${queue}"`);
        }
        catch (err) {
            this.logger.error(`failed to send message to "${queue}": ${err.message}`);
        }
    }
    async consume(queue, callback, prefetch = 5) {
        if (!this.channel) {
            this.logger.warn('channel not ready yet!');
            return;
        }
        await this.assertQueue(queue);
        await this.channel.prefetch(prefetch);
        this.channel.consume(queue, (message) => {
            if (message) {
                try {
                    const content = JSON.parse(message.content.toString());
                    callback(content);
                    this.channel.ack(message);
                }
                catch (err) {
                    this.logger.error('failed to process message:', err.message);
                    this.channel.nack(message, false, false);
                }
            }
        });
        this.logger.log(`listening to queue "${queue}" with prefetch=${prefetch}`);
    }
    isConnected() {
        return !!this.connection && !!this.channel;
    }
    async onModuleDestroy() {
        await this.channel?.close();
        await this.connection?.close();
        this.logger.log('rabbitMQ connection closed');
    }
};
exports.RabbitmqService = RabbitmqService;
exports.RabbitmqService = RabbitmqService = RabbitmqService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], RabbitmqService);
//# sourceMappingURL=rabbitmq.service.js.map