import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

/**
 * Stratégie locale : je valide les credentials de connexion (email + mot de passe).
 * Utilisée par LocalAuthGuard sur la route POST /login.
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      // J'utilise email au lieu de username par défaut
      usernameField: 'email',
    });
  }

  async validate(email: string, password: string): Promise<any> {
    // Je délègue la validation à AuthService
    const user = await this.authService.validateUser(email, password);
    
    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
    
    // Je retourne l'utilisateur validé (sera mis dans req.user par LocalAuthGuard)
    return user;
  }
}
