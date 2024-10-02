import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { SocialBotService } from './social-bot.service';

@Controller('social-bot')
export class SocialBotController {
  constructor(private botService: SocialBotService) {}

  @HttpCode(HttpStatus.OK)
  @Get('twitter')
  querytwitter() {
    // return this.botService.queryTwitter();
  }

  @HttpCode(HttpStatus.OK)
  @Get('tiktok')
  allToken() {
    // return this.botService.queryTiktok();
  }
}
