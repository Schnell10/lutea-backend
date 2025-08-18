// Import des fonctionnalités NATIVES de NestJS
// Injectable : Décorateur qui permet à NestJS d'injecter ce guard dans d'autres classes
// CanActivate : Interface que doit implémenter tout guard pour que NestJS sache comment l'utiliser
// ExecutionContext : Interface qui contient le contexte d'exécution de la requête HTTP
// ForbiddenException : Exception NATIVE de NestJS pour les erreurs 403 (Accès interdit)
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

// Import de notre service utilisateur (classe qui gère la logique métier des utilisateurs)
import { UsersService } from '../../modules/users/users.service';

// Import de l'énumération des rôles depuis le schéma utilisateur
// UserRole.CLIENT = 'client', UserRole.ADMIN = 'admin'
import { UserRole } from '../../modules/users/users.schema';

// Décorateur Injectable : Permet à NestJS d'injecter ce guard dans d'autres classes
// Sans ce décorateur, NestJS ne pourrait pas créer d'instance de ce guard
@Injectable()

// Implémentation de l'interface CanActivate : NestJS sait maintenant que c'est un guard
// implements = "promet" que cette classe respecte le contrat défini par CanActivate
export class ClientGuard implements CanActivate {
  
  // Constructeur avec injection de dépendance
  // private = crée automatiquement une propriété privée usersService
  // NestJS va automatiquement créer une instance de UsersService et l'injecter ici
  constructor(private usersService: UsersService) {}

  // Méthode canActivate : Appelée automatiquement par NestJS AVANT d'exécuter la route
  // Retourne true si l'accès est autorisé, false sinon
  // async = fonction asynchrone (peut attendre des opérations comme les requêtes base de données)
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // context : Contient toutes les informations sur la requête en cours
    // switchToHttp() : Récupère le contexte HTTP (par opposition à WebSocket, GraphQL, etc.)
    // getRequest() : Récupère l'objet requête HTTP (comme req dans Express.js)
    const request = context.switchToHttp().getRequest();
    
    // request.user : Contient les informations de l'utilisateur connecté
    // Ces infos sont mises automatiquement par le JwtAuthGuard après validation du JWT
    // Structure : { sub: "userId", email: "user@email.com", role: "client" }
    const user = request.user;

    // Vérification 1 : L'utilisateur est-il connecté ?
    if (!user) {
      // ForbiddenException : Exception NATIVE de NestJS qui génère une erreur HTTP 403
      // 'Utilisateur non authentifié' : Message d'erreur visible par le client
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    // VÉRIFICATION EN BASE (obligatoire pour la sécurité)
    // Même si le JWT est valide, on vérifie que l'utilisateur existe toujours en base
    // user.sub : ID de l'utilisateur (stocké dans le JWT)
    // await : Attend que la requête base de données soit terminée
    const currentUser = await this.usersService.findById(user.sub);
    
    // Vérification 2 : L'utilisateur existe-t-il encore en base ?
    if (!currentUser) {
      throw new ForbiddenException('Utilisateur non trouvé');
    }

    // Vérification 3 : L'utilisateur a-t-il un rôle autorisé ?
    // Permettre l'accès aux clients ET aux admins
    // currentUser.role !== UserRole.CLIENT && currentUser.role !== UserRole.ADMIN
    // Signifie : "Si le rôle N'EST PAS client ET N'EST PAS admin"
    if (currentUser.role !== UserRole.CLIENT && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Accès refusé');
    }

    // Si toutes les vérifications sont passées, autoriser l'accès
    return true;
  }
}
