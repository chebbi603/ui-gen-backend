import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../user/entities/user.entity';

export type EventDocument = Event & Document;

@Schema({ timestamps: true })
export class Event extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ type: Date, required: true })
  timestamp: Date;

  @Prop({ type: String, minlength: 1, required: true })
  componentId: string;

  @Prop({ type: String, enum: ['tap', 'view', 'input'], required: true })
  eventType: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  data: any;
}

export const EventSchema = SchemaFactory.createForClass(Event);