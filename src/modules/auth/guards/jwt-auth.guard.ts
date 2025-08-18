// Import des fonctionnalités NATIVES de NestJS
// Injectable : Décorateur qui permet à NestJS d'injecter ce guard dans d'autres classes
import { Injectable } from '@nestjs/common';

// Import des fonctionnalités NATIVES de NestJS et Passport
// AuthGuard : Classe de base NATIVE de @nestjs/passport pour créer des guards
// 'jwt' : Nom de la stratégie Passport à utiliser (définie dans jwt.strategy.ts)
import { AuthGuard } from '@nestjs/passport';

// Décorateur Injectable : Permet à NestJS d'injecter ce guard dans d'autres classes
@Injectable()

// Extension de AuthGuard : Crée un guard qui utilise la stratégie JWT
// AuthGuard('jwt') : Utilise automatiquement la stratégie JWT configurée
// Cette classe hérite de toutes les fonctionnalités de validation JWT
export class JwtAuthGuard extends AuthGuard('jwt') {}

// COMMENTAIRES SUR LE FONCTIONNEMENT :
// 
// 1. Quand ce guard est utilisé sur une route :
//    - Il intercepte automatiquement la requête
//    - Extrait le token JWT du header Authorization
//    - Valide le token via la stratégie JWT
//    - Met req.user avec les informations décodées du token
//
// 2. Si le token est valide :
//    - La requête continue vers le contrôleur
//    - req.user contient { sub: "userId", email: "user@email.com", role: "client" }
//
// 3. Si le token est invalide :
//    - Retourne automatiquement une erreur 401 Unauthorized
//    - La requête n'atteint jamais le contrôleur
//
// 4. Utilisation typique :
//    @UseGuards(JwtAuthGuard)
//    async protectedRoute(@Request() req) {
//      // req.user est automatiquement disponible ici
//    }
