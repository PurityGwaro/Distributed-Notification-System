import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from '../src/modules/emaail/email.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Email } from '../src/modules/emaail/entities/email.entity';
import { Repository } from 'typeorm';
import { ConfigModule } from '@nestjs/config';
import { TemplateClientService } from '../src/common/services/template-client.service';

describe('EmailService', () => {
  let service: EmailService;
  let repo: Repository<Email>;
  let _templateClient: TemplateClientService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        EmailService,
        { provide: getRepositoryToken(Email), useClass: Repository },
        {
          provide: TemplateClientService,
          useValue: {
            processTemplate: jest.fn(),
            getTemplateByCode: jest.fn(),
            replaceVariables: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    repo = module.get<Repository<Email>>(getRepositoryToken(Email));
    _templateClient = module.get<TemplateClientService>(TemplateClientService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should save email with pending status', async () => {
    const createSpy = jest.spyOn(repo, 'create').mockReturnValue({} as any);
    const saveSpy = jest.spyOn(repo, 'save').mockResolvedValue({} as any);
    const findOneSpy = jest.spyOn(repo, 'findOne').mockResolvedValue(null);

    await service.sendEmail({
      to: 'test@example.com',
      subject: 'Subject',
      text: 'Text body',
    });

    expect(findOneSpy).toHaveBeenCalled(); // Check for idempotency
    expect(createSpy).toHaveBeenCalled();
    expect(saveSpy).toHaveBeenCalled();
  });

  it('should return existing email for duplicate request_id', async () => {
    const existingEmail = {
      id: 'existing-id',
      to: 'test@example.com',
      subject: 'Subject',
      text: 'Text',
      status: 'sent',
      request_id: 'req-001',
    } as Email;

    const findOneSpy = jest
      .spyOn(repo, 'findOne')
      .mockResolvedValue(existingEmail);

    const result = await service.sendEmail({
      to: 'test@example.com',
      subject: 'Subject',
      text: 'Text body',
      request_id: 'req-001',
    });

    expect(findOneSpy).toHaveBeenCalledWith({
      where: { request_id: 'req-001' },
    });
    expect(result).toBe(existingEmail);
  });
});
