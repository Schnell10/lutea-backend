// Import des fonctionnalités NATIVES de class-validator
import { IsEmail, IsString, IsNotEmpty, IsOptional, MinLength, Matches } from 'class-validator';

// Import de notre énumération des rôles
import { UserRole } from '../users.schema';

// DTO POUR LA CRÉATION D'UTILISATEUR
export class CreateUserDto {
  // Email de l'utilisateur
  // @IsEmail() : Valide que c'est un email valide (format user@domain.com)
  @IsEmail({}, { message: 'Format d\'email invalide' })
  email: string;

  // Mot de passe de l'utilisateur avec règles strictes
  // @IsString() : Valide que c'est une chaîne de caractères
  // @MinLength(8) : Valide que la longueur est au moins 8 caractères
  // @Matches() : Valide que le mot de passe respecte les règles de sécurité
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    { 
      message: 'Le mot de passe doit contenir au moins une minuscule, une majuscule, un chiffre et un caractère spécial (@$!%*?&)' 
    }
  )
  password: string;

  // Prénom de l'utilisateur
  // @IsString() : Valide que c'est une chaîne de caractères
  // @IsNotEmpty() : Valide que le champ n'est pas vide
  @IsString()
  @IsNotEmpty({ message: 'Le prénom est obligatoire' })
  firstName: string;

  // Nom de famille de l'utilisateur
  @IsString()
  @IsNotEmpty({ message: 'Le nom de famille est obligatoire' })
  lastName: string;

  // CHAMPS OPTIONNELS
  // @IsOptional() : Indique que le champ n'est pas obligatoire
  // @IsString() : Valide que c'est une chaîne si fournie

  // Numéro de téléphone (optionnel)
  @IsOptional()
  @IsString()
  phone?: string;

  // Adresse postale (optionnel)
  @IsOptional()
  @IsString()
  address?: string;

  // Ville (optionnel)
  @IsOptional()
  @IsString()
  city?: string;

  // Code postal (optionnel)
  @IsOptional()
  @IsString()
  postalCode?: string;

  // Pays (optionnel)
  @IsOptional()
  @IsString()
  country?: string;
}

// DTO POUR LA MISE À JOUR DU PROFIL
// Tous les champs sont optionnels car on peut modifier seulement certains champs
export class UpdateProfileDto {
  // Prénom (optionnel)
  @IsOptional()
  @IsString()
  firstName?: string;

  // Nom de famille (optionnel)
  @IsOptional()
  @IsString()
  lastName?: string;

  // Numéro de téléphone (optionnel)
  @IsOptional()
  @IsString()
  phone?: string;

  // Adresse postale (optionnel)
  @IsOptional()
  @IsString()
  address?: string;

  // Ville (optionnel)
  @IsOptional()
  @IsString()
  city?: string;

  // Code postal (optionnel)
  @IsOptional()
  @IsString()
  postalCode?: string;

  // Pays (optionnel)
  @IsOptional()
  @IsString()
  country?: string;

  // Langue préférée (optionnel)
  @IsOptional()
  @IsString()
  language?: string;

  // Fuseau horaire (optionnel)
  @IsOptional()
  @IsString()
  timezone?: string;
}

// DTO POUR LA MISE À JOUR DU MOT DE PASSE
// Contient l'ancien mot de passe et le nouveau
export class UpdatePasswordDto {
  // Mot de passe actuel
  // @IsString() : Valide que c'est une chaîne de caractères
  // @IsNotEmpty() : Valide que le champ n'est pas vide
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe actuel est obligatoire' })
  currentPassword: string;

  // Nouveau mot de passe avec règles strictes
  // @IsString() : Valide que c'est une chaîne de caractères
  // @MinLength(8) : Valide que la longueur est au moins 8 caractères
  // @Matches() : Valide que le mot de passe respecte les règles de sécurité
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    { 
      message: 'Le mot de passe doit contenir au moins une minuscule, une majuscule, un chiffre et un caractère spécial (@$!%*?&)' 
    }
  )
  newPassword: string;
}



// DTO POUR LA VÉRIFICATION D'EMAIL
// Utilisé pour vérifier l'email lors de l'inscription
export class VerifyEmailDto {
  // Email de l'utilisateur
  @IsEmail()
  email: string;

  // Code de vérification reçu par email
  @IsString()
  @IsNotEmpty()
  verificationCode: string;
}

// DTO POUR LA RÉPONSE UTILISATEUR (sans mot de passe)
// Structure de la réponse envoyée au client
// Ne contient JAMAIS le mot de passe pour des raisons de sécurité
export class UserResponseDto {
  // ID de l'utilisateur (MongoDB ObjectId converti en string)
  id: string;
  
  // Email de l'utilisateur
  email: string;
  
  // Prénom de l'utilisateur
  firstName: string;
  
  // Nom de famille de l'utilisateur
  lastName: string;
  
  // Rôle de l'utilisateur (CLIENT ou ADMIN)
  role: UserRole;
  
  // Indique si l'email a été vérifié
  isEmailVerified: boolean;
  
  // Indique si le compte est actif
  isActive: boolean;
  
  // CHAMPS OPTIONNELS
  // Numéro de téléphone (optionnel)
  phone?: string;
  
  // Adresse postale (optionnel)
  address?: string;
  
  // Ville (optionnel)
  city?: string;
  
  // Code postal (optionnel)
  postalCode?: string;
  
  // Pays (optionnel)
  country?: string;
  
  // Langue préférée (défaut: 'fr')
  language: string;
  
  // Fuseau horaire (défaut: 'Europe/Paris')
  timezone: string;
  
  // URL de l'image de profil (optionnel)
  avatar?: string;
  
  // Date de dernière connexion (optionnel)
  lastLogin?: Date;
  
  // Date de création du compte (automatique)
  createdAt: Date;
  
  // Date de dernière modification (automatique)
  updatedAt: Date;
}
