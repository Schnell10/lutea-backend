import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';

/**
 * Stratégie JWT pour valider les tokens d'authentification
 * 
 * Configuration :
 * - Extrait le JWT depuis les cookies (priorité) ou Authorization header
 * - Décode avec la clé secrète JWT_SECRET
 * - Vérifie que l'utilisateur existe encore en base
 * - Retourne les infos utilisateur dans req.user
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService, //On utilise le configService dans le parent
    private usersService: UsersService,
  ) {
    super({
      // Extraction du JWT depuis cookies (priorité) ou Authorization header
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request) => {
          if (request?.cookies?.access_token) {
            return request.cookies.access_token;
          }
          return null;
        },
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    // Vérifier que l'utilisateur existe encore en base
    const user = await this.usersService.findById(payload.sub);
    
    if (!user) {
      throw new UnauthorizedException('Utilisateur non trouvé');
    }

    // Retourner les infos utilisateur pour req.user
    return {
      sub: user._id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };
  }
}
