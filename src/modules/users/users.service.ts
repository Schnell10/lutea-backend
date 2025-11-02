// Import des fonctionnalités NATIVES de NestJS
import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

// Import de nos types et classes personnalisés
import { User, UserDocument, UserRole, TemporaryUser, TemporaryUserDocument } from './users.schema';

// Import de bcrypt pour le hachage sécurisé des mots de passe
import * as bcrypt from 'bcrypt';

// Import de crypto pour générer des tokens sécurisés
import * as crypto from 'crypto';

// Import de notre configuration de sécurité centralisée
import { securityConfig } from '../../config/security.config';

// Import du service email
import { EmailService } from '../email/email.service';

// Import du logger personnalisé
import { logger } from '../../common/utils/logger';

@Injectable()
export class UsersService {
  
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(TemporaryUser.name) private temporaryUserModel: Model<TemporaryUserDocument>,
    private emailService: EmailService
  ) {}

  // GÉNÉRATION D'UN TOKEN DE VALIDATION UNIQUE
  private generateVerificationToken(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  // PRÉPARATION DE L'INSCRIPTION (compte temporaire créé)
  async prepareRegistration(createUserDto: any): Promise<{ email: string, verificationToken: string }> {
    logger.log(`📝 [UsersService] Préparation inscription pour: ${createUserDto.email}`);
    
    // Vérifier que l'email n'existe pas déjà (ni dans users ni dans temporary_users)
    const existingUser = await this.findByEmail(createUserDto.email);
    const existingTemporaryUser = await this.temporaryUserModel.findOne({ email: createUserDto.email }).exec();
    
    if (existingUser) {
      logger.log(`❌ [UsersService] Email déjà utilisé par un compte permanent: ${createUserDto.email}`);
      throw new BadRequestException('Un compte avec cet email existe déjà');
    }
    
    if (existingTemporaryUser) {
      logger.log(`❌ [UsersService] Email déjà utilisé par un compte temporaire: ${createUserDto.email}`);
      throw new BadRequestException('Un compte avec cet email est en attente de validation. Veuillez vérifier votre boîte mail pour confirmer votre compte.');
    }

    logger.log(`✅ [UsersService] Email disponible: ${createUserDto.email}`);

    // Hash du mot de passe
    const hashedPassword = await bcrypt.hash(createUserDto.password, securityConfig.password.saltRounds);
    logger.log(`🔒 [UsersService] Mot de passe hashé avec ${securityConfig.password.saltRounds} rounds`);

    // Générer un token de validation unique
    const verificationToken = this.generateVerificationToken();
    logger.log(`🔑 [UsersService] Token de validation généré: ${verificationToken.substring(0, 8)}...`);
    
    // Créer un utilisateur temporaire (expire dans 24h)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 heures
    
    const temporaryUser = new this.temporaryUserModel({
      ...createUserDto,
      password: hashedPassword,
      role: UserRole.CLIENT, // FORCÉ !
      verificationToken: verificationToken,
      expiresAt: expiresAt
    });

    // Sauvegarder l'utilisateur temporaire
    await temporaryUser.save();
    logger.log(`💾 [UsersService] Utilisateur temporaire créé: ${createUserDto.email} (expire: ${expiresAt.toISOString()})`);
    
    // Envoyer l'email avec le lien de validation
    await this.emailService.sendRegistrationValidation(createUserDto.email, verificationToken);
    logger.log(`📧 [UsersService] Email de validation envoyé: ${createUserDto.email}`);
    
    return {
      email: createUserDto.email,
      verificationToken: verificationToken
    };
  }

  // CRÉATION DU COMPTE APRÈS VALIDATION EMAIL
  async createAccountAfterEmailValidation(verificationToken: string): Promise<User> {
    logger.log(`📝 [UsersService] Création du compte après validation email avec token: ${verificationToken.substring(0, 8)}...`);
    
    try {
      // Récupérer l'utilisateur temporaire par token
      logger.log(`🔍 [UsersService] Recherche de l'utilisateur temporaire...`);
      const temporaryUser = await this.temporaryUserModel.findOne({ 
        verificationToken: verificationToken 
      }).exec();
      
      // Vérifier que le token existe et n'est pas expiré
      if (!temporaryUser) {
        logger.log(`❌ [UsersService] Token de validation invalide: ${verificationToken.substring(0, 8)}...`);
        throw new BadRequestException('Token de validation invalide');
      }
      
      logger.log(`✅ [UsersService] Utilisateur temporaire trouvé: ${temporaryUser.email}`);
      
      if (temporaryUser.expiresAt < new Date()) {
        logger.log(`⏰ [UsersService] Token expiré pour: ${temporaryUser.email}`);
        // Supprimer l'utilisateur temporaire expiré
        await this.temporaryUserModel.findByIdAndDelete(temporaryUser._id).exec();
        throw new BadRequestException('Token de validation expiré');
      }
      
      logger.log(`✅ [UsersService] Token valide pour: ${temporaryUser.email}`);
      
      // Créer le compte PERMANENT (email déjà validé)
      logger.log(`👤 [UsersService] Création du compte permanent...`);
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

      // Sauvegarder l'utilisateur permanent
      logger.log(`💾 [UsersService] Sauvegarde du compte permanent...`);
      const savedUser = await user.save();
      logger.log(`✅ [UsersService] Compte permanent sauvegardé: ${savedUser.email}`);

      // Supprimer l'utilisateur temporaire
      logger.log(`🗑️ [UsersService] Suppression de l'utilisateur temporaire...`);
      await this.temporaryUserModel.findByIdAndDelete(temporaryUser._id).exec();
      logger.log(`✅ [UsersService] Utilisateur temporaire supprimé`);

      return savedUser;
    } catch (error) {
      logger.error(`❌ [UsersService] Erreur lors de la création du compte:`, error);
      throw error;
    }
  }

  // RECHERCHE PAR EMAIL
  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email }).exec();
  }

  // RECHERCHE PAR ID
  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  // MISE À JOUR DU PROFIL
  async updateProfile(userId: string, updateUserDto: any): Promise<User | null> {
    logger.log(`📝 [UsersService] Mise à jour du profil pour l'utilisateur: ${userId}`);
    logger.log(`📋 [UsersService] Données reçues:`, {
      hasCurrentPassword: !!updateUserDto.currentPassword,
      hasNewPassword: !!updateUserDto.newPassword,
      hasConfirmPassword: !!updateUserDto.confirmPassword,
      otherFields: Object.keys(updateUserDto).filter(key => !['currentPassword', 'newPassword', 'confirmPassword', 'role'].includes(key))
    });
    
    // Ne pas permettre la modification du rôle (sécurité)
    const { role: _role, currentPassword: _currentPassword, newPassword, confirmPassword: _confirmPassword, ...safeUpdates } = updateUserDto;

    // Si un nouveau mot de passe est fourni, le hasher
    if (newPassword) {
      logger.log(`🔐 [UsersService] Nouveau mot de passe détecté - début du hachage...`);
      logger.log(`🔐 [UsersService] Longueur du nouveau mot de passe: ${newPassword.length} caractères`);
      
      try {
        // Hacher le nouveau mot de passe avec bcrypt
        const hashedNewPassword = await bcrypt.hash(newPassword, securityConfig.password.saltRounds);
        safeUpdates.password = hashedNewPassword;
        
        logger.log(`✅ [UsersService] Nouveau mot de passe hashé avec succès pour l'utilisateur: ${userId}`);
        logger.log(`🔐 [UsersService] Hash généré: ${hashedNewPassword.substring(0, 20)}...`);
      } catch (error) {
        logger.error(`❌ [UsersService] Erreur lors du hachage du mot de passe:`, error);
        throw error;
      }
    } else {
      logger.log(`ℹ️ [UsersService] Aucun nouveau mot de passe fourni - mise à jour des autres champs uniquement`);
    }

    logger.log(`💾 [UsersService] Mise à jour en base de données...`);
    logger.log(`📋 [UsersService] Champs à mettre à jour:`, Object.keys(safeUpdates));

    try {
      const updatedUser = await this.userModel
        .findByIdAndUpdate(userId, safeUpdates, { new: true })
        .exec();

      if (updatedUser) {
        logger.log(`✅ [UsersService] Profil mis à jour avec succès pour l'utilisateur: ${userId}`);
        logger.log(`📧 [UsersService] Email utilisateur: ${updatedUser.email}`);
      } else {
        logger.error(`❌ [UsersService] Aucun utilisateur trouvé avec l'ID: ${userId}`);
      }

      return updatedUser;
    } catch (error) {
      logger.error(`❌ [UsersService] Erreur lors de la mise à jour en base:`, error);
      throw error;
    }
  }

  // VALIDATION DU MOT DE PASSE
  // compare le mot de passe fourni avec le hash stocké en base
  async validatePassword(user: User, password: string): Promise<boolean> {
    logger.log(`🔍 [UsersService] Validation mot de passe pour: ${user.email}`);
    
    try {
      const isMatch = await bcrypt.compare(password, user.password);
      logger.log(`✅ [UsersService] Mot de passe ${isMatch ? 'valide' : 'invalide'} pour: ${user.email}`);
      return isMatch;
    } catch (error) {
      logger.log(`❌ [UsersService] Erreur lors de la validation du mot de passe: ${user.email}`, error.message);
      return false;
    }
  }

  // GESTION DES TENTATIVES DE CONNEXION
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

  // VÉRIFICATION DU VERROUILLAGE
  isAccountLocked(user: User): boolean {
    if (!user.lockUntil) return false;
    return user.lockUntil > new Date();
  }

  // VERROUILLAGE DU COMPTE
  async lockAccount(email: string, lockDuration: number = securityConfig.login.lockDuration): Promise<void> {
    const lockUntil = new Date(Date.now() + lockDuration * 60 * 1000);
    
    await this.userModel.updateOne(
      { email },
      { lockUntil }
    ).exec();
  }

  // MISE À JOUR DE LA DERNIÈRE CONNEXION
  async updateLastLogin(userId: string): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { lastLogin: new Date() }
    ).exec();
  }

  // GESTION DE LA DOUBLE AUTHENTIFICATION
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

    // Expiré ?
    if (!user.verificationCode || !user.verificationCodeExpires || user.verificationCodeExpires <= new Date()) {
      return false;
    }

    // Dépassement du nombre max d'essais ?
    if ((user.verificationCodeAttempts || 0) >= securityConfig.twoFactor.maxAttempts) {
      // Invalider le code
      await this.clearVerificationCode(email);
      return false;
    }

    // Vérification du code
    const isValid = user.verificationCode === code;

    if (isValid) {
      // Succès: on laisse clearVerificationCode être appelé par l'appelant pour nettoyer
      return true;
    }

    // Échec: incrémenter le compteur, et invalider si max atteint
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


  // VÉRIFICATION DU RÔLE ADMIN
  async isAdmin(userId: string): Promise<boolean> {
    const user = await this.findById(userId);
    return user?.role === UserRole.ADMIN;
  }

  // LISTE DES UTILISATEURS (admin seulement)
  async findAll(): Promise<User[]> {
    return this.userModel.find().exec();
  }

  // SUPPRESSION D'UTILISATEUR
  async remove(userId: string): Promise<User | null> {
    return this.userModel.findByIdAndDelete(userId).exec();
  }

  // VÉRIFICATION SI UN UTILISATEUR EST TEMPORAIRE
  async checkTemporaryUserStatus(email: string): Promise<{ isTemporary: boolean, timeLeft?: number }> {
    // Vérifier d'abord dans les utilisateurs permanents
    const permanentUser = await this.findByEmail(email);
    if (permanentUser) {
      return { isTemporary: false };
    }

    // Vérifier dans les utilisateurs temporaires
    const temporaryUser = await this.temporaryUserModel.findOne({ email }).exec();
    if (!temporaryUser) {
      return { isTemporary: false };
    }

    // Calculer le temps restant en millisecondes (pour plus de précision)
    const now = new Date();
    const timeLeft = Math.max(0, temporaryUser.expiresAt.getTime() - now.getTime());

    return { 
      isTemporary: true, 
      timeLeft: timeLeft 
    };
  }

  // NETTOYAGE AUTOMATIQUE DES UTILISATEURS TEMPORAIRES EXPIRÉS
  // Cette méthode peut être appelée par un cron job
  async cleanupExpiredTemporaryUsers(): Promise<number> {
    const now = new Date();
    const result = await this.temporaryUserModel.deleteMany({
      expiresAt: { $lt: now }
    }).exec();
    
    return result.deletedCount || 0;
  }

  // NETTOYAGE AUTOMATIQUE AVEC LOGS
  async cleanupExpiredTemporaryUsersWithLogs(): Promise<{ deletedCount: number, cleanedEmails: string[] }> {
    const now = new Date();
    
    // Récupérer tous les comptes expirés AVANT de les supprimer
    const expiredUsers = await this.temporaryUserModel.find({
      expiresAt: { $lt: now }
    }).exec();
    
    // Extraire les emails pour les logs
    const cleanedEmails = expiredUsers.map(user => user.email);
    
    // Supprimer tous les comptes expirés
    const result = await this.temporaryUserModel.deleteMany({
      expiresAt: { $lt: now }
    }).exec();
    
    // Log des suppressions (pour le monitoring)
    if (result.deletedCount > 0) {
      logger.log(`🧹 Nettoyage automatique : ${result.deletedCount} comptes temporaires supprimés`);
      logger.log(`📧 Emails supprimés : ${cleanedEmails.join(', ')}`);
    }
    
    return { 
      deletedCount: result.deletedCount || 0,
      cleanedEmails: cleanedEmails
    };
  }

  // GÉNÉRATION ET ENVOI DU CODE 2FA POUR ADMIN
  async generateAndSendVerificationCode(email: string): Promise<{ success: boolean, message: string }> {
    try {
      // Vérifier que l'utilisateur existe et est admin
      const user = await this.findByEmail(email);
      if (!user) {
        throw new Error('Utilisateur non trouvé');
      }
      
      if (user.role !== UserRole.ADMIN) {
        throw new Error('Accès administrateur requis pour la 2FA');
      }

      // Générer un code à 8 chiffres
      const code = this.generateSixDigitCode();
      
      // Calculer la date d'expiration (10 minutes)
      const expiresAt = new Date(Date.now() + securityConfig.twoFactor.codeExpiry * 60 * 1000);

      // Sauvegarder le code en base
      await this.updateVerificationCode(email, code, expiresAt);

      // Envoyer l'email avec le code 2FA
      await this.emailService.send2FACode(email, code);
      
      logger.log(`🔐 Code 2FA généré pour ${email} (expire dans ${securityConfig.twoFactor.codeExpiry} minutes)`);
      
      return {
        success: true,
        message: `Code 2FA envoyé à ${email}`
      };
      
    } catch (error) {
      logger.error('❌ Erreur lors de la génération du code 2FA:', error);
      return {
        success: false,
        message: error.message || 'Erreur lors de la génération du code 2FA'
      };
    }
  }

  // GÉNÉRATION D'UN CODE À 8 CHIFFRES
  private generateSixDigitCode(): string {
    // Générer de façon cryptographiquement sûre un code sur 8 chiffres (00000000 -> 99999999)
    const randomNumber = crypto.randomInt(0, 100_000_000);
    return randomNumber.toString().padStart(8, '0');
  }

  // GÉNÉRATION D'UN TOKEN DE RÉINITIALISATION DE MOT DE PASSE
  async generatePasswordResetToken(email: string): Promise<string> {
    // Vérifier le rate limiting
    const user = await this.userModel.findOne({ email }).exec();
    if (!user) {
      throw new BadRequestException('Utilisateur non trouvé');
    }

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - securityConfig.passwordReset.windowMs);
    
    // Vérifier si l'utilisateur a dépassé la limite
    if (user.passwordResetAttempts >= securityConfig.passwordReset.maxAttempts) {
      if (user.passwordResetLastAttempt && user.passwordResetLastAttempt > oneHourAgo) {
        const timeLeft = Math.ceil((user.passwordResetLastAttempt.getTime() + securityConfig.passwordReset.windowMs - now.getTime()) / (1000 * 60));
        throw new BadRequestException(`Trop de tentatives de réinitialisation. Réessayez dans ${timeLeft} minutes.`);
      } else {
        // Reset du compteur si la fenêtre de temps est dépassée
        await this.userModel.updateOne(
          { email },
          { 
            passwordResetAttempts: 0,
            passwordResetLastAttempt: null
          }
        ).exec();
      }
    }

    // Générer un token sécurisé de 32 caractères
    const resetToken = crypto.randomBytes(16).toString('hex');
    
    // Calculer la date d'expiration (1 heure)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    
    // Sauvegarder le token en base et incrémenter le compteur
    await this.userModel.updateOne(
      { email: email },
      { 
        passwordResetToken: resetToken,
        passwordResetExpires: expiresAt,
        passwordResetAttempts: (user.passwordResetAttempts || 0) + 1,
        passwordResetLastAttempt: now
      }
    ).exec();
    
    logger.log(`🔐 [UsersService] Token de réinitialisation généré pour: ${email} (tentative ${(user.passwordResetAttempts || 0) + 1}/${securityConfig.passwordReset.maxAttempts})`);
    
    return resetToken;
  }

  // ENVOI DE L'EMAIL DE RÉINITIALISATION
  async sendPasswordResetEmail(email: string, resetToken: string): Promise<boolean> {
    try {
      return await this.emailService.sendPasswordReset(email, resetToken);
    } catch (error) {
      logger.error(`❌ Erreur lors de l'envoi de l'email de réinitialisation à ${email}:`, error);
      return false;
    }
  }

  // MOT DE PASSE OUBLIÉ - DEMANDE DE RÉINITIALISATION
  // email: string : Email de l'utilisateur qui a oublié son mot de passe
  // Retourne un message de confirmation
  async forgotPassword(email: string): Promise<{ message: string }> {
    // Validation que l'email est fourni
    if (!email) {
      throw new BadRequestException('Email requis');
    }

    // Recherche de l'utilisateur par email
    const user = await this.findByEmail(email);
    
    // Vérification que l'utilisateur existe
    if (!user) {
      // Pour la sécurité, ne pas révéler si l'email existe ou non
      return { message: 'Si cet email existe dans notre base, un lien de réinitialisation a été envoyé.' };
    }

    // Générer un token de réinitialisation sécurisé
    const resetToken = await this.generatePasswordResetToken(email);
    
    // Envoyer l'email avec le lien de réinitialisation
    await this.sendPasswordResetEmail(email, resetToken);

    return { message: 'Si cet email existe dans notre base, un lien de réinitialisation a été envoyé.' };
  }

  // RÉINITIALISER MOT DE PASSE
  // token: string : Token de réinitialisation reçu par email
  // newPassword: string : Nouveau mot de passe choisi par l'utilisateur
  // Retourne un message de confirmation
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    // Validation des entrées
    if (!token || !newPassword) {
      throw new BadRequestException('Token et nouveau mot de passe requis');
    }

    // La validation de la force du mot de passe est maintenant gérée automatiquement 
    // par le ValidationPipe via les décorateurs @MinLength(8) et @Matches() dans ResetPasswordDto

    // Réinitialisation du mot de passe via le service utilisateur
    const success = await this.resetPasswordWithToken(token, newPassword);
    
    if (!success) {
      throw new UnauthorizedException('Token de réinitialisation invalide ou expiré');
    }

    return { message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.' };
  }

  // RÉINITIALISATION DU MOT DE PASSE AVEC TOKEN
  async resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
    try {
      logger.log(`🔐 [UsersService] Tentative de réinitialisation avec token: ${token.substring(0, 8)}...`);
      
      // Rechercher l'utilisateur par token et vérifier l'expiration
      const user = await this.userModel.findOne({
        passwordResetToken: token,
        passwordResetExpires: { $gt: new Date() }
      }).exec();
      
      if (!user) {
        logger.log(`❌ [UsersService] Token invalide ou expiré: ${token.substring(0, 8)}...`);
        return false; // Token invalide ou expiré
      }
      
      logger.log(`✅ [UsersService] Token valide trouvé pour: ${user.email}`);
      
      // Hasher le nouveau mot de passe
      const hashedPassword = await bcrypt.hash(newPassword, securityConfig.password.saltRounds);
      logger.log(`🔒 [UsersService] Nouveau mot de passe hashé pour: ${user.email}`);
      
      // Mettre à jour le mot de passe et supprimer le token
      await this.userModel.updateOne(
        { _id: user._id },
        { 
          password: hashedPassword,
          passwordResetToken: undefined,
          passwordResetExpires: undefined
        }
      ).exec();
      
      logger.log(`🎉 [UsersService] Mot de passe réinitialisé avec succès pour: ${user.email}`);
      logger.log(`🗑️ [UsersService] Token de réinitialisation supprimé pour: ${user.email}`);
      
      // Réinitialiser le compteur de tentatives après succès
      await this.userModel.updateOne(
        { _id: user._id },
        { 
          passwordResetAttempts: 0,
          passwordResetLastAttempt: null
        }
      ).exec();
      
      logger.log(`🔄 [UsersService] Compteur de tentatives réinitialisé pour: ${user.email}`);
      
      return true;
      
    } catch (error) {
      logger.error('❌ Erreur lors de la réinitialisation du mot de passe:', error);
      return false;
    }
  }
}
