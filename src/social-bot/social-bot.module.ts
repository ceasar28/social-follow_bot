import { Module } from '@nestjs/common';
import { SocialBotService } from './social-bot.service';
import { SocialBotController } from './social-bot.controller';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from 'src/database/database.module';
import { MongooseModule } from '@nestjs/mongoose';
import {
  InstagramAccount,
  InstagramAccountSchema,
} from './schemas/instagram.accounts.schema';
import { User, UserSchema } from './schemas/users.schema';

import { InstagramJob, InstagramJobSchema } from './schemas/job.schema';

@Module({
  imports: [
    HttpModule,
    DatabaseModule,
    MongooseModule.forFeature([
      { name: InstagramAccount.name, schema: InstagramAccountSchema },
    ]),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MongooseModule.forFeature([
      { name: InstagramJob.name, schema: InstagramJobSchema },
    ]),
  ],
  providers: [SocialBotService],
  controllers: [SocialBotController],
})
export class SocialBotModule {}
