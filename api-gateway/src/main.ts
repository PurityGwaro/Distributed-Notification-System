import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import axios from 'axios';

async function fetchWithRetry(url: string, retries = 5, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.get(url, { timeout: 5000 });
      return response.data;
    } catch (error) {
      console.log(`Attempt ${i + 1} failed for ${url}. Retrying...`);
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  const gatewayConfig = new DocumentBuilder()
    .setTitle('API Gateway')
    .setDescription('Gateway endpoints (Auth, Health, Notifications)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const gatewayDocument = SwaggerModule.createDocument(app, gatewayConfig);
  SwaggerModule.setup('docs', app, gatewayDocument);

  const services = [
    {
      url: 'http://user-service:3001/api-json',
      name: 'User Service',
      path: 'docs/users',
    },
    {
      url: 'http://template-service:3004/api-json',
      name: 'Template Service',
      path: 'docs/templates',
    },
  ];

  for (const service of services) {
    try {
      console.log(`Fetching ${service.name}...`);
      const doc = await fetchWithRetry(service.url);
      SwaggerModule.setup(service.path, app, doc);
      console.log(`✓ ${service.name} docs available at /${service.path}`);
    } catch (error) {
      console.error(`✗ Failed to fetch ${service.name}:`, error.message);
    }
  }

  app.getHttpAdapter().get('/docs/index', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>API Documentation Index</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              max-width: 800px;
              margin: 50px auto;
              padding: 20px;
              background: #f5f5f5;
            }
            h1 {
              color: #333;
              border-bottom: 3px solid #007bff;
              padding-bottom: 10px;
            }
            .service-card {
              background: white;
              padding: 20px;
              margin: 15px 0;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
              transition: transform 0.2s;
            }
            .service-card:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 8px rgba(0,0,0,0.15);
            }
            .service-card h2 {
              margin-top: 0;
              color: #007bff;
            }
            .service-card a {
              display: inline-block;
              margin-top: 10px;
              padding: 8px 16px;
              background: #007bff;
              color: white;
              text-decoration: none;
              border-radius: 4px;
              font-weight: 500;
            }
            .service-card a:hover {
              background: #0056b3;
            }
            .service-card p {
              color: #666;
              margin: 10px 0;
            }
          </style>
        </head>
        <body>
          <h1>Notification System - API Documentation</h1>
          
          <div class="service-card">
            <h2>API Gateway</h2>
            <p>Authentication, health checks, and notification endpoints</p>
            <a href="/docs" target="_blank">View Documentation →</a>
          </div>

          <div class="service-card">
            <h2>User Service</h2>
            <p>User management, preferences, and device registration</p>
            <a href="/docs/users" target="_blank">View Documentation →</a>
          </div>

          <div class="service-card">
            <h2>Template Service</h2>
            <p>Notification templates and template management</p>
            <a href="/docs/templates" target="_blank">View Documentation →</a>
          </div>

        </body>
      </html>
    `);
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`API Gateway running on port ${port}`);
  console.log(`Documentation Index:  http://localhost:${port}/docs/index`);
  console.log(`Gateway Docs:         http://localhost:${port}/docs`);
  console.log(`User Service Docs:    http://localhost:${port}/docs/users`);
  console.log(`Template Service Docs: http://localhost:${port}/docs/templates`);
}
void bootstrap();
