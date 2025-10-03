// Import des décorateurs de validation NATIFS de class-validator
import { IsEmail, IsNotEmpty, IsString, MinLength, Matches, Length } from 'class-validator';

// DTO pour la connexion utilisateur
export class LoginDto {
  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  @IsNotEmpty({ message: 'L\'email est requis' })
  email: string;

  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  password: string;
}

// DTO pour la génération du code 2FA (admin)
export class GenerateCodeDto {
  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  @IsNotEmpty({ message: 'L\'email est requis' })
  email: string;
}

// DTO pour la vérification du code 2FA
export class VerifyCodeDto {
  @IsString({ message: 'Le code doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le code est requis' })
  @Length(8, 8, { message: 'Le code doit contenir exactement 8 chiffres' })
  @Matches(/^\d{8}$/, { message: 'Le code doit contenir uniquement des chiffres' })
  code: string;
}

// DTO pour la finalisation de la connexion admin avec 2FA
export class FinalizeLoginDto {
  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  @IsNotEmpty({ message: 'L\'email est requis' })
  email: string;

  @IsString({ message: 'Le code doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le code est requis' })
  @Length(8, 8, { message: 'Le code doit contenir exactement 8 chiffres' })
  @Matches(/^\d{8}$/, { message: 'Le code doit contenir uniquement des chiffres' })
  code: string;
}

// DTO pour la demande de réinitialisation de mot de passe
export class RequestPasswordResetDto {
  @IsEmail({}, { message: 'Veuillez fournir une adresse email valide' })
  @IsNotEmpty({ message: 'L\'email est requis' })
  email: string;
}

// DTO pour la réinitialisation de mot de passe
export class ResetPasswordDto {
  @IsString({ message: 'Le token doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le token est requis' })
  token: string;

  @IsString({ message: 'Le mot de passe doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le nouveau mot de passe est requis' })
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    { 
      message: 'Le mot de passe doit contenir au moins une minuscule, une majuscule, un chiffre et un caractère spécial' 
    }
  )
  newPassword: string;
}

// DTO pour la validation d'email
export class ValidateEmailDto {
  @IsString({ message: 'Le token doit être une chaîne de caractères' })
  @IsNotEmpty({ message: 'Le token est requis' })
  token: string;
}