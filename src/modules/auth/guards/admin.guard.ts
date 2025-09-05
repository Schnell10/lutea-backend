import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

// Étendre l'interface Request pour inclure la propriété user
interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    // Vérifier que l'utilisateur est connecté
    if (!user) {
      throw new ForbiddenException('Accès refusé : utilisateur non connecté');
    }

    // Vérifier que l'utilisateur a le rôle admin
    if (user.role !== 'admin') {
      throw new ForbiddenException('Accès refusé : droits administrateur requis');
    }

    return true;
  }
}
