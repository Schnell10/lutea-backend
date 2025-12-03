import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { EmailModule } from './modules/email/email.module';
import { RetreatsModule } from './modules/retreats/retreats.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { StripeModule } from './modules/stripe/stripe.module';

// Import conditionnel de TypeORM pour MySQL (seulement si pas en mode test)
// En mode test, je ne charge pas TypeORM pour éviter les erreurs
const TypeOrmModule = process.env.NODE_ENV === 'test' 
  ? null 
  : // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@nestjs/typeorm').TypeOrmModule;


@Module({
  imports: [
    // Je configure les variables d'environnement (disponibles dans tous les modules)
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    
    // Je configure le rate limiting (limitation des requêtes)
    ThrottlerModule.forRoot([{
      ttl: 60000,        // 1 minute (en millisecondes)
      limit: 100,        // 100 requêtes par minute par IP
    }]),
    
    // Je me connecte à MongoDB
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/lutea'
    ),
    
    // Je me connecte à MySQL pour Analytics
    // MySQL est optionnel : je le charge seulement si les variables sont présentes
    // Si MySQL est indisponible, l'app continue de fonctionner (seulement les analytics sont désactivées)
    // En mode test, je ne configure PAS TypeORM pour éviter les erreurs de connexion
    ...(process.env.NODE_ENV !== 'test' && 
        TypeOrmModule &&
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
            retryAttempts: 3, // Je réessaye 3 fois en cas d'échec
            retryDelay: 3000, // J'attends 3 secondes entre chaque tentative
          };

          // Je configure SSL pour Aiven (ou autres services qui nécessitent SSL)
          // Si MYSQL_SSL_CA est fourni, j'utilise le certificat CA
          // Sinon, j'utilise SSL sans vérification stricte (pour Aiven)
          if (process.env.MYSQL_SSL_CA) {
            // J'utilise le certificat CA fourni
            config.ssl = {
              ca: process.env.MYSQL_SSL_CA,
              rejectUnauthorized: true,
            };
          } else if (process.env.MYSQL_SSL === 'true' || process.env.MYSQL_SSL === 'required') {
            // SSL requis mais sans certificat CA (Aiven accepte ça)
            config.ssl = {
              rejectUnauthorized: false, // J'accepte le certificat sans vérification stricte
            };
          }

          return config;
        },
      }),
    ] : []),
    
    // Module de planification pour les cron jobs
    ScheduleModule.forRoot(),
    
    // Mes modules personnalisés
    EmailModule,    // Service d'envoi d'emails
    UsersModule,    // Gestion des utilisateurs
    AuthModule,     // Authentification et autorisation
    RetreatsModule, // Gestion des retraites
    BookingsModule, // Gestion des réservations
    StripeModule,   // Intégration Stripe
    // AnalyticsModule : je le charge seulement si MySQL est configuré ET pas en mode test
    // Si MySQL n'est pas disponible, l'app fonctionne normalement (sans analytics)
    // En mode test, je ne charge PAS AnalyticsModule du tout pour éviter les erreurs TypeORM
    ...(process.env.NODE_ENV !== 'test' && 
        process.env.MYSQL_HOST && 
        process.env.MYSQL_USER && 
        process.env.MYSQL_PASSWORD ? [
      // En production/local, j'utilise le vrai module avec TypeORM
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require('./modules/analytics/analytics.module').AnalyticsModule.forRoot(),
    ] : []),
  ],
  
  controllers: [],
  
  providers: [
    // J'active globalement le rate limiting
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}