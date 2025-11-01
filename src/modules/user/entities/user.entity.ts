import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ type: String })
  name: string;

  @Prop({ required: true })
  username: string;

  @Prop({ required: true, unique: true, match: /.+\@.+\..+/ })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ type: [String], default: [] })
  refreshTokens: string[];

  @Prop({ required: true })
  role: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Indexes for fast lookups
// Ensure unique index on email for fast login and deduplication
UserSchema.index({ email: 1 }, { unique: true });
// Optional non-unique index on username to support username-based queries
UserSchema.index({ username: 1 });

UserSchema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.refreshTokens;
    return ret;
  },
});
