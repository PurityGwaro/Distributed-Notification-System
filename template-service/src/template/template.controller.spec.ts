import { Test, TestingModule } from '@nestjs/testing';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';
import { CreateTemplateDto } from './dto/template.dto';

describe('TemplateController', () => {
  let controller: TemplateController;
  let service: TemplateService;

  const mockTemplateService = {
    create: jest.fn(),
    findByCode: jest.fn(),
    update: jest.fn(),
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TemplateController],
      providers: [{ provide: TemplateService, useValue: mockTemplateService }],
    }).compile();

    controller = module.get<TemplateController>(TemplateController);
    service = module.get<TemplateService>(TemplateService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a template', async () => {
      const dto: CreateTemplateDto = {
        code: 'welcome_email',
        name: 'Welcome Email',
        subject: 'Welcome {{name}}',
        content: '<h1>Hello {{name}}</h1>',
      };

      const expectedResponse = {
        success: true,
        message: 'Template created successfully',
        data: { id: '123', ...dto },
      };

      mockTemplateService.create.mockResolvedValue(expectedResponse);

      const result = await controller.create(dto);

      expect(result).toEqual(expectedResponse);
      expect(service.create).toHaveBeenCalledWith(dto);
    });
  });

  describe('findByCode', () => {
    it('should find a template by code', async () => {
      const code = 'welcome_email';
      const expectedResponse = {
        success: true,
        message: 'Template retrieved successfully',
        data: { id: '123', code, name: 'Welcome' },
      };

      mockTemplateService.findByCode.mockResolvedValue(expectedResponse);

      const result = await controller.findBycode(code);

      expect(result).toEqual(expectedResponse);
      expect(service.findByCode).toHaveBeenCalledWith(code);
    });
  });
});
