import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../user/entities/user.entity';
import { Session } from '../../session/entities/session.entity';

export type EventDocument = Event & Document;

@Schema({ timestamps: true })
export class Event extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Session.name })
  sessionId?: MongooseSchema.Types.ObjectId;

  @Prop({ type: Date, required: true })
  timestamp: Date;

  @Prop({ type: String })
  page?: string;

  @Prop({ type: String, minlength: 1, required: true })
  componentId: string;

  @Prop({
    type: String,
    enum: ['tap', 'view', 'input', 'navigate', 'error', 'form-fail'] as any,
    required: true,
  })
  eventType: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  data: any;
}

export const EventSchema = SchemaFactory.createForClass(Event);
// Compound indexes for efficient queries by user/session/timestamp
EventSchema.index({ userId: 1, sessionId: 1, timestamp: 1 });
EventSchema.index({ userId: 1, timestamp: -1 });
EventSchema.index({ timestamp: -1 });
EventSchema.index({ eventType: 1, timestamp: -1 });
