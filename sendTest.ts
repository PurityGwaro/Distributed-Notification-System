import * as amqp from 'amqplib';

async function sendMessage() {
  const connection = await amqp.connect('amqp://guest:guest@localhost:5672');
  const channel = await connection.createChannel();

  const queue = 'push.queue';
  await channel.assertQueue(queue, { durable: true });

  const message = {
    device_token: 'test-device-token',
    title: 'Hello!',
    body: 'This is a test push message',
    data: { key: 'value' },
  };

  channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)), {
    persistent: true,
  });
  console.log('✅ Test message sent to queue');
  await channel.close();
  await connection.close();
}

sendMessage();

