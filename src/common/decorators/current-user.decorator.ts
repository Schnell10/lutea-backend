import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Décorateur pour récupérer l'utilisateur connecté depuis le JWT
 * 
 * Évite d'avoir à faire @Request() req puis req.user à chaque fois
 * 
 * Exemple d'utilisation :
 * - async getProfile(@CurrentUser() user) { ... }
 * - async updateProfile(@CurrentUser() user, @Body() data) { ... }
 * 
 * L'utilisateur contient : { sub: "userId", email: "user@email.com", role: "CLIENT" }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user; // Utilisateur mis par JwtAuthGuard
  },
);
