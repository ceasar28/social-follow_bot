import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import * as mongoose from 'mongoose';

export type SessionDocument = mongoose.HydratedDocument<Session>;

@Schema()
export class Session {
  @Prop()
  userChatId: number;
  @Prop()
  prompt: boolean;
  @Prop()
  type: string;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
