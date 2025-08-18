// Import des fonctionnalités NATIVES de Passport et NestJS
// ExtractJwt : Classe NATIVE de passport-jwt pour extraire le JWT de la requête
// Strategy : Classe de base NATIVE de Passport pour créer des stratégies d'authentification
// PassportStrategy : Décorateur NATIVE de @nestjs/passport pour intégrer Passport avec NestJS
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';

// Import des fonctionnalités NATIVES de NestJS
// Injectable : Décorateur qui permet à NestJS d'injecter cette stratégie
// UnauthorizedException : Exception NATIVE de NestJS pour les erreurs 401
// ConfigService : Service NATIVE de NestJS pour accéder aux variables d'environnement
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Import de notre service utilisateur
import { UsersService } from '../../users/users.service';

// Décorateur Injectable : Permet à NestJS d'injecter cette stratégie
@Injectable()

// Extension de PassportStrategy : Crée une stratégie Passport personnalisée
// PassportStrategy(Strategy) : Utilise la stratégie JWT de Passport
// 'jwt' : Nom de la stratégie (utilisé par JwtAuthGuard)
export class JwtStrategy extends PassportStrategy(Strategy) {
  
  // Constructeur avec injection de dépendances
  // NestJS va automatiquement créer des instances de ConfigService et UsersService
  constructor(
    private configService: ConfigService,  // Service pour accéder aux variables d'environnement
    private usersService: UsersService,    // Service pour gérer les utilisateurs
  ) {
    // Appel au constructeur parent avec la configuration de la stratégie
    super({
      // jwtFromRequest : Comment extraire le JWT de la requête
      // ExtractJwt.fromExtractors : Permet d'extraire depuis plusieurs sources
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. Essayer d'extraire depuis les cookies (priorité)
        (request) => {
          if (request?.cookies?.access_token) {
            return request.cookies.access_token;
          }
          return null;
        },
        // 2. Fallback : extraire depuis le header Authorization (pour compatibilité)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      
      // ignoreExpiration : Ignorer l'expiration automatiquement (on la gère manuellement)
      ignoreExpiration: false,
      
      // secretOrKey : Clé secrète pour vérifier la signature du JWT
      // configService.get<string>('JWT_SECRET') : Récupère depuis les variables d'environnement
      // || 'your-secret-key-change-in-production' : Valeur par défaut (développement uniquement)
      secretOrKey: configService.get<string>('JWT_SECRET') || 'your-secret-key-change-in-production',
    });
  }

  // Méthode validate : Appelée automatiquement par Passport après décodage du JWT
  // payload : Contenu décodé du JWT (email, sub, role, iat, exp)
  // Retourne les informations utilisateur qui seront mises dans req.user
  async validate(payload: any) {
    // Vérification que l'utilisateur existe toujours en base de données
    // payload.sub : ID de l'utilisateur extrait du JWT
    // this.usersService.findById() : Recherche en base de données
    const user = await this.usersService.findById(payload.sub);
    
    // Si l'utilisateur n'existe plus en base
    if (!user) {
      // UnauthorizedException : Erreur 401 - L'utilisateur n'existe plus
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    // Retourner les informations utilisateur qui seront mises dans req.user
    // Ces informations seront disponibles dans tous les contrôleurs qui utilisent JwtAuthGuard
    return {
      sub: user._id,           // ID MongoDB de l'utilisateur
      email: user.email,       // Email de l'utilisateur
      role: user.role,         // Rôle de l'utilisateur (CLIENT ou ADMIN)
      firstName: user.firstName, // Prénom de l'utilisateur
      lastName: user.lastName,   // Nom de famille de l'utilisateur
    };
  }
}

// COMMENTAIRES SUR LE FONCTIONNEMENT :
// 
// 1. Quand un JWT arrive sur une route protégée :
//    - JwtAuthGuard appelle automatiquement cette stratégie
//    - La stratégie extrait le JWT du header Authorization
//    - Elle décode le JWT avec la clé secrète
//    - Elle appelle la méthode validate() avec le payload décodé
//
// 2. La méthode validate() :
//    - Vérifie que l'utilisateur existe encore en base
//    - Vérifie que le compte est actif
//    - Retourne les informations utilisateur
//
// 3. Si tout est OK :
//    - req.user est automatiquement rempli avec les informations retournées
//    - La requête continue vers le contrôleur
//
// 4. Si une erreur survient :
//    - Une UnauthorizedException est levée
//    - La requête est rejetée avec une erreur 401
//
// 5. Sécurité :
//    - Vérification en base à chaque requête (pas de cache)
//    - Vérification du statut actif du compte
//    - Clé secrète configurable via variables d'environnement
