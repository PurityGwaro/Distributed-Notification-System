import { registerAs } from '@nestjs/config';

export default registerAs('rabbitmq', () => ({
  url: process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672',
  exchange: process.env.RABBITMQ_EXCHANGE || 'notifications.direct',
  queues: {
    email: process.env.RABBITMQ_EMAIL_QUEUE || 'email.queue',
    push: process.env.RABBITMQ_PUSH_QUEUE || 'push.queue',
    failed: process.env.RABBITMQ_FAILED_QUEUE || 'failed.queue',
  },
}));
