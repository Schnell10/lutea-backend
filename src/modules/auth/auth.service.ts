import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';
import { CreateUserDto } from '../users/dto/users.dto';
import { UserRole, UserDocument } from '../users/users.schema';
import { securityConfig } from '../../config/security.config';
import { logger } from '../../common/utils/logger';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  // Je valide un utilisateur (appelé par LocalAuthGuard lors de la connexion)
  async validateUser(email: string, password: string): Promise<any> {
    logger.log(`[AuthService] Tentative de validation utilisateur: ${email}`);
    
    // Je vérifie que les champs ne sont pas vides
    if (!email || !password) {
      logger.log(`[AuthService] Champs manquants - Email: ${!!email}, Password: ${!!password}`);
      throw new BadRequestException('Email et mot de passe requis');
    }

    // Je recherche l'utilisateur par email
    const user = await this.usersService.findByEmail(email) as UserDocument;
    
    // Vérification 1 : L'utilisateur existe-t-il ?
    if (!user) {
      logger.log(`[AuthService] Utilisateur non trouvé: ${email}`);
      
      // Je vérifie si l'email existe dans la table temporaire (inscription en attente)
      // C'est le SEUL cas où je révèle qu'un email existe
      const userStatus = await this.usersService.checkTemporaryUserStatus(email);
      if (userStatus.isTemporary) {
        logger.log(`[AuthService] Utilisateur temporaire trouvé: ${email}`);
        
        // Je crée un message d'erreur avec le temps restant précis
        let errorMessage = 'Un compte avec cet email est en attente de validation. Veuillez vérifier votre boîte mail pour confirmer votre compte.';
        
        if (userStatus.timeLeft !== undefined) {
          if (userStatus.timeLeft === 0) {
            errorMessage += ' Le délai de validation a expiré. Veuillez vous réinscrire.';
          } else {
            // Je calcule le temps restant en heures et minutes
            const hoursLeft = Math.floor(userStatus.timeLeft / (1000 * 60 * 60));
            const minutesLeft = Math.floor((userStatus.timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            
            if (hoursLeft === 0 && minutesLeft === 0) {
              errorMessage += ' Le délai de validation expire dans moins d\'une minute.';
            } else if (hoursLeft === 0) {
              errorMessage += ` Il vous reste ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''} pour valider votre compte.`;
            } else if (minutesLeft === 0) {
              errorMessage += ` Il vous reste ${hoursLeft} heure${hoursLeft > 1 ? 's' : ''} pour valider votre compte.`;
            } else {
              errorMessage += ` Il vous reste ${hoursLeft} heure${hoursLeft > 1 ? 's' : ''} et ${minutesLeft} minute${minutesLeft > 1 ? 's' : ''} pour valider votre compte.`;
            }
          }
        }
        
        throw new UnauthorizedException(errorMessage);
      }
      
      // Si pas d'utilisateur permanent ni temporaire, message générique (sécurité)
      logger.log(`[AuthService] Aucun compte trouvé (permanent ou temporaire): ${email}`);
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    logger.log(`[AuthService] Utilisateur trouvé: ${email} (Rôle: ${user.role})`);

    // Vérification 2 : Le compte est-il verrouillé ?
    if (this.usersService.isAccountLocked(user)) {
      logger.log(`[AuthService] Compte verrouillé: ${email}`);
      
      // Je calcule le temps restant de blocage
      const lockUntil = user.lockUntil;
      if (lockUntil) {
        const now = new Date();
        const timeRemaining = lockUntil.getTime() - now.getTime();
        const minutesRemaining = Math.ceil(timeRemaining / (1000 * 60));
        
        if (minutesRemaining > 0) {
          throw new UnauthorizedException(`Compte temporairement verrouillé. Déverrouillage dans ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}.`);
        }
      }
      
      throw new UnauthorizedException('Compte temporairement verrouillé');
    }

    // Vérification 3 : Le mot de passe est-il correct ?
    const isPasswordValid = await this.usersService.validatePassword(user, password);
    
    // Si le mot de passe est incorrect
    if (!isPasswordValid) {
      logger.log(`[AuthService] Mot de passe incorrect: ${email}`);
      // J'incrémente les tentatives échouées
      await this.usersService.incrementFailedAttempts(email);
      
      // Je récupère l'utilisateur mis à jour pour avoir le bon nombre de tentatives
      const updatedUser = await this.usersService.findByEmail(email);
      
      // Je verrouille le compte après le nombre de tentatives configuré
      if (updatedUser.failedLoginAttempts >= securityConfig.login.lockThreshold) {
        logger.log(`[AuthService] Verrouillage du compte: ${email} (${updatedUser.failedLoginAttempts} tentatives échouées)`);
        await this.usersService.lockAccount(email, securityConfig.login.lockDuration);
        
        // Je calcule le temps restant de blocage
        const lockUntil = new Date(Date.now() + securityConfig.login.lockDuration * 60 * 1000);
        const minutesRemaining = Math.ceil((lockUntil.getTime() - Date.now()) / (1000 * 60));
        
        throw new UnauthorizedException(`Compte verrouillé après trop de tentatives échouées. Déverrouillage dans ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}.`);
      }
      
      // Je calcule le nombre d'essais restants
      const remainingAttempts = securityConfig.login.lockThreshold - updatedUser.failedLoginAttempts;
      
      // Je crée une exception avec les informations sur les tentatives restantes
      const errorMessage = `Email ou mot de passe incorrect. Il vous reste ${remainingAttempts} tentative${remainingAttempts > 1 ? 's' : ''}.`;
      const error = new UnauthorizedException(errorMessage);
      (error as any).remainingAttempts = remainingAttempts;
      (error as any).failedAttempts = updatedUser.failedLoginAttempts;
      throw error;
    }

    logger.log(`[AuthService] Mot de passe validé: ${email}`);

    // Si le mot de passe est correct, je réinitialise les tentatives échouées
    await this.usersService.resetFailedAttempts(email);
    
    // Je mets à jour la date de dernière connexion
    await this.usersService.updateLastLogin(user._id.toString());

    // Je vérifie la 2FA automatiquement pour les admins
    if (user.role === UserRole.ADMIN) {
      logger.log(`[AuthService] Utilisateur admin détecté, génération 2FA: ${email}`);
      // Je génère et envoie le code 2FA automatiquement
      const twoFAResult = await this.usersService.generateAndSendVerificationCode(email);
      
      if (!twoFAResult.success) {
        logger.log(`[AuthService] Erreur génération 2FA: ${email}`);
        throw new UnauthorizedException('Erreur lors de la génération du code 2FA');
      }
      
      // Je retourne un objet spécial indiquant que la 2FA est requise
      const userObj = user.toObject();
      const { password: _, ...result } = userObj;
      return {
        ...result,
        requires2FA: true,
        message: 'Code 2FA envoyé par email. Veuillez le saisir pour finaliser la connexion.'
      };
    }

    logger.log(`[AuthService] Validation réussie (utilisateur normal): ${email}`);
    // Je retourne l'utilisateur sans le mot de passe (sécurité)
    const userObj = user.toObject();
    const { password: _, ...result } = userObj;
    return result;
  }

  // Je génère les tokens JWT après validation réussie par LocalAuthGuard
  login(user: UserDocument) {
    logger.log(`[AuthService] Génération des tokens JWT pour: ${user.email}`);
    
    // Je crée le payload pour le JWT d'accès
    const payload = { 
      email: user.email,
      sub: user._id.toString(), // ID MongoDB (subject du JWT)
      role: user.role,
    };

    logger.log(`[AuthService] Payload JWT créé:`, { email: user.email, role: user.role, sub: user._id.toString() });

    // Je génère le JWT d'accès avec la configuration centralisée
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: securityConfig.jwt.accessTokenExpiry
    });

    logger.log(`[AuthService] Access token généré (expire dans ${securityConfig.jwt.accessTokenExpiry})`);

    // Je génère le refresh token avec une durée différente selon le rôle
    // Admins : durée configurée dans securityConfig (4h par défaut) pour sécurité
    // Clients : 7 jours pour meilleure expérience utilisateur
    const refreshTokenExpiry = user.role === UserRole.ADMIN 
      ? securityConfig.jwt.refreshTokenExpiryAdmin // Durée pour les admins 4h
      : securityConfig.jwt.refreshTokenExpiry; // 7 jours pour les clients
    
    const refreshToken = this.jwtService.sign(
      { 
        sub: user._id.toString(),
        type: 'refresh', // Pour distinguer access/refresh
      },
      { expiresIn: refreshTokenExpiry }
    );

    logger.log(`[AuthService] Refresh token généré (expire dans ${refreshTokenExpiry}) pour ${user.role}`);

    // Je retourne les tokens et informations utilisateur
    const result = {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 15 * 60, // 15 minutes
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      }
    };

    logger.log(`[AuthService] Connexion réussie pour: ${user.email} (Rôle: ${user.role})`);
    return result;
  }

  // Je gère l'inscription d'un utilisateur (création d'un compte temporaire)
  async register(createUserDto: CreateUserDto) {
    logger.log('[AuthService] Tentative d\'inscription avec données:', {
      email: createUserDto.email,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      phone: createUserDto.phone,
      address: createUserDto.address,
      city: createUserDto.city,
      postalCode: createUserDto.postalCode,
      country: createUserDto.country,
      hasPassword: !!createUserDto.password,
      passwordLength: createUserDto.password?.length,
      hasToken: !!createUserDto.token
    });

    // Je vérifie reCAPTCHA si un token est fourni
    if (createUserDto.token) {
      logger.log('[AuthService] Token reCAPTCHA reçu, vérification en cours...');
      const isRecaptchaValid = await this.emailService.verifyRecaptcha(createUserDto.token);
      if (!isRecaptchaValid) {
        logger.log('[AuthService] Échec de la vérification reCAPTCHA pour l\'inscription');
        throw new BadRequestException('Échec de la vérification reCAPTCHA');
      }
      logger.log('[AuthService] reCAPTCHA validé, inscription en cours...');
    } else {
      logger.log('[AuthService] Aucun token reCAPTCHA fourni pour l\'inscription');
    }

    // Je vérifie que les champs obligatoires sont présents
    if (!createUserDto.email || !createUserDto.password) {
      logger.log('[AuthService] Champs de base manquants:', {
        hasEmail: !!createUserDto.email,
        hasPassword: !!createUserDto.password
      });
      throw new BadRequestException('Email et mot de passe requis');
    }

    // Je vérifie les champs de contact requis
    const missingFields = [];
    if (!createUserDto.phone) missingFields.push('téléphone');
    if (!createUserDto.address) missingFields.push('adresse');
    if (!createUserDto.city) missingFields.push('ville');
    if (!createUserDto.postalCode) missingFields.push('code postal');
    if (!createUserDto.country) missingFields.push('pays');

    if (missingFields.length > 0) {
      logger.log('[AuthService] Champs de contact manquants:', missingFields);
      throw new BadRequestException(`Champs manquants : ${missingFields.join(', ')}`);
    }

    logger.log('[AuthService] Validation des données réussie, création de l\'utilisateur...');

    // Je vérifie si l'email existe déjà
    const existingUser = await this.usersService.findByEmail(createUserDto.email);
    if (existingUser) {
      logger.log('[AuthService] Email déjà utilisé:', createUserDto.email);
      throw new ForbiddenException('Un utilisateur avec cet email existe déjà');
    }

    // Je prépare l'inscription avec validation email (création d'un compte temporaire)
    const registrationResult = await this.usersService.prepareRegistration(createUserDto);
    
    logger.log('[AuthService] Inscription préparée avec succès pour:', createUserDto.email);
    
    // L'utilisateur n'est pas encore créé, il faut valider l'email d'abord
    return {
      message: 'Inscription préparée. Veuillez vérifier votre email pour activer votre compte.',
      email: registrationResult.email,
      requiresEmailValidation: true
    };
  }

  // Je renouvelle le token d'accès avec un refresh token valide
  async refreshToken(refreshToken: string) {
    logger.log('[AuthService] Refresh token demandé');
    
    if (!refreshToken) {
      throw new BadRequestException('Token de refresh requis');
    }

    try {
      // Je vérifie le refresh token
      const payload = this.jwtService.verify(refreshToken);
      
      // Je vérifie que c'est bien un token de refresh
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Token de refresh invalide');
      }

      // Je récupère l'utilisateur depuis la base de données
      const user = await this.usersService.findById(payload.sub) as UserDocument;
      if (!user) {
        throw new UnauthorizedException('Utilisateur non trouvé');
      }

      // Je génère un nouveau JWT d'accès
      const newPayload = { 
        email: user.email,
        sub: user._id.toString(),
        role: user.role,
      };
      
      const newAccessToken = this.jwtService.sign(newPayload);
      logger.log(`[AuthService] Nouveau access token généré pour ${user.email} (${user.role})`);

      // Je retourne le nouveau token et les informations utilisateur
      return {
        access_token: newAccessToken,
        expires_in: 15 * 60,
        user: {
          id: user._id.toString(),
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
        }
      };
    } catch (error) {
      logger.error(`[AuthService] Échec du refresh token: ${error.message}`);
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token de refresh invalide');
    }
  }

  // Je vérifie un code 2FA (pour admin)
  async verifyCode(email: string, code: string): Promise<boolean> {
    if (!email || !code) {
      throw new BadRequestException('Email et code requis');
    }

    // Je vérifie le code via le service utilisateur
    const isValid = await this.usersService.verifyCode(email, code);
    
    if (isValid) {
      // Je supprime le code utilisé (sécurité)
      await this.usersService.clearVerificationCode(email);
    }

    return isValid;
  }

  // Je finalise la connexion admin avec le code 2FA
  async finalizeAdminLogin(email: string, code: string): Promise<any> {
    // Je vérifie le code 2FA
    const isCodeValid = await this.verifyCode(email, code);
    
    if (!isCodeValid) {
      throw new UnauthorizedException('Code 2FA invalide ou expiré');
    }

    // Je récupère l'utilisateur admin
    const user = await this.usersService.findByEmail(email);
    if (!user || user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Accès administrateur requis');
    }

    // Je génère les tokens JWT (connexion réussie)
    return this.login(user as UserDocument);
  }

  // Je gère la déconnexion
  logout(): { message: string } {
    return { message: 'Déconnexion réussie' };
  }

  // Je valide l'email depuis le lien reçu par email (création compte définitif + connexion automatique)
  async validateEmail(token: string): Promise<{ message: string; user: any; access_token: string; refresh_token: string }> {
    logger.log(`[AuthService] Tentative de validation email avec token: ${token.substring(0, 8)}...`);
    
    if (!token) {
      throw new BadRequestException('Token requis');
    }

    try {
      logger.log(`[AuthService] Création du compte après validation email...`);
      const user = await this.usersService.createAccountAfterEmailValidation(token);
      logger.log(`[AuthService] Compte créé avec succès: ${user.email}`);
      
      // Je connecte automatiquement après validation
      logger.log(`[AuthService] Génération des tokens de connexion...`);
      const loginResult = this.login(user as UserDocument);
      logger.log(`[AuthService] Tokens générés avec succès pour: ${user.email}`);
      
      return { 
        message: 'Email validé avec succès. Votre compte a été créé et vous êtes maintenant connecté.',
        user: loginResult.user,
        access_token: loginResult.access_token,
        refresh_token: loginResult.refresh_token
      };
    } catch (error) {
      logger.error(`[AuthService] Erreur lors de la validation email:`, error);
      throw error;
    }
  }

  // Je récupère toutes les informations de l'utilisateur depuis la base de données
  async getUserProfile(userId: string): Promise<any> {
    logger.log(`[AuthService] Récupération du profil utilisateur: ${userId}`);
    
    try {
      const user = await this.usersService.findById(userId) as UserDocument;
      
      if (!user) {
        logger.log(`[AuthService] Utilisateur non trouvé: ${userId}`);
        throw new UnauthorizedException('Utilisateur non trouvé');
      }

      logger.log(`[AuthService] Profil utilisateur récupéré: ${user.email}`);
      
      // Je retourne l'utilisateur sans le mot de passe
      const userObj = user.toObject();
      const { password: _, ...result } = userObj;
      return result;
    } catch (error) {
      logger.error(`[AuthService] Erreur lors de la récupération du profil:`, error);
      throw error;
    }
  }
}
