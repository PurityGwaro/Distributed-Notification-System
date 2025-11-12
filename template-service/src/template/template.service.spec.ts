// import { Repository } from 'typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { TemplateService } from './template.service';
import { Template } from './template.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CreateTemplateDto } from './dto/template.dto';
import { NotFoundException } from '@nestjs/common';

describe('TemplateService', () => {
  let service: TemplateService;
  // let repository: Repository<Template>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
  };

  const mockRedisClient = {
    get: jest.fn(),
    setEx: jest.fn(),
    connect: jest.fn(),
    del: jest.fn(),
    quit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TemplateService,
        {
          provide: getRepositoryToken(Template),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<TemplateService>(TemplateService);
    // const repository = module.get<Repository<Template>>(getRepositoryToken(Template));

    // Mock Redis client
    (service as any).redisClient = mockRedisClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a template successfully', async () => {
      const dto: CreateTemplateDto = {
        code: 'welcome_email',
        name: 'Welcome Email',
        subject: 'Welcome {{name}}',
        content: "<h1>Hello {{name]}}, you're welcome!</h1>",
      };

      const mockTemplate = {
        id: '12345',
        ...dto,
        version: 1,
        is_active: true,
      };

      mockRepository.create.mockReturnValue(mockTemplate);
      mockRepository.save.mockResolvedValue(mockTemplate);
      mockRedisClient.setEx.mockResolvedValue('OK');

      const result = await service.create(dto);

      expect(result.success).toBe(true);
      expect(result.data.code).toBe(dto.code);
      expect(mockRedisClient.setEx).toHaveBeenCalled();
    });
  });

  describe('findByCode', () => {
    const mockTemplate = {
      id: '123',
      code: 'welcome_mail',
      name: 'Welcome Email',
      subject: 'Welcome',
      content: '<h1>Hello</h1>',
      version: 1,
      is_active: true,
    };

    it('should return template from cache if found', async () => {
      mockRedisClient.get.mockResolvedValue(JSON.stringify(mockTemplate));

      const result = await service.findByCode('welcome_mail');

      expect(result.success).toBe(true);
      expect(result.message).toContain('cache');
      expect(result.data.code).toBe('welcome_mail');
      expect(mockRepository.findOne).not.toHaveBeenCalled();
    });

    it('should fetch from database if not in cache', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(mockTemplate);
      mockRedisClient.setEx.mockResolvedValue('OK');

      const result = await service.findByCode('welcome_mail');

      expect(result.success).toBe(true);
      expect(mockRepository.findOne).toHaveBeenCalled();
      expect(mockRedisClient.setEx).toHaveBeenCalled();
      expect(result.data.code).toBe('welcome_mail');
    });

    it('should throw an error if template code is not found', async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findByCode('invalid_code')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update template and version number', async () => {
      const mockTemplate = {
        id: '123',
        code: 'welcome_email',
        name: 'Welcome Email',
        subject: 'Welcome',
        content: '<h1>Hello</h1>',
        version: 1,
        is_active: true,
      };

      const updatedDto = { name: 'Welcome to our Platform' };

      mockRepository.findOne.mockResolvedValue(mockTemplate);
      mockRepository.save.mockResolvedValue({
        ...mockTemplate,
        ...updatedDto,
        version: 2,
      });
      mockRedisClient.del.mockResolvedValue(1);
      mockRedisClient.setEx.mockResolvedValue('OK');
    });

    it('should throw an error if template code is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.update('invalid_id', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated templates', async () => {
      const mockTemplates = [
        {
          id: '1',
          code: 'template1',
          name: 'Template 1',
          subject: 'Subject 1',
          content: 'Content 1',
          version: 1,
          is_active: true,
        },
        {
          id: '2',
          code: 'template2',
          name: 'Template 2',
          subject: 'Subject 2',
          content: 'Content 2',
          version: 1,
          is_active: true,
        },
      ];

      mockRepository.findAndCount.mockResolvedValue([mockTemplates, 2]);

      const result = await service.findAll(1, 10);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.has_next).toBe(false);
    });
  });
});
