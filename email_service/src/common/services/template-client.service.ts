import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';

export interface TemplateResponse {
  id: string;
  code: string;
  name: string;
  subject: string;
  content: string;
  language: string;
  version: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplateApiResponse {
  success: boolean;
  data: TemplateResponse;
  message: string;
}

@Injectable()
export class TemplateClientService {
  private readonly logger = new Logger(TemplateClientService.name);
  private readonly httpClient: AxiosInstance;
  private readonly templateCache: Map<
    string,
    { template: TemplateResponse; timestamp: number }
  >;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly configService: ConfigService) {
    const templateServiceUrl = this.configService.get(
      'TEMPLATE_SERVICE_URL',
      'http://localhost:3003',
    );

    this.httpClient = axios.create({
      baseURL: templateServiceUrl,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.templateCache = new Map();
    this.logger.log(
      `Template client initialized with URL: ${templateServiceUrl}`,
    );
  }

  /**
   * Fetch template by code from template-service
   * Supports caching to reduce API calls
   */
  async getTemplateByCode(
    code: string,
    correlationId?: string,
  ): Promise<TemplateResponse> {
    try {
      // Check cache first
      const cached = this.templateCache.get(code);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        this.logger.debug(`Cache hit for template: ${code}`);
        return cached.template;
      }

      // Fetch from API
      this.logger.log(`Fetching template from API: ${code}`);
      const headers: Record<string, string> = {};
      if (correlationId) {
        headers['x-correlation-id'] = correlationId;
      }

      const response = await this.httpClient.get<TemplateApiResponse>(
        `/api/v1/templates/${code}`,
        { headers },
      );

      if (!response.data.success || !response.data.data) {
        throw new HttpException(
          `Template not found: ${code}`,
          HttpStatus.NOT_FOUND,
        );
      }

      const template = response.data.data;

      // Cache the result
      this.templateCache.set(code, {
        template,
        timestamp: Date.now(),
      });

      return template;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(
          `Failed to fetch template ${code}: ${error.message}`,
          error.stack,
        );

        if (error.response?.status === 404) {
          throw new HttpException(
            `Template not found: ${code}`,
            HttpStatus.NOT_FOUND,
          );
        }

        throw new HttpException(
          `Template service error: ${error.message}`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      throw error;
    }
  }

  /**
   * Replace variables in template content
   * Supports {{variable}} syntax
   */
  replaceVariables(content: string, variables: Record<string, any>): string {
    let result = content;

    Object.keys(variables).forEach((key) => {
      const value =
        variables[key] !== undefined && variables[key] !== null
          ? String(variables[key])
          : '';
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      result = result.replace(regex, value);
    });

    return result;
  }

  /**
   * Process template: fetch and replace variables
   */
  async processTemplate(
    templateCode: string,
    variables: Record<string, any>,
    correlationId?: string,
  ): Promise<{ subject: string; content: string }> {
    const template = await this.getTemplateByCode(templateCode, correlationId);

    const subject = this.replaceVariables(template.subject, variables);
    const content = this.replaceVariables(template.content, variables);

    return { subject, content };
  }

  /**
   * Clear cache for specific template or all templates
   */
  clearCache(code?: string): void {
    if (code) {
      this.templateCache.delete(code);
      this.logger.log(`Cache cleared for template: ${code}`);
    } else {
      this.templateCache.clear();
      this.logger.log('All template cache cleared');
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.templateCache.size,
      keys: Array.from(this.templateCache.keys()),
    };
  }
}
