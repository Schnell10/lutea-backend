import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard d'authentification locale
 * 
 * Vérifie les credentials (email + mot de passe) lors de la connexion
 * 
 * Usage: @UseGuards(LocalAuthGuard) sur la route POST /login
 * 
 * Fonctionnement :
 * 1. Extrait email/mot de passe du corps de la requête
 * 2. Valide via LocalStrategy
 * 3. Met req.user avec l'utilisateur validé
 * 4. Si invalide → erreur 401 Unauthorized
 * 
 * Différence avec JwtAuthGuard :
 * - LocalAuthGuard : Connexion (email/password)
 * - JwtAuthGuard : Routes protégées (token JWT)
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}
