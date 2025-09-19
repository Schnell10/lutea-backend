import { IsString, IsNotEmpty, IsOptional, IsNumber, IsObject } from 'class-validator';

export class CreatePaymentIntentDto {
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsObject()
  @IsOptional()
  metadata?: any;
}

export class GetPaymentIntentDto {
  @IsString()
  @IsNotEmpty()
  paymentIntentId: string;
}

export class CancelPaymentIntentDto {
  @IsString()
  @IsNotEmpty()
  paymentIntentId: string;
}

