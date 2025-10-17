import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export enum BookingStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export type BookingDocument = Booking & Document;

@Schema({ timestamps: true })
export class Booking {
  _id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: false })
  userId?: Types.ObjectId;

  @Prop({ required: true, default: false })
  isGuest: boolean;

  @Prop({ required: true, default: true })
  isStripeBooking: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Retreat', required: true })
  retreatId: Types.ObjectId;

  // Informations de la retraite au moment de la réservation (pour éviter les problèmes si la retraite est supprimée)
  @Prop({ required: true })
  retreatName: string;

  @Prop({ required: false })
  retreatAddress?: string;

  @Prop({ required: false })
  retreatHeureArrivee?: string;

  @Prop({ required: false })
  retreatHeureDepart?: string;

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
    type: [{
      prenom: { type: String, required: true },
      nom: { type: String, required: true },
      email: { type: String, required: true }
    }]
  })
  participants: Array<{
    prenom: string;
    nom: string;
    email: string;
  }>;

  @Prop({ 
    required: true,
    type: {
      address: { type: String, required: true },
      city: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, required: true },
      phone: { type: String, required: true }
    }
  })
  billingAddress: {
    address: string;
    city: string;
    postalCode: string;
    country: string;
    phone: string;
  };

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

// Index composé pour optimiser le cron de vérification des incohérences
BookingSchema.index({ 
  createdAt: -1, 
  retreatId: 1, 
  dateStart: 1 
});

