// Import des fonctionnalités NATIVES de NestJS
import { Module } from '@nestjs/common';

// Import de notre service et contrôleur email
import { EmailService } from './email.service';
import { EmailController } from './email.controller';

@Module({
  // Contrôleurs disponibles dans ce module
  controllers: [
    EmailController
  ],
  
  // Services disponibles dans ce module
  providers: [
    EmailService    // Service d'envoi d'emails avec Resend
  ],
  
  // Services exportés pour être utilisés par d'autres modules
  exports: [
    EmailService    // Permet à UsersModule d'utiliser EmailService
  ]
})
export class EmailModule {}
