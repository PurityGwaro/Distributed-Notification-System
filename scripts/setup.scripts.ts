import * as amqp from 'amqplib';
import * as dotenv from 'dotenv';
dotenv.config();

async function setupQueues() {
  const RABBITMQ_URL = process.env.RABBITMQ_URL;
  if (!RABBITMQ_URL) throw new Error('RABBITMQ_URL is not defined in .env');

  const connection = await amqp.connect(RABBITMQ_URL);
  const channel = await connection.createChannel();

  // Exchange
  const EXCHANGE_NAME = 'notifications.direct';
  await channel.assertExchange(EXCHANGE_NAME, 'direct', { durable: true });

  // Queues
  const EMAIL_QUEUE = 'email_queue';
  const FAILED_EMAIL_QUEUE = 'failed_email_queue';

  await channel.assertQueue(EMAIL_QUEUE, {
    durable: true,
    deadLetterExchange: EXCHANGE_NAME,
    deadLetterRoutingKey: FAILED_EMAIL_QUEUE,
  });

  await channel.assertQueue(FAILED_EMAIL_QUEUE, { durable: true });

  // Bind queues to exchange
  await channel.bindQueue(EMAIL_QUEUE, EXCHANGE_NAME, 'email_notification');
  await channel.bindQueue(
    FAILED_EMAIL_QUEUE,
    EXCHANGE_NAME,
    FAILED_EMAIL_QUEUE,
  );

  console.log(
    'rabbitMQ Queues and Exchange successfully set up for production',
  );

  await channel.close();
  await connection.close();
}

setupQueues().catch((err) => {
  console.error('failed to setup RabbitMQ queues:', err);
  process.exit(1);
});
