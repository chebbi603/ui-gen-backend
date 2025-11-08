import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types as MongooseTypes } from 'mongoose';

@Schema({ timestamps: true })
export class LlmJob extends Document {
  @Prop({ required: true })
  jobId: string;

  @Prop({ type: MongooseTypes.ObjectId, required: true })
  userId: MongooseTypes.ObjectId;

  @Prop({ type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' })
  status: 'pending' | 'processing' | 'completed' | 'failed';

  @Prop({ type: Number, default: 0 })
  progress: number;

  @Prop({ type: String })
  errorMessage?: string;

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
  completedAt?: Date;

  @Prop({ type: Number })
  durationMs?: number;

  @Prop({ type: String })
  model?: string;

  @Prop({ type: Number })
  tokenInput?: number;

  @Prop({ type: Number })
  tokenOutput?: number;

  @Prop({ type: String })
  reasoning?: string;

  @Prop({ type: Object })
  analyzedMetrics?: Record<string, any>;

  // Debug logging for LLM interactions
  @Prop({ type: Object })
  requestPayload?: Record<string, any>;

  @Prop({ type: String })
  responseText?: string;

  @Prop({ type: MongooseTypes.ObjectId })
  contractId?: MongooseTypes.ObjectId;
}

export const LlmJobSchema = SchemaFactory.createForClass(LlmJob);

LlmJobSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
});