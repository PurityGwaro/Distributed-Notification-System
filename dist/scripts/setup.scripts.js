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
Object.defineProperty(exports, "__esModule", { value: true });
const amqp = __importStar(require("amqplib"));
const dotenv = __importStar(require("dotenv"));
dotenv.config();
async function setupQueues() {
    const RABBITMQ_URL = process.env.RABBITMQ_URL;
    if (!RABBITMQ_URL)
        throw new Error('RABBITMQ_URL is not defined in .env');
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();
    const EXCHANGE_NAME = 'notifications.direct';
    await channel.assertExchange(EXCHANGE_NAME, 'direct', { durable: true });
    const EMAIL_QUEUE = 'email_queue';
    const FAILED_EMAIL_QUEUE = 'failed_email_queue';
    await channel.assertQueue(EMAIL_QUEUE, {
        durable: true,
        deadLetterExchange: EXCHANGE_NAME,
        deadLetterRoutingKey: FAILED_EMAIL_QUEUE,
    });
    await channel.assertQueue(FAILED_EMAIL_QUEUE, { durable: true });
    await channel.bindQueue(EMAIL_QUEUE, EXCHANGE_NAME, 'email_notification');
    await channel.bindQueue(FAILED_EMAIL_QUEUE, EXCHANGE_NAME, FAILED_EMAIL_QUEUE);
    console.log('rabbitMQ Queues and Exchange successfully set up for production');
    await channel.close();
    await connection.close();
}
setupQueues().catch((err) => {
    console.error('failed to setup RabbitMQ queues:', err);
    process.exit(1);
});
//# sourceMappingURL=setup.scripts.js.map