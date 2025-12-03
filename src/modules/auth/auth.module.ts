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
 * Module d'authentification : je configure l'authentification JWT et locale.
 * J'importe UsersModule et EmailModule, je configure PassportModule et JwtModule,
 * et j'exporte AuthService pour les autres modules.
 */
@Module({
  imports: [
    UsersModule,
    EmailModule,
    PassportModule,
    
    // Je configure JWT avec variables d'environnement
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
    AuthService,
    LocalStrategy,
    JwtStrategy,
    AdminGuard,
  ],
  
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
