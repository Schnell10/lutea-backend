// Import des fonctionnalités NATIVES de NestJS
import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  Request, 
  Get,
  HttpCode,
  HttpStatus,
  Res,
  BadRequestException
} from '@nestjs/common';
import type { Response } from 'express';

// Import de notre service d'authentification
import { AuthService } from './auth.service';

// Import des guards de sécurité
// LocalAuthGuard : Vérifie l'email et le mot de passe lors de la connexion
// JwtAuthGuard : Vérifie que l'utilisateur est connecté (JWT valide)
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// Import du DTO pour la création d'utilisateur
import { CreateUserDto } from '../users/dto/users.dto';

// Décorateur Controller : Indique que cette classe gère les routes /auth
@Controller('auth')
export class AuthController {
  
  // Constructeur avec injection de dépendance
  // private readonly : Crée une propriété privée en lecture seule
  // NestJS va automatiquement créer une instance de AuthService et l'injecter ici
  constructor(private readonly authService: AuthService) {}

  // INSCRIPTION
  // @Post('register') : Route POST /auth/register
  // Pas de guard = accessible à tous (inscription publique)
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    // @Body() : Extrait automatiquement le corps de la requête JSON
    // createUserDto : Données validées selon le DTO CreateUserDto
    // this.authService.register() : Appelle le service pour créer l'utilisateur
    return this.authService.register(createUserDto);
  }

  // CONNEXION
  // @Post('login') : Route POST /auth/login
  // @HttpCode(HttpStatus.OK) : Force le code de statut HTTP 200 (succès)
  // @UseGuards(LocalAuthGuard) : Protection avec le guard local (vérifie email/mot de passe)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  login(@Request() req, @Res({ passthrough: true }) res: Response) {
    // Si l'utilisateur est admin, on a d'abord un passage 2FA
    // Dans ce cas, validateUser retourne { requires2FA: true, message, ... }
    if (req.user && req.user.requires2FA) {
      return req.user; // Ne PAS émettre de JWT ici
    }

    // Sinon, on émet les tokens en cookies sécurisés
    const tokens = this.authService.login(req.user);
    
    // Configuration des cookies sécurisés
    const cookieOptions = {
      httpOnly: true,           // Pas accessible via JavaScript (XSS protection)
      secure: process.env.NODE_ENV === 'production', // HTTPS en production
      sameSite: 'strict' as const, // Protection CSRF
      maxAge: 15 * 60 * 1000,  // 15 minutes (access token)
      path: '/',                // Disponible sur tout le site
    };

    const refreshCookieOptions = {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours (refresh token)
    };

    // Définir les cookies
    res.cookie('access_token', tokens.access_token, cookieOptions);
    res.cookie('refresh_token', tokens.refresh_token, refreshCookieOptions);

    // Retourner les infos utilisateur (sans les tokens)
    return {
      user: tokens.user,
      message: 'Connexion réussie. Tokens stockés en cookies sécurisés.'
    };
  }

  // RÉFRESH DU TOKEN
  // @Post('refresh') : Route POST /auth/refresh
  // @HttpCode(HttpStatus.OK) : Force le code de statut HTTP 200
  // Pas de guard = accessible avec le refresh token
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Request() req, @Res({ passthrough: true }) res: Response) {
    // Récupérer le refresh token depuis les cookies
    const refreshToken = req.cookies?.refresh_token;
    
    if (!refreshToken) {
      throw new BadRequestException('Refresh token manquant');
    }

    const newTokens = await this.authService.refreshToken(refreshToken);
    
    // Mettre à jour le cookie d'access token
    res.cookie('access_token', newTokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    return {
      user: newTokens.user,
      message: 'Token renouvelé avec succès.'
    };
  }

  // DÉCONNEXION
  // @Post('logout') : Route POST /auth/logout
  // @UseGuards(JwtAuthGuard) : Protection - utilisateur doit être connecté
  // @HttpCode(HttpStatus.OK) : Force le code de statut HTTP 200
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    // Supprimer les cookies
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });
    
    return { message: 'Déconnexion réussie. Cookies supprimés.' };
  }

  // GÉNÉRER CODE DE VÉRIFICATION (admin)
  // @Post('2fa/generate') : Route POST /auth/2fa/generate
  // @UseGuards(JwtAuthGuard) : Protection - utilisateur doit être connecté
  // @HttpCode(HttpStatus.OK) : Force le code de statut HTTP 200
  @Post('2fa/generate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async generateVerificationCode(@Request() req) {
    // req.user.email : Email de l'utilisateur connecté (mis par JwtAuthGuard)
    // this.authService.generateVerificationCode() : Génère le code 2FA
    // Note : La vérification du rôle admin se fait dans le service
    return this.authService.generateVerificationCode(req.user.email);
  }

  // FINALISER CONNEXION ADMIN AVEC 2FA
  // @Post('2fa/finalize') : Route POST /auth/2fa/finalize
  // Pas de guard - accessible pour finaliser la connexion admin
  // @HttpCode(HttpStatus.OK) : Force le code de statut HTTP 200
  @Post('2fa/finalize')
  @HttpCode(HttpStatus.OK)
  async finalizeAdminLogin(
    @Body() body: { email: string, code: string },  // Email et code 2FA
    @Res({ passthrough: true }) res: Response
  ) {
    // body.email : Email de l'administrateur
    // body.code : Code de vérification à 8 chiffres
    // this.authService.finalizeAdminLogin() : Finalise la connexion admin
    const tokens = await this.authService.finalizeAdminLogin(body.email, body.code);
    
    // Émettre les cookies sécurisés
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 15 * 60 * 1000,
      path: '/',
    };

    const refreshCookieOptions = {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    res.cookie('access_token', tokens.access_token, cookieOptions);
    res.cookie('refresh_token', tokens.refresh_token, refreshCookieOptions);

    return {
      user: tokens.user,
      message: 'Connexion admin réussie avec 2FA. Tokens stockés en cookies sécurisés.'
    };
  }

  // VÉRIFIER CODE (admin)
  // @Post('2fa/verify') : Route POST /auth/2fa/verify
  // @UseGuards(JwtAuthGuard) : Protection - utilisateur doit être connecté
  // @HttpCode(HttpStatus.OK) : Force le code de statut HTTP 200
  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyCode(
    @Request() req,                    // Objet requête complet
    @Body() body: { code: string }     // Corps de la requête avec le code
  ) {
    // req.user.email : Email de l'utilisateur connecté
    // body.code : Code de vérification à 8 chiffres
    // this.authService.verifyCode() : Vérifie le code 2FA
    return this.authService.verifyCode(req.user.email, body.code);
  }

  // MOT DE PASSE OUBLIÉ - DEMANDER RÉINITIALISATION
  // @Post('forgot-password') : Route POST /auth/forgot-password
  // Pas de guard - accessible à tous
  // @HttpCode(HttpStatus.OK) : Force le code de statut HTTP 200
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() body: { email: string }  // Email de l'utilisateur
  ) {
    // body.email : Email de l'utilisateur qui a oublié son mot de passe
    // this.authService.forgotPassword() : Envoie le lien de réinitialisation
    return this.authService.forgotPassword(body.email);
  }

  // RÉINITIALISER MOT DE PASSE
  // @Post('reset-password') : Route POST /auth/reset-password
  // Pas de guard - accessible avec le token de réinitialisation
  // @HttpCode(HttpStatus.OK) : Force le code de statut HTTP 200
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() body: { token: string, newPassword: string }  // Token et nouveau mot de passe
  ) {
    // body.token : Token de réinitialisation reçu par email
    // body.newPassword : Nouveau mot de passe choisi par l'utilisateur
    // this.authService.resetPassword() : Réinitialise le mot de passe
    return this.authService.resetPassword(body.token, body.newPassword);
  }

  // VALIDATION EMAIL APRÈS INSCRIPTION (création du compte définitif + connexion automatique)
  @Post('validate-email')
  @HttpCode(HttpStatus.OK)
  async validateEmail(
    @Body() body: { token: string },
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.validateEmail(body.token);
    
    // Connexion automatique après validation : émettre les cookies sécurisés
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict' as const,
      maxAge: 15 * 60 * 1000,
      path: '/',
    };

    const refreshCookieOptions = {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };

    res.cookie('access_token', result.access_token, cookieOptions);
    res.cookie('refresh_token', result.refresh_token, refreshCookieOptions);

    return {
      message: result.message,
      user: result.user
    };
  }

  // PROFIL UTILISATEUR CONNECTÉ
  // @Get('profile') : Route GET /auth/profile
  // @UseGuards(JwtAuthGuard) : Protection - utilisateur doit être connecté
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Request() req) {
    // req.user : Contient les informations de l'utilisateur connecté
    // Ces infos sont mises par JwtAuthGuard après validation du JWT
    // Retourne directement le profil sans appel au service
    // Note : Pas de async car pas d'opération asynchrone
    return req.user;
  }
}
