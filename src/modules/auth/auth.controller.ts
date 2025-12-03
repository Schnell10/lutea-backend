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
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CreateUserDto } from '../users/dto/users.dto';
import { 
  VerifyCodeDto, 
  FinalizeLoginDto, 
  RequestPasswordResetDto, 
  ResetPasswordDto, 
  ValidateEmailDto 
} from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService
  ) {}

  // Je gère l'inscription (accessible à tous, pas de guard)
  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    return this.authService.register(createUserDto);
  }

  // Je gère la connexion (vérifie email/mot de passe via LocalAuthGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(LocalAuthGuard)
  login(@Request() req, @Res({ passthrough: true }) res: Response) {
    // Si admin, je retourne requires2FA (pas de JWT ici)
    if (req.user && req.user.requires2FA) {
      return req.user;
    }

    // Je génère les tokens et les stocke en cookies sécurisés
    const tokens = this.authService.login(req.user);
    
    const sameSiteValue = process.env.NODE_ENV === 'production' ? ('none' as const) : ('strict' as const);
    const cookieOptions = {
      httpOnly: true, // Protection XSS
      secure: process.env.NODE_ENV === 'production', // HTTPS obligatoire avec sameSite: 'none'
      sameSite: sameSiteValue, // Cross-domain en prod (Vercel ↔ Render)
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    };

    const refreshCookieOptions = {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    };

    res.cookie('access_token', tokens.access_token, cookieOptions);
    res.cookie('refresh_token', tokens.refresh_token, refreshCookieOptions);

    return {
      user: tokens.user,
      message: 'Connexion réussie. Tokens stockés en cookies sécurisés.'
    };
  }

  // Je renouvelle le token d'accès avec le refresh token
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Request() req, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.refresh_token;
    
    if (!refreshToken) {
      throw new BadRequestException('Refresh token manquant');
    }

    const newTokens = await this.authService.refreshToken(refreshToken);
    
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

  // Je gère la déconnexion (supprime les cookies)
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    // Je dois utiliser les mêmes options que lors de la création pour supprimer les cookies
    const sameSiteValue = process.env.NODE_ENV === 'production' ? ('none' as const) : ('strict' as const);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: sameSiteValue,
      path: '/',
    };
    
    res.clearCookie('access_token', cookieOptions);
    res.clearCookie('refresh_token', cookieOptions);
    
    return { message: 'Déconnexion réussie. Cookies supprimés.' };
  }

  // Je finalise la connexion admin avec le code 2FA
  @Post('2fa/finalize')
  @HttpCode(HttpStatus.OK)
  async finalizeAdminLogin(
    @Body() finalizeLoginDto: FinalizeLoginDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const tokens = await this.authService.finalizeAdminLogin(finalizeLoginDto.email, finalizeLoginDto.code);
    
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

  // Je vérifie un code 2FA (admin connecté)
  @Post('2fa/verify')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async verifyCode(
    @Request() req,
    @Body() verifyCodeDto: VerifyCodeDto
  ) {
    return this.authService.verifyCode(req.user.email, verifyCodeDto.code);
  }

  // Je gère la demande de réinitialisation de mot de passe
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(
    @Body() requestPasswordResetDto: RequestPasswordResetDto
  ) {
    return await this.usersService.forgotPassword(requestPasswordResetDto.email);
  }

  // Je réinitialise le mot de passe avec le token reçu par email
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() resetPasswordDto: ResetPasswordDto
  ) {
    return await this.usersService.resetPassword(resetPasswordDto.token, resetPasswordDto.newPassword);
  }

  // Je valide l'email après inscription (création du compte définitif + connexion automatique)
  @Post('validate-email')
  @HttpCode(HttpStatus.OK)
  async validateEmail(
    @Body() validateEmailDto: ValidateEmailDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const result = await this.authService.validateEmail(validateEmailDto.token);
    
    // Je connecte automatiquement après validation
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

  // Je vérifie l'accès admin (utilisateur connecté ET admin)
  @Get('admin/check')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @HttpCode(HttpStatus.OK)
  checkAdminAccess() {
    return { 
      message: 'Accès administrateur autorisé',
      role: 'admin'
    };
  }

  // Je retourne le profil de l'utilisateur connecté (depuis req.user)
  @Get('profile')
  @UseGuards(JwtAuthGuard)
  getProfile(@Request() req) {
    return req.user;
  }

  // Je récupère toutes les informations de l'utilisateur depuis la base de données
  @Get('user-info')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async getUserInfo(@Request() req) {
    return this.authService.getUserProfile(req.user.sub);
  }
}
