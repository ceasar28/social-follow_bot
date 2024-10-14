import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type AddedFollowerDocument = mongoose.HydratedDocument<AddedFollower>;

@Schema()
export class AddedFollower {
  @Prop()
  username: string;
}

export const AddedFollowerSchema = SchemaFactory.createForClass(AddedFollower);
