// Import des fonctionnalités NATIVES de NestJS et Mongoose
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

// Énumération des rôles utilisateur
export enum UserRole {
  CLIENT = 'client',  // Rôle par défaut
  ADMIN = 'admin',    // Rôle administrateur
}

// Type TypeScript pour un document utilisateur avec méthodes Mongoose
export type UserDocument = User & Document;

// Décorateur Schema : Indique à Mongoose que c'est un schéma MongoDB
@Schema({ timestamps: true })
export class User {
  // MongoDB génère automatiquement un _id unique
  _id: Types.ObjectId;

  // INFORMATIONS DE BASE (OBLIGATOIRES)
  @Prop({ required: true, unique: true })
  email: string;                    // Email unique

  @Prop({ required: true })
  password: string;                 // Mot de passe haché

  @Prop({ required: true })
  firstName: string;                // Prénom

  @Prop({ required: true })
  lastName: string;                 // Nom

  // RÔLE ET STATUT
  @Prop({ required: true, enum: UserRole, default: UserRole.CLIENT })
  role: UserRole;                   // Rôle (CLIENT par défaut)

  @Prop({ default: false })
  isEmailVerified: boolean;         // Email vérifié ou non

  // SÉCURITÉ ET AUTHENTIFICATION
  @Prop({ default: 0 })
  failedLoginAttempts: number;      // Nombre d'échecs de connexion

  @Prop()
  lockUntil?: Date;                 // Date de fin de verrouillage

  @Prop()
  lastLogin?: Date;                 // Dernière connexion réussie

  // DOUBLE AUTHENTIFICATION (2FA)
  @Prop()
  verificationCode?: string;        // Code de vérification

  @Prop()
  verificationCodeExpires?: Date;   // Expiration du code

  // Limitation des essais 2FA
  @Prop({ default: 0 })
  verificationCodeAttempts?: number; // Nombre d'essais sur le code actif

  // RÉINITIALISATION DE MOT DE PASSE
  @Prop()
  passwordResetToken?: string;        // Token de réinitialisation

  @Prop()
  passwordResetExpires?: Date;        // Expiration du token

  // RATE LIMITING POUR RÉINITIALISATION
  @Prop({ default: 0 })
  passwordResetAttempts?: number;     // Nombre de tentatives de réinitialisation

  @Prop()
  passwordResetLastAttempt?: Date;    // Dernière tentative de réinitialisation

  // INFORMATIONS DE CONTACT (OBLIGATOIRES)
  @Prop({ required: true })
  phone: string;                   // Téléphone

  @Prop({ required: true })
  address: string;                 // Adresse

  @Prop({ required: true })
  city: string;                    // Ville

  @Prop({ required: true })
  postalCode: string;              // Code postal

  @Prop({ required: true })
  country: string;                 // Pays
}

// Création du schéma Mongoose à partir de la classe User
export const UserSchema = SchemaFactory.createForClass(User);

// SCHÉMA TEMPORAIRE POUR LES INSCRIPTIONS EN ATTENTE
@Schema({ timestamps: true })
export class TemporaryUser {
  // MongoDB génère automatiquement un _id unique
  _id: Types.ObjectId;

  // INFORMATIONS DE BASE (OBLIGATOIRES)
  @Prop({ required: true, unique: true })
  email: string;                    // Email unique

  @Prop({ required: true })
  password: string;                 // Mot de passe haché

  @Prop({ required: true })
  firstName: string;                // Prénom

  @Prop({ required: true })
  lastName: string;                 // Nom

  // RÔLE ET STATUT
  @Prop({ required: true, enum: UserRole, default: UserRole.CLIENT })
  role: UserRole;                   // Rôle (CLIENT par défaut)

  // INFORMATIONS DE CONTACT (OBLIGATOIRES)
  @Prop({ required: true })
  phone: string;                   // Téléphone

  @Prop({ required: true })
  address: string;                 // Adresse

  @Prop({ required: true })
  city: string;                    // Ville

  @Prop({ required: true })
  postalCode: string;              // Code postal

  @Prop({ required: true })
  country: string;                 // Pays

  // TOKEN DE VALIDATION
  @Prop({ required: true })
  verificationToken: string;       // Token unique pour validation

  // EXPIRATION
  @Prop({ required: true })
  expiresAt: Date;                // Date d'expiration (24h)
}

// Type TypeScript pour un document temporaire
export type TemporaryUserDocument = TemporaryUser & Document;

// Création du schéma temporaire
export const TemporaryUserSchema = SchemaFactory.createForClass(TemporaryUser);

// INDEX POUR OPTIMISER LES RECHERCHES
// Les index accélèrent les requêtes sur les champs fréquemment utilisés
// Note : L'index sur email est créé automatiquement par unique: true

// role: 1 : Index sur le rôle (accélère les recherches par rôle)
UserSchema.index({ role: 1 });

// createdAt: -1 : Index sur la date de création (-1 = ordre décroissant)
// Utile pour trier les utilisateurs par date de création
UserSchema.index({ createdAt: -1 });

// passwordResetToken: 1 : Index sur le token de réinitialisation
// Utile pour les recherches rapides de token
UserSchema.index({ passwordResetToken: 1 });

// Index pour le schéma temporaire
TemporaryUserSchema.index({ expiresAt: 1 }); // Pour nettoyage automatique
TemporaryUserSchema.index({ verificationToken: 1 }); // Pour validation rapide
