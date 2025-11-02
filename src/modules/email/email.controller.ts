// Import des fonctionnalités NATIVES de NestJS
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { IsString, IsEmail, IsBoolean, IsOptional } from 'class-validator';

// Import de notre service email
import { EmailService } from './email.service';

// Import du logger personnalisé
import { logger } from '../../common/utils/logger';

// DTO pour le formulaire de contact
export class ContactDto {
  @IsString()
  nom: string;

  @IsString()
  prenom: string;

  @IsEmail()
  email: string;

  @IsString()
  telephone: string;

  @IsString()
  message: string;

  @IsBoolean()
  rgpd: boolean;

  @IsOptional()
  @IsString()
  token?: string; // Token reCAPTCHA pour validation côté serveur
}

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  // ENVOI DU FORMULAIRE DE CONTACT
  @Post('contact')
  @HttpCode(HttpStatus.OK)
  async sendContactEmail(@Body() contactData: ContactDto) {
    try {
      const success = await this.emailService.sendContactEmail(contactData);
      
      if (success) {
        return { 
          success: true, 
          message: 'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.' 
        };
      } else {
        return { 
          success: false, 
          message: 'Erreur lors de l\'envoi du message. Veuillez réessayer.' 
        };
      }
    } catch (error) {
      logger.error('Erreur lors de l\'envoi de l\'email de contact:', error);
      return { 
        success: false, 
        message: 'Erreur serveur. Veuillez réessayer plus tard.' 
      };
    }
  }
}
