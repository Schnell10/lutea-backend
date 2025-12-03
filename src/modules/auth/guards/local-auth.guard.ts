import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard d'authentification locale : je vérifie les credentials (email + mot de passe) lors de la connexion.
 * J'extrais email/mot de passe du corps de la requête, je valide via LocalStrategy,
 * et je mets req.user avec l'utilisateur validé. Si invalide → erreur 401.
 * 
 * Différence avec JwtAuthGuard : LocalAuthGuard pour la connexion (email/password),
 * JwtAuthGuard pour les routes protégées (token JWT).
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
