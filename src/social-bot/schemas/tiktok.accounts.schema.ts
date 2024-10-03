import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type TiktokAccountDocument = mongoose.HydratedDocument<TiktokAccount>;

@Schema()
export class TiktokAccount {
  @Prop()
  tiktokAccount: string;
  @Prop()
  trackerChatId: string;
  @Prop()
  accountFollowers: string[];
  @Prop()
  accountFollowing: string;
}

export const TiktokAccountSchema = SchemaFactory.createForClass(TiktokAccount);
