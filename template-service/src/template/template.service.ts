import {
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createClient, RedisClientType } from 'redis';
import { Template } from './template.entity';
import { Repository } from 'typeorm';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';

@Injectable()
export class TemplateService implements OnModuleInit, OnModuleDestroy {
  private redisClient: RedisClientType;

  constructor(
    @InjectRepository(Template)
    private readonly templateRepository: Repository<Template>,
  ) {}

  async onModuleInit() {
    const redisHost = process.env.REDIS_HOST || 'redis';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379');

    this.redisClient = createClient({
      socket: { host: redisHost, port: redisPort },
    });

    await this.redisClient.connect();
    console.log('Template service redis connected successfully.');
  }

  async create(dto: CreateTemplateDto) {
    const template = this.templateRepository.create(dto);
    await this.templateRepository.save(template);

    await this.cacheTemplate(template);

    return {
      success: true,
      message: 'Template created successfully',
      data: template,
    };
  }

  async findByCode(code: string) {
    const cached = await this.redisClient.get(`template:${code}`);
    if (cached) {
      const data = typeof cached === 'string' ? JSON.parse(cached) : cached;
      return {
        success: true,
        message: 'Template retrieved successfully from cache',
        data,
      };
    }

    const template = await this.templateRepository.findOne({
      where: { code, is_active: true },
    });

    if (!template) {
      throw new NotFoundException('Template Not found');
    }

    await this.cacheTemplate(template);

    return {
      success: true,
      message: 'Template retrieved successfully',
      data: template,
    };
  }

  async update(id: string, dto: UpdateTemplateDto) {
    const template = await this.templateRepository.findOne({ where: { id } });

    if (!template) {
      throw new NotFoundException('Template Not found');
    }

    Object.assign(template, dto);
    template.version += 1;
    await this.templateRepository.save(template);

    await this.invalidateCache(template.code);
    await this.cacheTemplate(template);

    return {
      success: true,
      message: 'Template Updated Successfully',
      data: template,
    };
  }

  async findAll(page: number = 1, limit: number = 10) {
    const [templates, total] = await this.templateRepository.findAndCount({
      where: { is_active: true },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return {
      success: true,
      message: 'All templates retrieved successfullly.',
      data: templates,
      meta: {
        total,
        limit,
        page,
        total_pages: Math.ceil(total / limit),
        has_next: page * limit < total,
        has_previous: page > 1,
      },
    };
  }

  private async cacheTemplate(template: Template) {
    await this.redisClient.setEx(
      `template:${template.code}`,
      3600,
      JSON.stringify(template),
    );
  }

  private async invalidateCache(code: string) {
    await this.redisClient.del(`template:${code}`);
  }

  async onModuleDestroy() {
    await this.redisClient.quit();
  }
}
