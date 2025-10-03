import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../../modules/users/users.service';
import { UserRole } from '../../modules/users/users.schema';

/**
 * Guard qui vérifie qu'un utilisateur peut accéder à une ressource spécifique
 * 
 * Usage: @UseGuards(JwtAuthGuard, OwnerGuard)
 * 
 * Logique :
 * - ADMIN : Accès à toutes les ressources
 * - CLIENT : Accès seulement à ses propres ressources (user.sub === resourceId)
 */
@Injectable()
export class OwnerGuard implements CanActivate {
  constructor(private usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Vérification 1 : Utilisateur connecté
    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    // Récupération de l'ID de la ressource depuis l'URL
    const resourceId = request.params.id || request.params.userId;
    if (!resourceId) {
      throw new ForbiddenException('ID de ressource manquant');
    }

    // Vérification 2 : Utilisateur existe encore en base
    const currentUser = await this.usersService.findById(user.sub);
    if (!currentUser) {
      throw new ForbiddenException('Utilisateur non trouvé');
    }

    // Vérification 3 : Permissions selon le rôle
    if (currentUser.role === UserRole.ADMIN) {
      return true; // Admins ont accès à tout
    }

    if (currentUser.role === UserRole.CLIENT) {
      // Clients accèdent seulement à leurs propres ressources
      if (user.sub !== resourceId) {
        throw new ForbiddenException('Accès refusé à cette ressource');
      }
      return true;
    }

    throw new ForbiddenException('Rôle non reconnu');
  }
}
