// Import des décorateurs de validation NATIFS de class-validator
import { 
  IsString, 
  IsNotEmpty, 
  IsDateString, 
  IsNumber, 
  IsArray, 
  ValidateNested, 
  IsOptional, 
  IsEmail, 
  Min, 
  Max,
  IsObject,
  IsEnum
} from 'class-validator';
import { Type } from 'class-transformer';
import { BookingStatus } from './bookings.schema';

// DTO pour un participant
export class ParticipantDto {
  @IsString({ message: 'Le prénom doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le prénom est requis' })
  prenom: string;

  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le nom est requis' })
  nom: string;

  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  @IsNotEmpty({ message: 'L\'email est requis' })
  email: string;
}

// DTO pour l'adresse de facturation
export class BillingAddressDto {
  @IsString({ message: 'L\'adresse doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'L\'adresse est requise' })
  address: string;

  @IsString({ message: 'La ville doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'La ville est requise' })
  city: string;

  @IsString({ message: 'Le code postal doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le code postal est requis' })
  postalCode: string;

  @IsString({ message: 'Le pays doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le pays est requis' })
  country: string;

  @IsString({ message: 'Le téléphone doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le téléphone est requis' })
  phone: string;
}

// DTO pour créer un booking
export class CreateBookingDto {
  @IsString({ message: 'L\'ID de la retraite doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'L\'ID de la retraite est requis' })
  retreatId: string;

  // Informations spécifiques de la retraite sélectionnée (viennent du tunnel de réservation)
  @IsOptional()
  @IsString({ message: 'Le nom de la retraite doit être une chaîne' })
  retreatName?: string;

  @IsOptional()
  @IsString({ message: 'L\'adresse de la retraite doit être une chaîne' })
  retreatAddress?: string;

  @IsOptional()
  @IsString({ message: 'L\'heure d\'arrivée doit être une chaîne' })
  retreatHeureArrivee?: string;

  @IsOptional()
  @IsString({ message: 'L\'heure de départ doit être une chaîne' })
  retreatHeureDepart?: string;

  @IsDateString({}, { message: 'La date de début doit être une date valide' })
  @IsNotEmpty({ message: 'La date de début est requise' })
  dateStart: string | Date; // ISO string ou Date

  @IsDateString({}, { message: 'La date de fin doit être une date valide' })
  @IsNotEmpty({ message: 'La date de fin est requise' })
  dateEnd: string | Date; // ISO string ou Date

  @IsNumber({}, { message: 'Le nombre de places doit être un nombre' })
  @Min(1, { message: 'Le nombre de places doit être au moins 1' })
  @Max(20, { message: 'Le nombre de places ne peut pas dépasser 20' })
  nbPlaces: number;

  @IsArray({ message: 'Les participants doivent être un tableau' })
  @ValidateNested({ each: true })
  @Type(() => ParticipantDto)
  participants: ParticipantDto[];

  @IsObject({ message: 'L\'adresse de facturation doit être un objet' })
  @ValidateNested()
  @Type(() => BillingAddressDto)
  billingAddress: BillingAddressDto;

  @IsString({ message: 'Les notes doivent être une chaîne de caractères' })
  @IsOptional()
  notes?: string;

  @IsEnum(BookingStatus, { message: 'Le statut doit être une valeur valide (PENDING, CONFIRMED, CANCELLED, COMPLETED)' })
  @IsOptional()
  statut?: BookingStatus;
}

// DTO pour vérifier les places disponibles
export class AvailablePlacesDto {
  @IsString({ message: 'L\'ID de la retraite doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'L\'ID de la retraite est requis' })
  retreatId: string;

  @IsDateString({}, { message: 'La date doit être une date valide' })
  @IsNotEmpty({ message: 'La date est requise' })
  date: string; // ISO string
}

// DTO pour annuler un booking
export class CancelBookingDto {
  @IsString({ message: 'La raison doit être une chaîne de caractères' })
  @IsOptional()
  raison?: string;
}

// DTO pour confirmer un booking
export class ConfirmBookingDto {
  @IsString({ message: 'L\'ID du paiement Stripe doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'L\'ID du paiement Stripe est requis' })
  stripePaymentIntentId: string;
}


// DTO pour les statistiques de booking (réponse)
export class BookingStatsDto {
  @IsNumber()
  totalBookings: number;

  @IsNumber()
  confirmedBookings: number;

  @IsNumber()
  pendingBookings: number;

  @IsNumber()
  cancelledBookings: number;

  @IsNumber()
  totalRevenue: number;

  @IsNumber()
  averageBookingValue: number;
}

// DTO pour les incohérences de paiement (réponse)
export class PaymentDiscrepancyDto {
  @IsNumber()
  totalDiscrepancies: number;

  @IsNumber()
  retreatsWithIssues: number;

  @IsArray()
  discrepancies: Array<{
    retreatId: string;
    retreatTitle: string;
    issues: string[];
  }>;
}
