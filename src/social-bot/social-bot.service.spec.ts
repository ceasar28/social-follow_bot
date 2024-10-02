import { Test, TestingModule } from '@nestjs/testing';
import { SocialBotService } from './social-bot.service';

describe('SocialBotService', () => {
  let service: SocialBotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SocialBotService],
    }).compile();

    service = module.get<SocialBotService>(SocialBotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
