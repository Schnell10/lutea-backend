import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RetreatDocument = Retreat & Document;

@Schema({ timestamps: true })
export class Retreat {
  _id: Types.ObjectId;

  @Prop({ required: true })
  titreCard: string;

  @Prop({ required: true })
  imageCard: string;

  @Prop({ required: true })
  altImageCard: string;

  @Prop({ 
    type: [String], 
    required: true,
    validate: {
      validator: function(images: string[]) {
        return images.length >= 1 && images.length <= 6;
      },
      message: 'Une retraite doit avoir entre 1 et 6 images dans la modal'
    }
  })
  imageModal: string[];

  @Prop({ 
    type: [String], 
    required: true,
    validate: {
      validator: function(altTexts: string[]) {
        return altTexts.length >= 1 && altTexts.length <= 6;
      },
      message: 'Une retraite doit avoir entre 1 et 6 textes alternatifs pour la modal'
    }
  })
  altImageModal: string[];

  @Prop({ required: true })
  texteModal: string;

  @Prop({ required: false })
  boutonPdfLabel?: string;

  @Prop({ required: false })
  pdfUrl?: string;

  @Prop({ required: false, min: 0 })
  prix?: number;

  @Prop({ required: false, min: 1 })
  places?: number;

  @Prop({ required: false })
  adresseRdv?: string;

  @Prop({
    type: [{
      start: { type: Date, required: true },
      end: { type: Date, required: true },
      heureArrivee: { type: String, required: false },
      heureDepart: { type: String, required: false },
      prix: { type: Number, required: true, min: 0 },
      places: { type: Number, required: true, min: 1 },
      adresseRdv: { type: String, required: true }
    }],
    required: false, // Peut être vide pour les retraites sans dates
    validate: {
      validator: function(dates: any[]) {
        if (dates.length === 0) return true; // Permet les retraites sans dates
        return dates.every(date => date.start < date.end);
      },
      message: 'La date de début doit être antérieure à la date de fin'
    }
  })
  dates: Array<{ 
    start: Date; 
    end: Date; 
    heureArrivee?: string;
    heureDepart?: string;
    prix: number;
    places: number;
    adresseRdv: string;
  }>;

  @Prop({ default: false })
  aVenir: boolean;

  @Prop({ default: true })
  isActive: boolean; 
}

export const RetreatSchema = SchemaFactory.createForClass(Retreat);

// Index pour optimiser les recherches et le filtrage
RetreatSchema.index({ isActive: 1 });
RetreatSchema.index({ aVenir: 1 }); 
RetreatSchema.index({ 'dates.end': 1 }); 
RetreatSchema.index({ 'dates.start': 1 }); 
RetreatSchema.index({ 'dates.prix': 1 }); 
RetreatSchema.index({ 'dates.places': 1 }); 
RetreatSchema.index({ createdAt: -1 });
