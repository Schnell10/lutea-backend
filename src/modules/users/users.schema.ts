import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum UserRole {
  CLIENT = 'client',
  ADMIN = 'admin',
}

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, enum: UserRole, default: UserRole.CLIENT })
  role: UserRole;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ default: 0 })
  failedLoginAttempts: number;

  @Prop()
  lockUntil?: Date;

  @Prop()
  lastLogin?: Date;

  @Prop()
  verificationCode?: string;

  @Prop()
  verificationCodeExpires?: Date;

  @Prop({ default: 0 })
  verificationCodeAttempts?: number;

  @Prop()
  passwordResetToken?: string;

  @Prop()
  passwordResetExpires?: Date;

  @Prop({ default: 0 })
  passwordResetAttempts?: number;

  @Prop()
  passwordResetLastAttempt?: Date;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  address: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  postalCode: string;

  @Prop({ required: true })
  country: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

@Schema({ timestamps: true })
export class TemporaryUser {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ required: true, enum: UserRole, default: UserRole.CLIENT })
  role: UserRole;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  address: string;

  @Prop({ required: true })
  city: string;

  @Prop({ required: true })
  postalCode: string;

  @Prop({ required: true })
  country: string;

  @Prop({ required: true })
  verificationToken: string;

  @Prop({ required: true })
  expiresAt: Date;
}

export type TemporaryUserDocument = TemporaryUser & Document;

export const TemporaryUserSchema = SchemaFactory.createForClass(TemporaryUser);

// Index principaux (email déjà couvert via unique:true)
UserSchema.index({ role: 1 });
UserSchema.index({ createdAt: -1 });
UserSchema.index({ passwordResetToken: 1 });

TemporaryUserSchema.index({ expiresAt: 1 });
TemporaryUserSchema.index({ verificationToken: 1 });
