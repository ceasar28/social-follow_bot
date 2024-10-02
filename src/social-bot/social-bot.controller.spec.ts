import { Test, TestingModule } from '@nestjs/testing';
import { SocialBotController } from './social-bot.controller';

describe('SocialBotController', () => {
  let controller: SocialBotController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SocialBotController],
    }).compile();

    controller = module.get<SocialBotController>(SocialBotController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
