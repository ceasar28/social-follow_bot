import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type InstagramAccountDocument =
  mongoose.HydratedDocument<InstagramAccount>;

@Schema()
export class InstagramAccount {
  @Prop()
  instagramAccount: string;
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
  @Prop()
  alertedFollowers: any[];
}

export const InstagramAccountSchema =
  SchemaFactory.createForClass(InstagramAccount);
