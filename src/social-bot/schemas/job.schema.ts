import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type InstagramDocument = mongoose.HydratedDocument<InstagramJob>;

@Schema()
export class InstagramJob {
  @Prop()
  isJobRunning: boolean;
}
export const InstagramJobSchema = SchemaFactory.createForClass(InstagramJob);
