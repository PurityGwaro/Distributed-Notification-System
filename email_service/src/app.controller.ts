import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('App') // Swagger tag for this controller
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // GET /
  @ApiOperation({ summary: 'Hello endpoint' })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // GET /health
  @ApiOperation({ summary: 'Health check endpoint' })
  @Get('health')
  healthCheck() {
    return { status: 'ok' };
  }
}
