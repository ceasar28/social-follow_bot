import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SocialBotModule } from './social-bot/social-bot.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [SocialBotModule, DatabaseModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
