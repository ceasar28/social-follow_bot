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
  follwersCount: number;
  @Prop()
  trackerChatId: number[];
  @Prop()
  oldAccountFollowers: any[];
  @Prop()
  newAccountFollowers: any[];
}

export const TwitterAccountSchema =
  SchemaFactory.createForClass(TwitterAccount);
