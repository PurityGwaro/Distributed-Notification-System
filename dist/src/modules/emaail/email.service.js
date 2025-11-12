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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var EmailService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = __importStar(require("nodemailer"));
const config_1 = require("@nestjs/config");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const email_entity_1 = require("./entities/email.entity");
const amqp = __importStar(require("amqplib"));
let EmailService = EmailService_1 = class EmailService {
    configService;
    emailRepo;
    logger = new common_1.Logger(EmailService_1.name);
    transporter;
    constructor(configService, emailRepo) {
        this.configService = configService;
        this.emailRepo = emailRepo;
        this.transporter = nodemailer.createTransport({
            host: this.configService.get('EMAIL_HOST'),
            port: this.configService.get('EMAIL_PORT'),
            secure: false,
            auth: {
                user: this.configService.get('EMAIL_USER'),
                pass: this.configService.get('EMAIL_PASS'),
            },
        });
    }
    async sendEmail(to, subject, text, html, attempt = 1) {
        const MAX_RETRIES = 3;
        const BACKOFF_MS = 1000;
        const email = this.emailRepo.create({ to, subject, text, html, status: 'pending' });
        if (attempt === 1)
            await this.emailRepo.save(email);
        try {
            await this.transporter.sendMail({
                from: this.configService.get('EMAIL_FROM'),
                to,
                subject,
                text,
                html,
            });
            email.status = 'sent';
            await this.emailRepo.save(email);
            this.logger.log(`✅ Email sent to ${to}`);
        }
        catch (err) {
            this.logger.warn(`Attempt ${attempt} failed: ${err.message}`);
            if (attempt < MAX_RETRIES) {
                await new Promise(res => setTimeout(res, BACKOFF_MS * attempt));
                return this.sendEmail(to, subject, text, html, attempt + 1);
            }
            else {
                email.status = 'failed';
                await this.emailRepo.save(email);
                await this.publishToFailedQueue({ to, subject, text, html });
                this.logger.error(`❌ Email permanently failed: ${to}`);
            }
        }
    }
    async publishToFailedQueue(payload) {
        const connection = await amqp.connect(this.configService.get('RABBITMQ_URL'));
        const channel = await connection.createChannel();
        await channel.assertQueue('failed_email_queue', { durable: true });
        channel.sendToQueue('failed_email_queue', Buffer.from(JSON.stringify(payload)), { persistent: true });
        await channel.close();
        await connection.close();
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = EmailService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, typeorm_1.InjectRepository)(email_entity_1.Email)),
    __metadata("design:paramtypes", [config_1.ConfigService,
        typeorm_2.Repository])
], EmailService);
//# sourceMappingURL=email.service.js.map