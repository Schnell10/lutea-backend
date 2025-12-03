import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard d'authentification JWT : je vérifie que l'utilisateur est connecté avec un token JWT valide.
 * J'extrais le token (cookie ou Authorization header), je le valide via JwtStrategy,
 * et je mets req.user avec les infos décodées. Si invalide → erreur 401.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
