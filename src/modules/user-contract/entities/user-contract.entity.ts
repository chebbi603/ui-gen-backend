import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import { User } from '../../user/entities/user.entity';
import { Contract } from '../../contract/entities/contract.entity';

export type UserContractDocument = UserContract & Document;

@Schema({ timestamps: true })
export class UserContract extends Document {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: User.name, required: true })
  userId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: Contract.name, required: true })
  contractId: MongooseSchema.Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.Mixed })
  json: any;
}

export const UserContractSchema = SchemaFactory.createForClass(UserContract);

UserContractSchema.index({ userId: 1, contractId: 1 }, { unique: true });