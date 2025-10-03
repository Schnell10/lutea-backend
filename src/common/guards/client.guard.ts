import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../../modules/users/users.service';
import { UserRole } from '../../modules/users/users.schema';

/**
 * Guard qui vérifie qu'un utilisateur a un rôle valide (CLIENT ou ADMIN)
 * 
 * Usage: @UseGuards(JwtAuthGuard, ClientGuard)
 * 
 * Vérifications :
 * 1. Utilisateur connecté (JWT valide)
 * 2. Utilisateur existe encore en base
 * 3. Utilisateur a le rôle CLIENT ou ADMIN
 */
@Injectable()
export class ClientGuard implements CanActivate {
  constructor(private usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Vérification 1 : Utilisateur connecté
    if (!user) {
      throw new ForbiddenException('Utilisateur non authentifié');
    }

    // Vérification 2 : Utilisateur existe encore en base
    const currentUser = await this.usersService.findById(user.sub);
    if (!currentUser) {
      throw new ForbiddenException('Utilisateur non trouvé');
    }

    // Vérification 3 : Rôle CLIENT ou ADMIN
    if (currentUser.role !== UserRole.CLIENT && currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Accès refusé');
    }

    return true;
  }
}
