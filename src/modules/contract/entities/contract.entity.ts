import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../user/entities/user.entity';

export type ContractDocument = Contract & Document;

@Schema({ timestamps: true })
export class Contract extends Document {
  @Prop({ type: MongooseSchema.Types.Mixed, required: true })
  json: any;

  @Prop({ type: String, match: /^\d+\.\d+\.\d+$/ })
  version: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  meta: any;

  // Target user this contract applies to
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name })
  userId?: MongooseSchema.Types.ObjectId;

  // User who created/uploaded the contract record
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name })
  createdBy: MongooseSchema.Types.ObjectId;
}

export const ContractSchema = SchemaFactory.createForClass(Contract);
ContractSchema.index({ version: 1 });
ContractSchema.index({ userId: 1, createdAt: -1 });
ContractSchema.index({ createdAt: -1 });
