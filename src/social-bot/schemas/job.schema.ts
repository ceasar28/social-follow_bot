import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type TwitterJobDocument = mongoose.HydratedDocument<TwitterJob>;

@Schema()
export class TwitterJob {
  @Prop()
  isJobRunning: boolean;
}
export const TwitterJobSchema = SchemaFactory.createForClass(TwitterJob);

export type TiktokJobDocument = mongoose.HydratedDocument<TiktokJob>;
@Schema()
export class TiktokJob {
  @Prop()
  isJobRunning: boolean;
}

export const TiktokJobSchema = SchemaFactory.createForClass(TiktokJob);
