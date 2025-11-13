// Import des fonctionnalités NATIVES de NestJS
import { Module } from '@nestjs/common';

// Import du module de configuration
import { ConfigModule } from '@nestjs/config';

// Import du module Mongoose pour MongoDB
import { MongooseModule } from '@nestjs/mongoose';

// Import du module TypeORM pour MySQL
import { TypeOrmModule } from '@nestjs/typeorm';

// Import du module de planification (cron jobs)
import { ScheduleModule } from '@nestjs/schedule';

// Import du module Throttler pour le rate limiting
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

// Import de nos modules personnalisés
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';
import { RetreatsModule } from './modules/retreats/retreats.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { StripeModule } from './modules/stripe/stripe.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';


@Module({
  imports: [
    // Configuration des variables d'environnement
    ConfigModule.forRoot({
      isGlobal: true, // Disponible dans tous les modules
    }),
    
    // Configuration du rate limiting (limitation des requêtes)
    ThrottlerModule.forRoot([{
      ttl: 60000,        // 1 minute (en millisecondes)
      limit: 100,        // 100 requêtes par minute par IP
    }]),
    
    // Connexion à MongoDB
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/lutea'
    ),
    
    // Connexion à MySQL pour Analytics
    // Note: TypeORM se connecte de manière asynchrone, ne bloque pas MongoDB
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.MYSQL_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_PORT || '3306'),
      username: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'lutea_analytics',
      entities: [__dirname + '/modules/analytics/entities/*.entity{.ts,.js}'],
      synchronize: false, // Désactivé car les tables sont créées manuellement via SQL
      logging: false, // Désactivé pour réduire les logs (seulement les messages importants)
    }),
    
    // Module de planification pour les cron jobs
    ScheduleModule.forRoot(),
    
    // Nos modules personnalisés
    EmailModule,    // Service d'envoi d'emails
    UsersModule,    // Gestion des utilisateurs
    AuthModule,     // Authentification et autorisation
    RetreatsModule, // Gestion des retraites
    BookingsModule, // Gestion des réservations
    StripeModule,   // Intégration Stripe
    AnalyticsModule, // Analytics et logs
  ],
  
  // Contrôleurs globaux (si nécessaire)
  controllers: [],
  
  // Services globaux (si nécessaire)
  providers: [
    // Activation globale du rate limiting
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}