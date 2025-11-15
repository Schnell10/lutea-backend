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
import { UsersService } from '../users/users.service';

// Import des guards de sécurité
// LocalAuthGuard : Vérifie l'email et le mot de passe lors de la connexion
// JwtAuthGuard : Vérifie que l'utilisateur est connecté (JWT valide)
// AdminGuard : Vérifie que l'utilisateur a le rôle admin
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

// Import des DTOs pour la création d'utilisateur et l'authentification
import { CreateUserDto } from '../users/dto/users.dto';
import { 
  VerifyCodeDto, 
  FinalizeLoginDto, 
  RequestPasswordResetDto, 
  ResetPasswordDto, 
  ValidateEmailDto 
} from './dto/auth.dto';

// Décorateur Controller : Indique que cette classe gère les routes /auth
@Controller('auth')
export class AuthController {
  
  // Constructeur avec injection de dépendance
  // private readonly : Crée une propriété privée en lecture seule
  // NestJS va automatiquement créer une instance de AuthService et l'injecter ici
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService
  ) {}

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
    // sameSite: 'none' en production pour permettre cross-domain (Vercel ↔ Render)
    // Nécessite secure: true (HTTPS obligatoire)
    const sameSiteValue = process.env.NODE_ENV === 'production' ? ('none' as const) : ('strict' as const);
    const cookieOptions = {
      httpOnly: true,           // Pas accessible via JavaScript (XSS protection)
      secure: process.env.NODE_ENV === 'production', // HTTPS en production (obligatoire avec sameSite: 'none')
      sameSite: sameSiteValue,  // Cross-domain en prod, strict en dev
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
    // sameSite: 'none' en production pour permettre cross-domain (Vercel ↔ Render)
    const sameSiteValue = process.env.NODE_ENV === 'production' ? ('none' as const) : ('strict' as const);
    res.cookie('access_token', newTokens.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: sameSiteValue,
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


  // FINALISER CONNEXION ADMIN AVEC 2FA
  // @Post('2fa/finalize') : Route POST /auth/2fa/finalize
  // Pas de guard - accessible pour finaliser la connexion admin
  // @HttpCode(HttpStatus.OK) : Force le code de statut HTTP 200
  @Post('2fa/finalize')
  @HttpCode(HttpStatus.OK)
  async finalizeAdminLogin(
    @Body() finalizeLoginDto: FinalizeLoginDto,  // DTO validé pour email et code 2FA
    @Res({ passthrough: true }) res: Response
  ) {
    // finalizeLoginDto.email : Email de l'administrateur (validé par le DTO)
    // finalizeLoginDto.code : Code de vérification à 8 chiffres (validé par le DTO)
    // this.authService.finalizeAdminLogin() : Finalise la connexion admin
    const tokens = await this.authService.finalizeAdminLogin(finalizeLoginDto.email, finalizeLoginDto.code);
    
    // Émettre les cookies sécurisés
    // sameSite: 'none' en production pour permettre cross-domain (Vercel ↔ Render)
    const sameSiteValue = process.env.NODE_ENV === 'production' ? ('none' as const) : ('strict' as const);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: sameSiteValue,
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
    @Body() verifyCodeDto: VerifyCodeDto     // DTO validé pour le code 2FA
  ) {
    // req.user.email : Email de l'utilisateur connecté
    // verifyCodeDto.code : Code de vérification à 8 chiffres (validé par le DTO)
    // this.authService.verifyCode() : Vérifie le code 2FA
    return this.authService.verifyCode(req.user.email, verifyCodeDto.code);
  }

  // MOT DE PASSE OUBLIÉ - DEMANDER RÉINITIALISATION
  // @Post('forgot-password') : Route POST /auth/forgot-password
  // Pas de guard - accessible à tous
  // @HttpCode(HttpStatus.OK) : Force le code de statut HTTP 200
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() requestPasswordResetDto: RequestPasswordResetDto  // DTO validé pour l'email
  ) {
    // requestPasswordResetDto.email : Email de l'utilisateur qui a oublié son mot de passe (validé par le DTO)
    // this.usersService.forgotPassword() : Envoie le lien de réinitialisation
    return await this.usersService.forgotPassword(requestPasswordResetDto.email);
  }

  // RÉINITIALISER MOT DE PASSE
  // @Post('reset-password') : Route POST /auth/reset-password
  // Pas de guard - accessible avec le token de réinitialisation
  // @HttpCode(HttpStatus.OK) : Force le code de statut HTTP 200
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto  // DTO validé pour token et nouveau mot de passe
  ) {
    // resetPasswordDto.token : Token de réinitialisation reçu par email (validé par le DTO)
    // resetPasswordDto.newPassword : Nouveau mot de passe choisi par l'utilisateur (validé par le DTO)
    // this.usersService.resetPassword() : Réinitialise le mot de passe
    return await this.usersService.resetPassword(resetPasswordDto.token, resetPasswordDto.newPassword);
  }

  // VALIDATION EMAIL APRÈS INSCRIPTION (création du compte définitif + connexion automatique)
  @Post('validate-email')
  @HttpCode(HttpStatus.OK)
  async validateEmail(
    @Body() validateEmailDto: ValidateEmailDto,  // DTO validé pour le token de validation
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.validateEmail(validateEmailDto.token);
    
    // Connexion automatique après validation : émettre les cookies sécurisés
    // sameSite: 'none' en production pour permettre cross-domain (Vercel ↔ Render)
    const sameSiteValue = process.env.NODE_ENV === 'production' ? ('none' as const) : ('strict' as const);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: sameSiteValue,
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

  // VÉRIFICATION ACCÈS ADMIN
  // @Get('admin/check') : Route GET /auth/admin/check
  // @UseGuards(JwtAuthGuard, AdminGuard) : Protection - utilisateur doit être connecté ET admin
  @Get('admin/check')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  checkAdminAccess() {
    // Si on arrive ici, c'est que l'utilisateur est connecté ET admin
    // AdminGuard a déjà vérifié le rôle
    return { 
      message: 'Accès administrateur autorisé',
      role: 'admin'
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

  // INFORMATIONS COMPLÈTES UTILISATEUR
  // @Get('user-info') : Route GET /auth/user-info
  // @UseGuards(JwtAuthGuard) : Protection - utilisateur doit être connecté
  // @HttpCode(HttpStatus.OK) : Force le code de statut HTTP 200
  @Get('user-info')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getUserInfo(@Request() req) {
    // Récupérer toutes les informations de l'utilisateur depuis la base de données
    // req.user.sub contient l'ID de l'utilisateur depuis le JWT
    return this.authService.getUserProfile(req.user.sub);
  }
}
