import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument, UserRole, TemporaryUser, TemporaryUserDocument } from './users.schema';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { securityConfig } from '../../config/security.config';
import { EmailService } from '../email/email.service';
import { logger } from '../../common/utils/logger';

@Injectable()
export class UsersService {
  
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(TemporaryUser.name) private temporaryUserModel: Model<TemporaryUserDocument>,
    private emailService: EmailService
  ) {}

  // Je génère un token de validation unique
  private generateVerificationToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  // Je prépare l'inscription (compte temporaire créé)
  async prepareRegistration(createUserDto: any): Promise<{ email: string, verificationToken: string }> {
    logger.log(`[UsersService] Préparation inscription pour: ${createUserDto.email}`);
    
    // Je vérifie que l'email n'existe pas déjà (ni dans users ni dans temporary_users)
    const existingUser = await this.findByEmail(createUserDto.email);
    const existingTemporaryUser = await this.temporaryUserModel.findOne({ email: createUserDto.email }).exec();
    
    if (existingUser) {
      logger.log(`[UsersService] Email déjà utilisé par un compte permanent: ${createUserDto.email}`);
      throw new BadRequestException('Un compte avec cet email existe déjà');
    }
    
    if (existingTemporaryUser) {
      logger.log(`[UsersService] Email déjà utilisé par un compte temporaire: ${createUserDto.email}`);
      throw new BadRequestException('Un compte avec cet email est en attente de validation. Veuillez vérifier votre boîte mail pour confirmer votre compte.');
    }

    logger.log(`[UsersService] Email disponible: ${createUserDto.email}`);

    // Je hash le mot de passe
    const hashedPassword = await bcrypt.hash(createUserDto.password, securityConfig.password.saltRounds);
    logger.log(`[UsersService] Mot de passe hashé avec ${securityConfig.password.saltRounds} rounds`);

    // Je génère un token de validation unique
    const verificationToken = this.generateVerificationToken();
    logger.log(`[UsersService] Token de validation généré: ${verificationToken.substring(0, 8)}...`);
    
    // Je crée un utilisateur temporaire (expire dans 24h)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures
    
    const temporaryUser = new this.temporaryUserModel({
      ...createUserDto,
      password: hashedPassword,
      role: UserRole.CLIENT, // FORCÉ !
      verificationToken: verificationToken,
      expiresAt: expiresAt
    });

    // Je sauvegarde l'utilisateur temporaire
    await temporaryUser.save();
    logger.log(`[UsersService] Utilisateur temporaire créé: ${createUserDto.email} (expire: ${expiresAt.toISOString()})`);
    
    // J'envoie l'email avec le lien de validation
    await this.emailService.sendRegistrationValidation(createUserDto.email, verificationToken);
    logger.log(`[UsersService] Email de validation envoyé: ${createUserDto.email}`);
    
    return {
      email: createUserDto.email,
      verificationToken: verificationToken
    };
  }

  // Je crée le compte après validation email
  async createAccountAfterEmailValidation(verificationToken: string): Promise<User> {
    logger.log(`[UsersService] Création du compte après validation email avec token: ${verificationToken.substring(0, 8)}...`);
    
    try {
      // Je récupère l'utilisateur temporaire par token
      logger.log(`[UsersService] Recherche de l'utilisateur temporaire...`);
      const temporaryUser = await this.temporaryUserModel.findOne({ 
        verificationToken: verificationToken 
      }).exec();
      
      // Je vérifie que le token existe et n'est pas expiré
      if (!temporaryUser) {
        logger.log(`[UsersService] Token de validation invalide: ${verificationToken.substring(0, 8)}...`);
        throw new BadRequestException('Token de validation invalide');
      }
      
      logger.log(`[UsersService] Utilisateur temporaire trouvé: ${temporaryUser.email}`);
      
      if (temporaryUser.expiresAt < new Date()) {
        logger.log(`[UsersService] Token expiré pour: ${temporaryUser.email}`);
        // Je supprime l'utilisateur temporaire expiré
        await this.temporaryUserModel.findByIdAndDelete(temporaryUser._id).exec();
        throw new BadRequestException('Token de validation expiré');
      }
      
      logger.log(`[UsersService] Token valide pour: ${temporaryUser.email}`);
      
      // Je crée le compte PERMANENT (email déjà validé)
      logger.log(`[UsersService] Création du compte permanent...`);
      const user = new this.userModel({
        email: temporaryUser.email,
        password: temporaryUser.password, // Déjà hashé
        firstName: temporaryUser.firstName,
        lastName: temporaryUser.lastName,
        role: temporaryUser.role,
        isEmailVerified: true, // Email déjà validé
        phone: temporaryUser.phone,
        address: temporaryUser.address,
        city: temporaryUser.city,
        postalCode: temporaryUser.postalCode,
        country: temporaryUser.country
      });

      // Je sauvegarde l'utilisateur permanent
      logger.log(`[UsersService] Sauvegarde du compte permanent...`);
      const savedUser = await user.save();
      logger.log(`[UsersService] Compte permanent sauvegardé: ${savedUser.email}`);

      // Je supprime l'utilisateur temporaire
      logger.log(`[UsersService] Suppression de l'utilisateur temporaire...`);
      await this.temporaryUserModel.findByIdAndDelete(temporaryUser._id).exec();
      logger.log(`[UsersService] Utilisateur temporaire supprimé`);

      return savedUser;
    } catch (error) {
      logger.error(`[UsersService] Erreur lors de la création du compte:`, error);
      throw error;
    }
  }

  // Je recherche par email
  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  // Je recherche par ID
  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  // Je mets à jour le profil
  async updateProfile(userId: string, updateUserDto: any): Promise<User | null> {
    logger.log(`[UsersService] Mise à jour du profil pour l'utilisateur: ${userId}`);
    logger.log(`[UsersService] Données reçues:`, {
      hasCurrentPassword: !!updateUserDto.currentPassword,
      hasNewPassword: !!updateUserDto.newPassword,
      hasConfirmPassword: !!updateUserDto.confirmPassword,
      otherFields: Object.keys(updateUserDto).filter(key => !['currentPassword', 'newPassword', 'confirmPassword', 'role'].includes(key))
    });
    
    // Je ne permets pas la modification du rôle (sécurité)
    const { role: _role, currentPassword: _currentPassword, newPassword, confirmPassword: _confirmPassword, ...safeUpdates } = updateUserDto;

    // Si un nouveau mot de passe est fourni, je le hash
    if (newPassword) {
      logger.log(`[UsersService] Nouveau mot de passe détecté - début du hachage...`);
      logger.log(`[UsersService] Longueur du nouveau mot de passe: ${newPassword.length} caractères`);
      
      try {
        // Je hash le nouveau mot de passe avec bcrypt
        const hashedNewPassword = await bcrypt.hash(newPassword, securityConfig.password.saltRounds);
        safeUpdates.password = hashedNewPassword;
        
        logger.log(`[UsersService] Nouveau mot de passe hashé avec succès pour l'utilisateur: ${userId}`);
        logger.log(`[UsersService] Hash généré: ${hashedNewPassword.substring(0, 20)}...`);
      } catch (error) {
        logger.error(`[UsersService] Erreur lors du hachage du mot de passe:`, error);
        throw error;
      }
    } else {
      logger.log(`[UsersService] Aucun nouveau mot de passe fourni - mise à jour des autres champs uniquement`);
    }

    logger.log(`[UsersService] Mise à jour en base de données...`);
    logger.log(`[UsersService] Champs à mettre à jour:`, Object.keys(safeUpdates));

    try {
      const updatedUser = await this.userModel
        .findByIdAndUpdate(userId, safeUpdates, { new: true })
        .exec();

      if (updatedUser) {
        logger.log(`[UsersService] Profil mis à jour avec succès pour l'utilisateur: ${userId}`);
        logger.log(`[UsersService] Email utilisateur: ${updatedUser.email}`);
      } else {
        logger.error(`[UsersService] Aucun utilisateur trouvé avec l'ID: ${userId}`);
      }

      return updatedUser;
    } catch (error) {
      logger.error(`[UsersService] Erreur lors de la mise à jour en base:`, error);
      throw error;
    }
  }

  // Je valide le mot de passe en comparant le mot de passe fourni avec le hash stocké en base
  async validatePassword(user: User, password: string): Promise<boolean> {
    logger.log(`[UsersService] Validation mot de passe pour: ${user.email}`);
    
    try {
      const isMatch = await bcrypt.compare(password, user.password);
      logger.log(`[UsersService] Mot de passe ${isMatch ? 'valide' : 'invalide'} pour: ${user.email}`);
      return isMatch;
    } catch (error) {
      logger.log(`[UsersService] Erreur lors de la validation du mot de passe: ${user.email}`, error.message);
      return false;
    }
  }

  // Je gère les tentatives de connexion
  async incrementFailedAttempts(email: string): Promise<void> {
    await this.userModel.updateOne(
      { email },
      { $inc: { failedLoginAttempts: 1 } }
    ).exec();
  }

  async resetFailedAttempts(email: string): Promise<void> {
    await this.userModel.updateOne(
      { email },
      {
        failedLoginAttempts: 0,
        lockUntil: null
      }
    ).exec();
  }

  // Je vérifie le verrouillage
  isAccountLocked(user: User): boolean {
    if (!user.lockUntil) return false;
    return user.lockUntil > new Date();
  }

  // Je verrouille le compte
  async lockAccount(email: string, lockDuration: number = securityConfig.login.lockDuration): Promise<void> {
    const lockUntil = new Date(Date.now() + lockDuration * 60 * 1000);
    
    await this.userModel.updateOne(
      { email },
      { lockUntil }
    ).exec();
  }

  // Je mets à jour la dernière connexion
  async updateLastLogin(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { lastLogin: new Date() }
    ).exec();
  }

  // Je gère la double authentification
  async updateVerificationCode(email: string, code: string, expiresAt: Date): Promise<void> {
    await this.userModel.updateOne(
      { email },
      {
        verificationCode: code,
        verificationCodeExpires: expiresAt,
        verificationCodeAttempts: 0,
      }
    ).exec();
  }

  async verifyCode(email: string, code: string): Promise<boolean> {
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) return false;

    // Je vérifie si le code est expiré
    if (!user.verificationCode || !user.verificationCodeExpires || user.verificationCodeExpires <= new Date()) {
      return false;
    }

    // Je vérifie si le nombre max d'essais est dépassé
    if ((user.verificationCodeAttempts || 0) >= securityConfig.twoFactor.maxAttempts) {
      // J'invalide le code
      await this.clearVerificationCode(email);
      return false;
    }

    // Je vérifie le code
    const isValid = user.verificationCode === code;

    if (isValid) {
      // Succès: je laisse clearVerificationCode être appelé par l'appelant pour nettoyer
      return true;
    }

    // Échec: j'incrémente le compteur, et j'invalide si max atteint
    const attempts = (user.verificationCodeAttempts || 0) + 1;
    const reachedMax = attempts >= securityConfig.twoFactor.maxAttempts;

    await this.userModel.updateOne(
      { email },
      reachedMax
        ? { verificationCodeAttempts: attempts, verificationCode: null, verificationCodeExpires: null }
        : { verificationCodeAttempts: attempts }
    ).exec();

    return false;
  }

  async clearVerificationCode(email: string): Promise<void> {
    await this.userModel.updateOne(
      { email },
      {
        verificationCode: null,
        verificationCodeExpires: null
      }
    ).exec();
  }


  // Je vérifie le rôle admin
  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.findById(userId);
    return user?.role === UserRole.ADMIN;
  }

  // Je liste tous les utilisateurs (admin seulement)
  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  // Je supprime un utilisateur
  async remove(userId: string): Promise<User | null> {
    return this.userModel.findByIdAndDelete(userId).exec();
  }

  // Je vérifie si un utilisateur est temporaire
  async checkTemporaryUserStatus(email: string): Promise<{ isTemporary: boolean, timeLeft?: number }> {
    // Je vérifie d'abord dans les utilisateurs permanents
    const permanentUser = await this.findByEmail(email);
    if (permanentUser) {
      return { isTemporary: false };
    }

    // Je vérifie dans les utilisateurs temporaires
    const temporaryUser = await this.temporaryUserModel.findOne({ email }).exec();
    if (!temporaryUser) {
      return { isTemporary: false };
    }

    // Je calcule le temps restant en millisecondes (pour plus de précision)
    const now = new Date();
    const timeLeft = Math.max(0, temporaryUser.expiresAt.getTime() - now.getTime());

    return { 
      isTemporary: true, 
      timeLeft: timeLeft 
    };
  }

  // Je nettoie automatiquement les utilisateurs temporaires expirés (cette méthode peut être appelée par un cron job)
  async cleanupExpiredTemporaryUsers(): Promise<number> {
    const now = new Date();
    const result = await this.temporaryUserModel.deleteMany({
      expiresAt: { $lt: now }
    }).exec();
    
    return result.deletedCount || 0;
  }

  // Je nettoie automatiquement avec logs
  async cleanupExpiredTemporaryUsersWithLogs(): Promise<{ deletedCount: number, cleanedEmails: string[] }> {
    const now = new Date();
    
    // Je récupère tous les comptes expirés AVANT de les supprimer
    const expiredUsers = await this.temporaryUserModel.find({
      expiresAt: { $lt: now }
    }).exec();
    
    // J'extrais les emails pour les logs
    const cleanedEmails = expiredUsers.map(user => user.email);
    
    // Je supprime tous les comptes expirés
    const result = await this.temporaryUserModel.deleteMany({
      expiresAt: { $lt: now }
    }).exec();
    
    // Log des suppressions (pour le monitoring)
    if (result.deletedCount > 0) {
      logger.log(`Nettoyage automatique : ${result.deletedCount} comptes temporaires supprimés`);
      logger.log(`Emails supprimés : ${cleanedEmails.join(', ')}`);
    }
    
    return { 
      deletedCount: result.deletedCount || 0,
      cleanedEmails: cleanedEmails
    };
  }

  // Je génère et j'envoie le code 2FA pour admin
  async generateAndSendVerificationCode(email: string): Promise<{ success: boolean, message: string }> {
    try {
      // Je vérifie que l'utilisateur existe et est admin
      const user = await this.findByEmail(email);
      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }
      
      if (user.role !== UserRole.ADMIN) {
        throw new Error('Accès administrateur requis pour la 2FA');
      }

      // Je génère un code à 8 chiffres
      const code = this.generateSixDigitCode();
      
      // Je calcule la date d'expiration (10 minutes)
      const expiresAt = new Date(Date.now() + securityConfig.twoFactor.codeExpiry * 60 * 1000);

      // Je sauvegarde le code en base
      await this.updateVerificationCode(email, code, expiresAt);

      // J'envoie l'email avec le code 2FA
      await this.emailService.send2FACode(email, code);
      
      logger.log(`Code 2FA généré pour ${email} (expire dans ${securityConfig.twoFactor.codeExpiry} minutes)`);
      
      return {
        success: true,
        message: `Code 2FA envoyé à ${email}`
      };
      
    } catch (error) {
      logger.error('Erreur lors de la génération du code 2FA:', error);
      return {
        success: false,
        message: error.message || 'Erreur lors de la génération du code 2FA'
      };
    }
  }

  // Je génère un code à 8 chiffres
  private generateSixDigitCode(): string {
    // Je génère de façon cryptographiquement sûre un code sur 8 chiffres (00000000 -> 99999999)
    const randomNumber = crypto.randomInt(0, 100_000_000);
    return randomNumber.toString().padStart(8, '0');
  }

  // Je génère un token de réinitialisation de mot de passe
  async generatePasswordResetToken(email: string): Promise<string> {
    // Je vérifie le rate limiting
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - securityConfig.passwordReset.windowMs);
    
    // Je vérifie si l'utilisateur a dépassé la limite
    if (user.passwordResetAttempts >= securityConfig.passwordReset.maxAttempts) {
      if (user.passwordResetLastAttempt && user.passwordResetLastAttempt > oneHourAgo) {
        const timeLeft = Math.ceil((user.passwordResetLastAttempt.getTime() + securityConfig.passwordReset.windowMs - now.getTime()) / (1000 * 60));
        throw new BadRequestException(`Trop de tentatives de réinitialisation. Réessayez dans ${timeLeft} minutes.`);
      } else {
        // Je reset le compteur si la fenêtre de temps est dépassée
        await this.userModel.updateOne(
          { email },
          { 
            passwordResetAttempts: 0,
            passwordResetLastAttempt: null
          }
        ).exec();
      }
    }

    // Je génère un token sécurisé de 32 caractères
    const resetToken = crypto.randomBytes(16).toString('hex');
    
    // Je calcule la date d'expiration (1 heure)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    
    // Je sauvegarde le token en base et j'incrémente le compteur
    await this.userModel.updateOne(
      { email: email },
      { 
        passwordResetToken: resetToken,
        passwordResetExpires: expiresAt,
        passwordResetAttempts: (user.passwordResetAttempts || 0) + 1,
        passwordResetLastAttempt: now
      }
    ).exec();
    
    logger.log(`[UsersService] Token de réinitialisation généré pour: ${email} (tentative ${(user.passwordResetAttempts || 0) + 1}/${securityConfig.passwordReset.maxAttempts})`);
    
    return resetToken;
  }

  // J'envoie l'email de réinitialisation
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    try {
      return await this.emailService.sendPasswordReset(email, resetToken);
    } catch (error) {
      logger.error(`Erreur lors de l'envoi de l'email de réinitialisation à ${email}:`, error);
      return false;
    }
  }

  // Mot de passe oublié - je gère la demande de réinitialisation
  // email: string : Email de l'utilisateur qui a oublié son mot de passe
  // Retourne un message de confirmation
  async forgotPassword(email: string): Promise<{ message: string }> {
    // Je valide que l'email est fourni
    if (!email) {
      throw new BadRequestException('Email requis');
    }

    // Je recherche l'utilisateur par email
    const user = await this.findByEmail(email);
    
    // Je vérifie que l'utilisateur existe
    if (!user) {
      // Pour la sécurité, je ne révèle pas si l'email existe ou non
      return { message: 'Si cet email existe dans notre base, un lien de réinitialisation a été envoyé.' };
    }

    // Je génère un token de réinitialisation sécurisé
    const resetToken = await this.generatePasswordResetToken(email);
    
    // J'envoie l'email avec le lien de réinitialisation
    await this.sendPasswordResetEmail(email, resetToken);

    return { message: 'Si cet email existe dans notre base, un lien de réinitialisation a été envoyé.' };
  }

  // Je réinitialise le mot de passe
  // token: string : Token de réinitialisation reçu par email
  // newPassword: string : Nouveau mot de passe choisi par l'utilisateur
  // Retourne un message de confirmation
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    // Je valide les entrées
    if (!token || !newPassword) {
      throw new BadRequestException('Token et nouveau mot de passe requis');
    }

    // La validation de la force du mot de passe est maintenant gérée automatiquement 
    // par le ValidationPipe via les décorateurs @MinLength(8) et @Matches() dans ResetPasswordDto

    // Je réinitialise le mot de passe via le service utilisateur
    const success = await this.resetPasswordWithToken(token, newPassword);
    
    if (!success) {
      throw new UnauthorizedException('Token de réinitialisation invalide ou expiré');
    }

    return { message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.' };
  }

  // Je réinitialise le mot de passe avec token
  async resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
    try {
      logger.log(`[UsersService] Tentative de réinitialisation avec token: ${token.substring(0, 8)}...`);
      
      // Je recherche l'utilisateur par token et je vérifie l'expiration
      const user = await this.userModel.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() }
      }).exec();
      
      if (!user) {
        logger.log(`[UsersService] Token invalide ou expiré: ${token.substring(0, 8)}...`);
        return false; // Token invalide ou expiré
      }
      
      logger.log(`[UsersService] Token valide trouvé pour: ${user.email}`);
      
      // Je hash le nouveau mot de passe
      const hashedPassword = await bcrypt.hash(newPassword, securityConfig.password.saltRounds);
      logger.log(`[UsersService] Nouveau mot de passe hashé pour: ${user.email}`);
      
      // Je mets à jour le mot de passe et je supprime le token
      await this.userModel.updateOne(
        { _id: user._id },
        { 
          password: hashedPassword,
          passwordResetToken: undefined,
          passwordResetExpires: undefined
        }
      ).exec();
      
      logger.log(`[UsersService] Mot de passe réinitialisé avec succès pour: ${user.email}`);
      logger.log(`[UsersService] Token de réinitialisation supprimé pour: ${user.email}`);
      
      // Je réinitialise le compteur de tentatives après succès
      await this.userModel.updateOne(
        { _id: user._id },
        { 
          passwordResetAttempts: 0,
          passwordResetLastAttempt: null
        }
      ).exec();
      
      logger.log(`[UsersService] Compteur de tentatives réinitialisé pour: ${user.email}`);
      
      return true;
      
    } catch (error) {
      logger.error('Erreur lors de la réinitialisation du mot de passe:', error);
      return false;
    }
  }
}
