import { Module } from '@nestjs/common';
import { SocialBotService } from './social-bot.service';
import { SocialBotController } from './social-bot.controller';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from 'src/database/database.module';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TwitterAccount,
  TwitterAccountSchema,
} from './schemas/twitter.accounts.schema';
import { User, UserSchema } from './schemas/users.schema';
import {
  TiktokAccount,
  TiktokAccountSchema,
} from './schemas/tiktok.accounts.schema';
import { TaskQueue, TaskQueueSchema } from './schemas/taskQueue.schema';
import {
  TiktokJob,
  TiktokJobSchema,
  TwitterJob,
  TwitterJobSchema,
} from './schemas/job.schema';

@Module({
  imports: [
    HttpModule,
    DatabaseModule,
    MongooseModule.forFeature([
      { name: TwitterAccount.name, schema: TwitterAccountSchema },
    ]),
    MongooseModule.forFeature([
      { name: TiktokAccount.name, schema: TiktokAccountSchema },
    ]),
    MongooseModule.forFeature([
      { name: TaskQueue.name, schema: TaskQueueSchema },
    ]),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MongooseModule.forFeature([
      { name: TwitterJob.name, schema: TwitterJobSchema },
    ]),
    MongooseModule.forFeature([
      { name: TiktokJob.name, schema: TiktokJobSchema },
    ]),
  ],
  providers: [SocialBotService],
  controllers: [SocialBotController],
})
export class SocialBotModule {}
