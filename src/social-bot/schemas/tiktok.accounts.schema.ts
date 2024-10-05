import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type TiktokAccountDocument = mongoose.HydratedDocument<TiktokAccount>;

@Schema()
export class TiktokAccount {
  @Prop()
  tiktokAccount: string;
  @Prop()
  accountId: string;
  @Prop()
  trackerChatId: number[];
  @Prop()
  oldAccountFollowers: any[];
  @Prop()
  newAccountFollowers: any[];
}

export const TiktokAccountSchema = SchemaFactory.createForClass(TiktokAccount);
