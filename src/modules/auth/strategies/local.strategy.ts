import { Strategy } from 'passport-local';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

/**
 * Stratégie locale pour valider les credentials de connexion
 * 
 * Cette stratégie est utilisée par LocalAuthGuard sur la route POST /login
 * Elle valide l'email et le mot de passe fournis par l'utilisateur
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      // Configurer le champ email au lieu de username par défaut
      usernameField: 'email', // Utiliser email au lieu de username
    });
  }

  /**
   * Valide les credentials de connexion
   * @param email - Email fourni par l'utilisateur
   * @param password - Mot de passe fourni par l'utilisateur
   * @returns L'utilisateur validé (sans mot de passe) ou lance une exception
   */
  async validate(email: string, password: string): Promise<any> {
    // Déléguer la validation à AuthService
    // AuthService vérifie l'email/mot de passe et retourne l'utilisateur
    const user = await this.authService.validateUser(email, password);
    
    // Si la validation échoue (utilisateur non trouvé ou mot de passe incorrect)
    if (!user) {
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }
    
    // Retourner l'utilisateur validé (sans le mot de passe)
    // Cet utilisateur sera mis dans req.user par LocalAuthGuard
    return user;
  }
}
