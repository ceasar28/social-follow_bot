import { Module } from '@nestjs/common';
import { SocialBotService } from './social-bot.service';
import { SocialBotController } from './social-bot.controller';

@Module({
  providers: [SocialBotService],
  controllers: [SocialBotController]
})
export class SocialBotModule {}
