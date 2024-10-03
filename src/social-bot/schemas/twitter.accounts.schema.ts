import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type TwitterAccountDocument = mongoose.HydratedDocument<TwitterAccount>;

@Schema()
export class TwitterAccount {
  @Prop()
  twitterAccount: string;
  @Prop()
  trackerChatId: string;
  @Prop()
  accountFollowers: string[];
  @Prop()
  accountFollowing: string;
}

export const TwitterAccountSchema =
  SchemaFactory.createForClass(TwitterAccount);
