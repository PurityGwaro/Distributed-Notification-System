import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @ApiOperation({ summary: 'Hello endpoint' })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @ApiTags('Health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @Get('health')
  healthCheck() {
    return { status: 'ok' };
  }
}
