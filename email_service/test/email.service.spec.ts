import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from '../src/modules/emaail/email.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Email } from '../src/modules/emaail/entities/email.entity';
import { Repository } from 'typeorm';
import { ConfigModule } from '@nestjs/config';

describe('EmailService', () => {
  let service: EmailService;
  let repo: Repository<Email>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      providers: [
        EmailService,
        { provide: getRepositoryToken(Email), useClass: Repository },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    repo = module.get<Repository<Email>>(getRepositoryToken(Email));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should save email with pending status', async () => {
    const createSpy = jest.spyOn(repo, 'create').mockReturnValue({} as any);
    const saveSpy = jest.spyOn(repo, 'save').mockResolvedValue({} as any);

    await service.sendEmail('test@example.com', 'Subject', 'Text body');

    expect(createSpy).toHaveBeenCalled();
    expect(saveSpy).toHaveBeenCalled();
  });
});
