import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Décorateur personnalisé pour récupérer l'utilisateur connecté depuis le JWT.
 * J'évite ainsi de répéter @Request() req puis req.user dans chaque méthode.
 * 
 * Exemple : async getProfile(@CurrentUser() user) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // Utilisateur mis par JwtAuthGuard
  },
);
