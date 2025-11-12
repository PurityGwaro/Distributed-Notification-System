# Distributed Notification System

A microservices-based notification system built with NestJS that sends emails and push notifications using separate services. Services communicate asynchronously through RabbitMQ message queues.

## Description

This project implements a distributed notification system with the following services:
- **API Gateway Service**: Entry point for all notification requests, handles authentication, validation, and routing
- **User Service**: Manages user contact info, preferences, and authentication

Built with NestJS, PostgreSQL, Redis, and RabbitMQ.

## Features

- **API Gateway Service**
  - Request validation and authentication
  - Routes messages to appropriate queues (email/push)
  - Tracks notification status via Redis
  - Rate limiting per user
  - Idempotency using request IDs

- **User Service**
  - User registration and authentication (JWT)
  - User preferences management
  - PostgreSQL database for user data
  - REST API for user operations

- **Technical Concepts Implemented**
  - Message Queue (RabbitMQ)
  - Caching (Redis)
  - Idempotency
  - Rate Limiting
  - Health Checks
  - CI/CD Pipeline

## Architecture

```
┌─────────────────┐
│   API Gateway   │
│   (Port 3000)   │
└────────┬────────┘
         │
    ┌────┴─────┐
    ▼          ▼
┌─────────┐  ┌──────────┐
│  Redis  │  │PostgreSQL│
└─────────┘  └──────────┘
         │
    ┌────┴─────────────┐
    ▼                  ▼
┌──────────┐    ┌──────────┐
│Email Queue│    │Push Queue│
└──────────┘    └──────────┘
         │
         ▼
    ┌─────────────┐
    │Failed Queue │
    └─────────────┘
```

## Prerequisites

- Node.js (v20 or higher)
- Docker and Docker Compose
- PostgreSQL (or use Docker)
- Redis (or use Docker)
- RabbitMQ (or use Docker)

## Project Setup

### 1. Clone the repository

```bash
git clone <repository-url>
cd notification-system
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Update the `.env` file with your configuration:

```env
# Application
NODE_ENV=development
PORT=3000

# Database
USER_DB_HOST=localhost
USER_DB_PORT=5432
USER_DB_USERNAME=postgres
USER_DB_PASSWORD=postgres
USER_DB_NAME=user_service

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# RabbitMQ
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# JWT
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=1d
```

## Running the Application

### Using Docker Compose (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Running Locally

```bash
# Start PostgreSQL, Redis, and RabbitMQ
docker-compose up -d postgres redis rabbitmq

# Development mode with hot reload
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## API Documentation

Once the application is running, visit:

- **Swagger Documentation**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/health
- **RabbitMQ Management**: http://localhost:15672 (guest/guest)

## API Endpoints

### Authentication

```bash
# Register a new user
POST /api/v1/users
{
  "name": "John Doe",
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "push_token": "device_token",
  "preferences": {
    "email": true,
    "push": true
  }
}

# Login
POST /api/v1/auth/login
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

### Notifications

```bash
# Create notification (requires JWT token)
POST /api/v1/notifications
Authorization: Bearer <token>
{
  "notification_type": "email",
  "user_id": "uuid",
  "template_code": "welcome_email",
  "variables": {
    "name": "John Doe",
    "link": "https://example.com/verify"
  },
  "request_id": "req_123456789",
  "priority": 1
}

# Get notification status
GET /api/v1/notifications/:id
Authorization: Bearer <token>
```

### User Management

```bash
# Get all users (paginated)
GET /api/v1/users?page=1&limit=10
Authorization: Bearer <token>

# Get user by ID
GET /api/v1/users/:id
Authorization: Bearer <token>

# Update user
PATCH /api/v1/users/:id
Authorization: Bearer <token>

# Delete user
DELETE /api/v1/users/:id
Authorization: Bearer <token>
```

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## CI/CD Pipeline

The project includes a GitHub Actions workflow that:

1. **Lint**: Runs ESLint and format checking
2. **Test**: Runs unit tests and generates coverage
3. **Build**: Builds Docker image and pushes to registry
4. **Deploy**: Deploys to staging/production based on branch

### Required GitHub Secrets

- `SSH_PRIVATE_KEY`: SSH key for server access
- `SERVER_HOST`: Production server hostname
- `SERVER_USER`: SSH username
- `STAGING_HOST`: Staging server hostname
- `STAGING_USER`: Staging SSH username

## Project Structure

```
src/
├── common/
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   ├── interfaces/
│   └── utils/
├── config/
│   ├── database.config.ts
│   ├── redis.config.ts
│   └── rabbitmq.config.ts
├── api-gateway/
│   ├── controllers/
│   ├── dto/
│   ├── services/
│   └── api-gateway.module.ts
├── user/
│   ├── controllers/
│   ├── dto/
│   ├── entities/
│   ├── services/
│   └── user.module.ts
└── main.ts
```

## RabbitMQ Queue Structure

```
Exchange: notifications.direct
├── email.queue  → Email Service
├── push.queue   → Push Service
└── failed.queue → Dead Letter Queue
```

## Response Format

All API responses follow this format:

```json
{
  "success": true,
  "message": "Request successful",
  "data": {},
  "meta": {
    "total": 100,
    "limit": 10,
    "page": 1,
    "total_pages": 10,
    "has_next": true,
    "has_previous": false
  }
}
```

## Performance Targets

- Handle 1,000+ notifications per minute
- API Gateway response under 100ms
- 99.5% delivery success rate
- Supports horizontal scaling

## Technologies Used

- **Framework**: NestJS
- **Language**: TypeScript
- **Database**: PostgreSQL
- **Cache**: Redis
- **Message Queue**: RabbitMQ
- **Authentication**: JWT
- **Validation**: class-validator
- **Documentation**: Swagger/OpenAPI
- **Containerization**: Docker

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.
