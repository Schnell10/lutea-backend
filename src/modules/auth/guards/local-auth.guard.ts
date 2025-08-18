// Import des fonctionnalités NATIVES de NestJS
// Injectable : Décorateur qui permet à NestJS d'injecter ce guard dans d'autres classes
import { Injectable } from '@nestjs/common';

// Import des fonctionnalités NATIVES de NestJS et Passport
// AuthGuard : Classe de base NATIVE de @nestjs/passport pour créer des guards
// 'local' : Nom de la stratégie Passport à utiliser (définie dans local.strategy.ts)
import { AuthGuard } from '@nestjs/passport';

// Décorateur Injectable : Permet à NestJS d'injecter ce guard dans d'autres classes
@Injectable()

// Extension de AuthGuard : Crée un guard qui utilise la stratégie locale
// AuthGuard('local') : Utilise automatiquement la stratégie locale configurée
// Cette classe hérite de toutes les fonctionnalités de validation email/mot de passe
export class LocalAuthGuard extends AuthGuard('local') {}

// COMMENTAIRES SUR LE FONCTIONNEMENT :
// 
// 1. Quand ce guard est utilisé sur une route :
//    - Il intercepte automatiquement la requête
//    - Extrait l'email et le mot de passe du corps de la requête
//    - Valide les credentials via la stratégie locale
//    - Met req.user avec les informations de l'utilisateur validé
//
// 2. Si les credentials sont valides :
//    - La requête continue vers le contrôleur
//    - req.user contient l'utilisateur (sans le mot de passe)
//
// 3. Si les credentials sont invalides :
//    - Retourne automatiquement une erreur 401 Unauthorized
//    - La requête n'atteint jamais le contrôleur
//
// 4. Utilisation typique (route de connexion) :
//    @Post('login')
//    @UseGuards(LocalAuthGuard)
//    async login(@Request() req) {
//      // req.user contient l'utilisateur validé
//      return this.authService.login(req.user);
//    }
//
// 5. Différence avec JwtAuthGuard :
//    - LocalAuthGuard : Vérifie email/mot de passe (connexion)
//    - JwtAuthGuard : Vérifie un token JWT (routes protégées)
