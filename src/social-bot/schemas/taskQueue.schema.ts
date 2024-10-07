import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type TaskQueueDocument = mongoose.HydratedDocument<TaskQueue>;

@Schema()
export class TaskQueue {
  @Prop()
  taskQueue: any[];
  @Prop({ default: false })
  isProcessing: boolean;
}

export const TaskQueueSchema = SchemaFactory.createForClass(TaskQueue);
