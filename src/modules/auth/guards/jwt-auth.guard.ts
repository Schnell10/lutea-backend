import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guard d'authentification JWT
 * 
 * Vérifie que l'utilisateur est connecté avec un token JWT valide
 * 
 * Usage: @UseGuards(JwtAuthGuard)
 * 
 * Fonctionnement :
 * 1. Extrait le token JWT (cookie ou Authorization header)
 * 2. Valide le token via JwtStrategy
 * 3. Met req.user avec les infos décodées
 * 4. Si invalide → erreur 401 Unauthorized
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
