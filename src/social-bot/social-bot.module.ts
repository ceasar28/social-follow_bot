import { Module } from '@nestjs/common';
import { SocialBotService } from './social-bot.service';
import { SocialBotController } from './social-bot.controller';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from 'src/database/database.module';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/users.schema';
import {
  TiktokAccount,
  TiktokAccountSchema,
} from './schemas/tiktok.accounts.schema';
import { TiktokJob, TiktokJobSchema } from './schemas/job.schema';
import {
  AddedFollower,
  AddedFollowerSchema,
} from './schemas/addedFollower.schema';

@Module({
  imports: [
    HttpModule,
    DatabaseModule,
    MongooseModule.forFeature([
      { name: TiktokAccount.name, schema: TiktokAccountSchema },
    ]),
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MongooseModule.forFeature([
      { name: TiktokJob.name, schema: TiktokJobSchema },
    ]),
    MongooseModule.forFeature([
      { name: AddedFollower.name, schema: AddedFollowerSchema },
    ]),
  ],
  providers: [SocialBotService],
  controllers: [SocialBotController],
})
export class SocialBotModule {}
