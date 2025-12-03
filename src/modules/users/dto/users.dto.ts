import { IsEmail, IsString, IsNotEmpty, IsOptional, MinLength, Matches } from 'class-validator';
import { UserRole } from '../users.schema';

// DTO pour la création d'utilisateur
export class CreateUserDto {
  @IsEmail({}, { message: 'Format d\'email invalide' })
  email: string;

  // Mot de passe avec règles strictes : min 8 caractères, majuscule, minuscule, chiffre, caractère spécial
  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    { 
      message: 'Le mot de passe doit contenir au moins une minuscule, une majuscule, un chiffre et un caractère spécial (@$!%*?&)' 
    }
  )
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Le prénom est obligatoire' })
  firstName: string;

  @IsString()
  @IsNotEmpty({ message: 'Le nom de famille est obligatoire' })
  lastName: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  token?: string;
}

// DTO pour la mise à jour du profil (tous les champs sont optionnels)
export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  postalCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}

// DTO pour la mise à jour du mot de passe
export class UpdatePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe actuel est obligatoire' })
  currentPassword: string;

  // Nouveau mot de passe avec règles strictes : min 8 caractères, majuscule, minuscule, chiffre, caractère spécial
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



// DTO pour la vérification d'email lors de l'inscription
export class VerifyEmailDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  verificationCode: string;
}

// DTO pour la réponse utilisateur (sans mot de passe pour la sécurité)
export class UserResponseDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isEmailVerified: boolean;
  isActive: boolean;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  language: string;
  timezone: string;
  avatar?: string;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}
