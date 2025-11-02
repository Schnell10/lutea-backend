import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersModule } from '../users/users.module';
import { EmailModule } from '../email/email.module';
import { AdminGuard } from '../../common/guards/admin.guard';
import { securityConfig } from '../../config/security.config';

/**
 * Module d'authentification
 * 
 * Configure l'authentification JWT et locale
 * - Importe UsersModule pour la gestion des utilisateurs
 * - Importe EmailModule pour la validation reCAPTCHA
 * - Configure PassportModule pour l'authentification
 * - Configure JwtModule avec clé secrète et expiration
 * - Exporte AuthService pour les autres modules
 */
@Module({
  imports: [
    UsersModule,      // Pour utiliser UsersService dans AuthService
    EmailModule,      // Pour utiliser EmailService (validation reCAPTCHA)
    PassportModule,   // Active Passport.js pour l'authentification
    
    // Configuration JWT avec variables d'environnement
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || securityConfig.jwt.secret,
        signOptions: { 
          expiresIn: securityConfig.jwt.accessTokenExpiry
        },
      }),
      inject: [ConfigService],
    }),
  ],
  
  controllers: [AuthController],
  
  providers: [
    AuthService,      // Service principal d'authentification
    LocalStrategy,    // Stratégie pour email/mot de passe
    JwtStrategy,      // Stratégie pour validation JWT
    AdminGuard,       // Guard pour vérifier le rôle admin
  ],
  
  exports: [AuthService, JwtModule], // Exporte AuthService et JwtModule pour les autres modules
})
export class AuthModule {}
