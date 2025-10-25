import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../user/entities/user.entity';

export type SessionDocument = Session & Document;

@Schema({ timestamps: true })
export class Session extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.Mixed })
  deviceInfo: any;
}

export const SessionSchema = SchemaFactory.createForClass(Session);