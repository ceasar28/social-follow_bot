import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type JobDocument = mongoose.HydratedDocument<Job>;

@Schema()
export class Job {
  @Prop()
  isJobRunning: boolean;
}

export const JobSchema = SchemaFactory.createForClass(Job);
