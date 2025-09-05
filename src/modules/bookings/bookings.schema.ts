import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum BookingStatus {
  PENDING = 'en_attente',
  CONFIRMED = 'confirmée',
  CANCELLED = 'annulée',
  COMPLETED = 'terminée',
}

export enum PaymentStatus {
  PENDING = 'en_attente',
  PAID = 'payé',
  FAILED = 'échoué',
  REFUNDED = 'remboursé',
}

export type BookingDocument = Booking & Document;

@Schema({ timestamps: true })
export class Booking {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Retreat', required: true })
  retreatId: Types.ObjectId;

  @Prop({ required: true })
  dateStart: Date;

  @Prop({ required: true })
  dateEnd: Date;

  @Prop({ required: true, min: 1 })
  nbPlaces: number;

  @Prop({ required: true, min: 0 })
  prixTotal: number;

  @Prop({ 
    required: true, 
    enum: BookingStatus, 
    default: BookingStatus.PENDING 
  })
  statut: BookingStatus;

  @Prop({ 
    required: true, 
    enum: PaymentStatus, 
    default: PaymentStatus.PENDING 
  })
  statutPaiement: PaymentStatus;

  @Prop()
  stripePaymentIntentId?: string;

  @Prop()
  notes?: string;

  @Prop()
  annulationRaison?: string;

  @Prop()
  annulationDate?: Date;

  @Prop({ computed: true })
  get isActive(): boolean {
    return this.statut === BookingStatus.CONFIRMED && 
           this.statutPaiement === PaymentStatus.PAID;
  }
}

export const BookingSchema = SchemaFactory.createForClass(Booking);

// Index pour optimiser les recherches
BookingSchema.index({ userId: 1 });
BookingSchema.index({ retreatId: 1 });
BookingSchema.index({ statut: 1 });
BookingSchema.index({ dateStart: 1 });
BookingSchema.index({ createdAt: -1 });

// Validation : vérifier que les dates sont cohérentes avec la retraite
BookingSchema.pre('save', async function(next) {
  if (this.isModified('dateStart') || this.isModified('dateEnd')) {
    // TODO: Vérifier que les dates correspondent à une session de la retraite
    // TODO: Vérifier qu'il y a assez de places disponibles
  }
  next();
});
