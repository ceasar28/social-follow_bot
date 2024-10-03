import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type TwitterAccountDocument = mongoose.HydratedDocument<TwitterAccount>;

@Schema()
export class TwitterAccount {
  @Prop()
  twitterAccount: string;
  @Prop()
  accountId: string;
  @Prop()
  followers_count: bigint;
  @Prop()
  friends_count: bigint;
  @Prop()
  trackerChatId: string;
  @Prop()
  accountFollowers: string[];
}

export const TwitterAccountSchema =
  SchemaFactory.createForClass(TwitterAccount);
