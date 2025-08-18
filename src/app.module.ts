// Import des fonctionnalités NATIVES de NestJS
import { Module } from '@nestjs/common';

// Import du module de configuration
import { ConfigModule } from '@nestjs/config';

// Import du module Mongoose pour MongoDB
import { MongooseModule } from '@nestjs/mongoose';

// Import du module de planification (cron jobs)
import { ScheduleModule } from '@nestjs/schedule';

// Import de nos modules personnalisés
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    // Configuration des variables d'environnement
    ConfigModule.forRoot({
      isGlobal: true, // Disponible dans tous les modules
    }),
    
    // Connexion à MongoDB
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/lutea'
    ),
    
    // Module de planification pour les cron jobs
    ScheduleModule.forRoot(),
    
    // Nos modules personnalisés
    EmailModule,    // Service d'envoi d'emails
    UsersModule,    // Gestion des utilisateurs
    AuthModule,     // Authentification et autorisation
  ],
  
  // Contrôleurs globaux (si nécessaire)
  controllers: [],
  
  // Services globaux (si nécessaire)
  providers: [],
})
export class AppModule {}