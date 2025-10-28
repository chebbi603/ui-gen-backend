import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../user/entities/user.entity';

export type SessionDocument = Session & Document;

@Schema({ timestamps: true })
export class Session extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ type: Date, default: Date.now })
  startedAt: Date;

  @Prop({ type: Date })
  endedAt?: Date;

  @Prop({ type: String })
  deviceInfo?: string;

  @Prop({ type: String, required: true })
  contractVersion: string;

  @Prop({ type: String })
  platform?: string;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
// Compound indexes for listing and lookups
SessionSchema.index({ userId: 1, startedAt: 1 });