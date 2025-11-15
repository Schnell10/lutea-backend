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
    // MySQL est optionnel : chargé seulement si les variables sont présentes
    // Si MySQL est indisponible, l'app continue de fonctionner (seulement les analytics sont désactivées)
    // En mode test, on configure TypeORM avec une config factice pour éviter les erreurs d'injection
    ...(process.env.NODE_ENV !== 'test' && 
        process.env.MYSQL_HOST && 
        process.env.MYSQL_USER && 
        process.env.MYSQL_PASSWORD ? [
      TypeOrmModule.forRootAsync({
        useFactory: () => {
          const config: any = {
            type: 'mysql' as const,
            host: process.env.MYSQL_HOST,
            port: parseInt(process.env.MYSQL_PORT || '3306'),
            username: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE || 'lutea_analytics',
            entities: [__dirname + '/modules/analytics/entities/*.entity{.ts,.js}'],
            synchronize: false, // Désactivé car les tables sont créées manuellement via SQL
            logging: false, // Désactivé pour réduire les logs
            retryAttempts: 3, // Réessayer 3 fois en cas d'échec
            retryDelay: 3000, // Attendre 3 secondes entre chaque tentative
          };

          // Configuration SSL pour Aiven (ou autres services qui nécessitent SSL)
          // Si MYSQL_SSL_CA est fourni, utiliser le certificat CA
          // Sinon, utiliser SSL sans vérification stricte (pour Aiven)
          if (process.env.MYSQL_SSL_CA) {
            // Utiliser le certificat CA fourni
            config.ssl = {
              ca: process.env.MYSQL_SSL_CA,
              rejectUnauthorized: true,
            };
          } else if (process.env.MYSQL_SSL === 'true' || process.env.MYSQL_SSL === 'required') {
            // SSL requis mais sans certificat CA (Aiven accepte ça)
            config.ssl = {
              rejectUnauthorized: false, // Accepter le certificat sans vérification stricte
            };
          }

          return config;
        },
      }),
    ] : process.env.NODE_ENV === 'test' ? [
      // En mode test, on configure TypeORM avec une config factice
      // Cette config permet à NestJS de résoudre les dépendances TypeORM
      // On utilise forRootAsync avec une factory qui gère l'erreur de connexion
      TypeOrmModule.forRootAsync({
        useFactory: () => {
          // Configuration factice pour les tests
          // TypeORM va essayer de se connecter mais échouera, ce qui est OK
          return {
            type: 'mysql' as const,
            host: 'localhost',
            port: 3306,
            username: 'test',
            password: 'test',
            database: 'test',
            entities: [__dirname + '/modules/analytics/entities/*.entity{.ts,.js}'],
            synchronize: false,
            logging: false,
            // En mode test, on accepte que la connexion échoue
            retryAttempts: 0,
            retryDelay: 0,
            // Ne pas charger automatiquement les entités
            autoLoadEntities: false,
          };
        },
        // En mode test, on ignore les erreurs de connexion
        // L'application continuera de fonctionner même si MySQL n'est pas disponible
      }),
    ] : []),
    
    // Module de planification pour les cron jobs
    ScheduleModule.forRoot(),
    
    // Nos modules personnalisés
    EmailModule,    // Service d'envoi d'emails
    UsersModule,    // Gestion des utilisateurs
    AuthModule,     // Authentification et autorisation
    RetreatsModule, // Gestion des retraites
    BookingsModule, // Gestion des réservations
    StripeModule,   // Intégration Stripe
    // AnalyticsModule : chargé seulement si MySQL est configuré
    // Si MySQL n'est pas disponible, l'app fonctionne normalement (sans analytics)
    // Utilisation d'un module dynamique pour éviter les erreurs d'injection en mode test
    AnalyticsModule.forRoot(),
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