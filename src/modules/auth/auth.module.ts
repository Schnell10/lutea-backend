// Import des fonctionnalités NATIVES de NestJS
// Module : Décorateur NATIVE de NestJS pour définir un module
// JwtModule : Module NATIVE de @nestjs/jwt pour gérer les JWT
// PassportModule : Module NATIVE de @nestjs/passport pour l'authentification
// ConfigModule, ConfigService : Modules NATIVES de @nestjs/config pour la configuration
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Import de nos composants personnalisés
// AuthController : Contrôleur qui gère les routes d'authentification
// AuthService : Service qui gère la logique d'authentification
// JwtStrategy : Stratégie Passport pour valider les JWT
// LocalStrategy : Stratégie Passport pour valider email/mot de passe
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';

// Import du module utilisateur
// UsersModule : Module qui gère les utilisateurs (nécessaire pour AuthService)
import { UsersModule } from '../users/users.module';

// Import de notre configuration de sécurité centralisée
import { securityConfig } from '../../config/security.config';

// Décorateur Module : Indique que cette classe est un module NestJS
@Module({
  // imports : Modules dont ce module dépend
  imports: [
    // UsersModule : Permet d'utiliser UsersService dans AuthService
    UsersModule,
    
    // PassportModule : Active Passport.js pour l'authentification
    PassportModule,
    
    // JwtModule.registerAsync : Configuration asynchrone du module JWT
    // Permet d'utiliser ConfigService pour récupérer les variables d'environnement
    JwtModule.registerAsync({
      // imports : Modules nécessaires pour la factory
      imports: [ConfigModule],
      
      // useFactory : Fonction qui retourne la configuration du module JWT
      // configService : Service injecté automatiquement par NestJS
      // Note : Pas de async car on n'utilise pas await
      useFactory: (configService: ConfigService) => ({
        // secret : Clé secrète pour signer et vérifier les JWT
        // securityConfig.jwt.secret : Utilise la configuration centralisée
        // configService.get<string>('JWT_SECRET') : Récupère depuis les variables d'environnement
        // || securityConfig.jwt.secret : Valeur par défaut depuis la config centralisée
        secret: configService.get<string>('JWT_SECRET') || securityConfig.jwt.secret,
        
        // signOptions : Options pour la signature des JWT
        // securityConfig.jwt.accessTokenExpiry : Durée de vie depuis la config centralisée
        signOptions: { 
          expiresIn: securityConfig.jwt.accessTokenExpiry // Utilise la config centralisée
        },
      }),
      
      // inject : Services à injecter dans la factory
      // ConfigService sera automatiquement injecté et disponible dans useFactory
      inject: [ConfigService],
    }),
  ],
  
  // controllers : Contrôleurs de ce module
  controllers: [AuthController],
  
  // providers : Services et stratégies de ce module
  // NestJS va créer automatiquement des instances de ces classes
  providers: [
    AuthService,      // Service principal d'authentification
    LocalStrategy,    // Stratégie pour email/mot de passe
    JwtStrategy,      // Stratégie pour validation JWT
  ],
  
  // exports : Services que ce module expose aux autres modules
  // AuthService sera accessible depuis d'autres modules qui importent AuthModule
  exports: [AuthService],
})
export class AuthModule {}

// COMMENTAIRES SUR L'INTÉGRATION DE LA CONFIGURATION :
// 
// 1. Avantages de securityConfig :
//    - Configuration centralisée et maintenable
//    - Valeurs par défaut sécurisées
//    - Facile de modifier les paramètres de sécurité
//
// 2. Utilisation dans JwtModule :
//    - secret : Clé JWT depuis la config ou l'environnement
//    - expiresIn : Durée de vie depuis la config centralisée
//
// 3. Ordre de priorité :
//    - 1. Variables d'environnement (production)
//    - 2. Configuration centralisée (développement)
//    - 3. Valeurs codées en dur (fallback)
//
// 4. Sécurité :
//    - JWT_SECRET prioritaire en production
//    - Valeurs par défaut sécurisées en développement
//    - Configuration centralisée pour la cohérence
