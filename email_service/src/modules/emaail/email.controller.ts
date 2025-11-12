import { Controller, Get, Post, Body } from '@nestjs/common';
import { EmailService, SendEmailPayload } from './email.service';
import { SendEmailDto } from './dto/send-email.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

@ApiTags('email')
@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  @ApiOperation({ summary: 'Send an email' })
  @ApiResponse({ status: 201, description: 'Email sent successfully' })
  async sendEmail(@Body() sendEmailDto: SendEmailDto) {
    const payload: SendEmailPayload = {
      to: sendEmailDto.to,
      subject: sendEmailDto.subject,
      text: sendEmailDto.text,
      html: sendEmailDto.html,
      template_code: sendEmailDto.template_code,
      template_variables: sendEmailDto.template_variables,
      request_id: sendEmailDto.request_id,
      correlation_id: sendEmailDto.correlation_id,
    };

    try {
      const result = await this.emailService.sendEmail(payload);
      return ApiResponseDto.success(
        {
          id: result.id,
          status: result.status,
          to: result.to,
          request_id: result.request_id,
        },
        'Email sent successfully',
      );
    } catch (error) {
      return ApiResponseDto.error(error.message, 'Failed to send email');
    }
  }

  @Get('circuit-breaker/stats')
  @ApiOperation({ summary: 'Get circuit breaker statistics' })
  @ApiResponse({
    status: 200,
    description: 'Circuit breaker statistics retrieved',
  })
  getCircuitBreakerStats() {
    return this.emailService.getCircuitBreakerStats();
  }

  @Post('circuit-breaker/reset')
  @ApiOperation({ summary: 'Manually reset circuit breaker' })
  @ApiResponse({ status: 200, description: 'Circuit breaker reset' })
  resetCircuitBreaker() {
    this.emailService.resetCircuitBreaker();
    return {
      message: 'Circuit breaker has been reset',
    };
  }
}
