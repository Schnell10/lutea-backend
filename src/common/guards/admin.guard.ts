import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UsersService } from '../../modules/users/users.service';
import { UserRole } from '../../modules/users/users.schema';

/**
 * Guard qui vérifie qu'un utilisateur a le rôle ADMIN
 * 
 * Usage: @UseGuards(JwtAuthGuard, AdminGuard)
 * 
 * Vérifications :
 * 1. Utilisateur connecté (JWT valide)
 * 2. Utilisateur existe encore en base
 * 3. Utilisateur a le rôle ADMIN
 */
@Injectable()
export class AdminGuard implements CanActivate {
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

    // Vérification 3 : Rôle ADMIN
    if (currentUser.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Accès administrateur requis');
    }

    return true;
  }
}
