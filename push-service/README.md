# Push Notification Service

A standalone NestJS microservice for handling push notifications via Firebase Cloud Messaging (FCM).

## Features

- Firebase Cloud Messaging (FCM) integration
- RabbitMQ message consumption from `push_queue`
- PostgreSQL for notification tracking
- Retry logic with exponential backoff
- Dead Letter Queue (DLQ) for failed messages
- Health check endpoint
- Swagger API documentation

## Prerequisites

- Node.js 20+
- PostgreSQL
- RabbitMQ
- Firebase Admin SDK credentials

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Configure the following environment variables:

- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME` - PostgreSQL connection
- `RABBITMQ_URL` - RabbitMQ connection URL
- `FCM_CREDENTIALS` - Firebase Admin SDK credentials (JSON string)
- `NODE_ENV` - Environment (development/production)
- `PORT` - Service port (default: 3002)

## Running the Service

### Development
```bash
npm run start:dev
```

### Production
```bash
npm run build
npm run start:prod
```

### Docker
```bash
docker build -t push-service .
docker run -p 3002:3002 --env-file .env push-service
```

## API Endpoints

- `GET /` - Service information
- `GET /health` - Health check endpoint
- `GET /api` - Swagger API documentation
- `GET /push/notification/:id` - Get notification status by ID
- `GET /push/notifications/status/:status` - Get notifications by status (pending/sent/failed)

## RabbitMQ Integration

The service consumes messages from the `push_queue` with the following structure:

```json
{
  "device_token": "firebase_device_token",
  "title": "Notification Title",
  "body": "Notification Body",
  "data": {
    "key": "value"
  }
}
```

### Retry Logic

- Maximum retry attempts: 5
- Initial retry delay: 1 second
- Exponential backoff with maximum delay of 60 seconds
- Failed messages after max retries are sent to Dead Letter Queue (`push_queue_dlq`)

## Database Schema

The service uses a `notifications` table with the following schema:

- `id` (uuid) - Primary key
- `device_token` (string) - Firebase device token
- `title` (string) - Notification title
- `body` (string) - Notification body
- `data` (json) - Additional data payload
- `status` (string) - Status: pending, sent, failed
- `retry_count` (integer) - Number of retry attempts
- `error_message` (text) - Error message if failed
- `created_at` (timestamp) - Creation timestamp
- `updated_at` (timestamp) - Last update timestamp

## Development

### Linting
```bash
npm run lint
```

### Testing
```bash
npm run test
npm run test:watch
npm run test:cov
```

## Architecture

```
push-service/
├── src/
│   ├── push/              # Push notification module
│   │   ├── push.service.ts
│   │   ├── push.controller.ts
│   │   ├── push.module.ts
│   │   └── entities/
│   ├── rabbitmq/          # RabbitMQ consumer module
│   │   ├── rabbitmq.service.ts
│   │   └── rabbitmq.module.ts
│   ├── health/            # Health check module
│   ├── database/          # Database entities
│   ├── app.module.ts
│   └── main.ts
├── Dockerfile
├── package.json
└── tsconfig.json
```

## License

MIT
