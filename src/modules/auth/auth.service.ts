// Import des fonctionnalités NATIVES de NestJS
// Injectable : Décorateur qui permet à NestJS d'injecter ce service dans d'autres classes
// UnauthorizedException : Exception NATIVE de NestJS pour les erreurs 401 (Non autorisé)
// ForbiddenException : Exception NATIVE de NestJS pour les erreurs 403 (Accès interdit)
// BadRequestException : Exception NATIVE de NestJS pour les erreurs 400 (Requête invalide)
import { Injectable, UnauthorizedException, ForbiddenException, BadRequestException } from '@nestjs/common';

// Import du service JWT de NestJS
// JwtService : Service NATIVE de @nestjs/jwt pour créer et vérifier des JWT
import { JwtService } from '@nestjs/jwt';

// Import de notre service utilisateur
import { UsersService } from '../users/users.service';

// Import des DTOs et types
// CreateUserDto : Structure des données pour créer un utilisateur
// UserRole : Énumération des rôles (CLIENT, ADMIN)
// UserDocument : Type utilisateur avec méthodes Mongoose
import { CreateUserDto } from '../users/dto/users.dto';
import { UserRole, UserDocument } from '../users/users.schema';

// Import de notre configuration de sécurité centralisée
import { securityConfig } from '../../config/security.config';

// Décorateur Injectable : Permet à NestJS d'injecter ce service dans d'autres classes
@Injectable()
export class AuthService {
  
  // Constructeur avec injection de dépendances
  // NestJS va automatiquement créer des instances de UsersService et JwtService
  constructor(
    private usersService: UsersService,  // Service pour gérer les utilisateurs
    private jwtService: JwtService,     // Service pour gérer les JWT
  ) {}

  // VALIDATION UTILISATEUR (pour LocalStrategy)
  // Cette méthode est appelée par le LocalAuthGuard lors de la connexion
  // email: string : Email fourni par l'utilisateur
  // password: string : Mot de passe fourni par l'utilisateur
  // Promise<any> : Retourne les informations utilisateur (sans mot de passe)
  async validateUser(email: string, password: string): Promise<any> {
    console.log(`🔐 [AuthService] Tentative de validation utilisateur: ${email}`);
    
    // Validation des entrées - Vérification que les champs ne sont pas vides
    if (!email || !password) {
      console.log(`❌ [AuthService] Champs manquants - Email: ${!!email}, Password: ${!!password}`);
      // BadRequestException : Erreur 400 - La requête est mal formée
      throw new BadRequestException('Email et mot de passe requis');
    }

    // Recherche de l'utilisateur par email
    // as UserDocument : Cast TypeScript pour indiquer le type exact
    const user = await this.usersService.findByEmail(email) as UserDocument;
    
    // Vérification 1 : L'utilisateur existe-t-il ?
    if (!user) {
      console.log(`❌ [AuthService] Utilisateur non trouvé: ${email}`);
      
      // Vérifier si l'email existe dans la table temporaire (inscription en attente)
      // C'est le SEUL cas où on révèle qu'un email existe
      const userStatus = await this.usersService.checkTemporaryUserStatus(email);
      if (userStatus.isTemporary) {
        console.log(`📝 [AuthService] Utilisateur temporaire trouvé: ${email}`);
        
        // Créer un message d'erreur avec le temps restant précis
        let errorMessage = 'Un compte avec cet email est en attente de validation. Veuillez vérifier votre boîte mail pour confirmer votre compte.';
        
        if (userStatus.timeLeft !== undefined) {
          if (userStatus.timeLeft === 0) {
            errorMessage += ' Le délai de validation a expiré. Veuillez vous réinscrire.';
          } else {
            // Calculer le temps restant en heures et minutes
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
      console.log(`❌ [AuthService] Aucun compte trouvé (permanent ou temporaire): ${email}`);
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    console.log(`✅ [AuthService] Utilisateur trouvé: ${email} (Rôle: ${user.role})`);

    // Vérification 2 : Le compte est-il verrouillé ?
    // this.usersService.isAccountLocked() : Vérifie si le compte est temporairement verrouillé
    if (this.usersService.isAccountLocked(user)) {
      console.log(`🔒 [AuthService] Compte verrouillé: ${email}`);
      
      // Calculer le temps restant de blocage
      const lockUntil = user.lockUntil;
      if (lockUntil) {
        const now = new Date();
        const timeRemaining = lockUntil.getTime() - now.getTime();
        const minutesRemaining = Math.ceil(timeRemaining / (1000 * 60));
        
        if (minutesRemaining > 0) {
          throw new UnauthorizedException(`Compte temporairement verrouillé. Déverrouillage dans ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}.`);
        }
      }
      
      // Si pas de date de verrouillage ou déjà expirée
      throw new UnauthorizedException('Compte temporairement verrouillé');
    }

    // Vérification 3 : Le mot de passe est-il correct ?
    // this.usersService.validatePassword() : Compare le mot de passe avec le hash en base
    const isPasswordValid = await this.usersService.validatePassword(user, password);
    
    // Si le mot de passe est incorrect
    if (!isPasswordValid) {
      console.log(`❌ [AuthService] Mot de passe incorrect: ${email}`);
      // Incrémenter les tentatives échouées
      await this.usersService.incrementFailedAttempts(email);
      
      // Récupérer l'utilisateur mis à jour pour avoir le bon nombre de tentatives
      const updatedUser = await this.usersService.findByEmail(email);
      
      // Verrouiller le compte après le nombre de tentatives configuré
      // securityConfig.login.lockThreshold : Nombre de tentatives depuis la config centralisée
      if (updatedUser.failedLoginAttempts >= securityConfig.login.lockThreshold) {
        // Verrouiller le compte pendant la durée configurée
        // securityConfig.login.lockDuration : Durée depuis la config centralisée
        console.log(`🔒 [AuthService] Verrouillage du compte: ${email} (${updatedUser.failedLoginAttempts} tentatives échouées)`);
        await this.usersService.lockAccount(email, securityConfig.login.lockDuration);
        
        // Calculer le temps restant de blocage
        const lockUntil = new Date(Date.now() + securityConfig.login.lockDuration * 60 * 1000);
        const minutesRemaining = Math.ceil((lockUntil.getTime() - Date.now()) / (1000 * 60));
        
        throw new UnauthorizedException(`Compte verrouillé après trop de tentatives échouées. Déverrouillage dans ${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''}.`);
      }
      
      // Calculer le nombre d'essais restants
      const remainingAttempts = securityConfig.login.lockThreshold - updatedUser.failedLoginAttempts;
      
      // Créer une exception avec les informations sur les tentatives restantes
      const errorMessage = `Email ou mot de passe incorrect. Il vous reste ${remainingAttempts} tentative${remainingAttempts > 1 ? 's' : ''}.`;
      const error = new UnauthorizedException(errorMessage);
      (error as any).remainingAttempts = remainingAttempts;
      (error as any).failedAttempts = updatedUser.failedLoginAttempts;
      throw error;
    }

    console.log(`✅ [AuthService] Mot de passe validé: ${email}`);

    // Si le mot de passe est correct, réinitialiser les tentatives échouées
    await this.usersService.resetFailedAttempts(email);
    
    // Mettre à jour la date de dernière connexion
    await this.usersService.updateLastLogin(user._id.toString());

    // VÉRIFICATION 2FA AUTOMATIQUE POUR LES ADMINS
    if (user.role === UserRole.ADMIN) {
      console.log(`🔐 [AuthService] Utilisateur admin détecté, génération 2FA: ${email}`);
      // Générer et envoyer le code 2FA automatiquement
      const twoFAResult = await this.usersService.generateAndSendVerificationCode(email);
      
      if (!twoFAResult.success) {
        console.log(`❌ [AuthService] Erreur génération 2FA: ${email}`);
        throw new UnauthorizedException('Erreur lors de la génération du code 2FA');
      }
      
      // Retourner un objet spécial indiquant que la 2FA est requise
      const userObj = user.toObject();
      const { password: _, ...result } = userObj;
      return {
        ...result,
        requires2FA: true,
        message: 'Code 2FA envoyé par email. Veuillez le saisir pour finaliser la connexion.'
      };
    }

    console.log(`✅ [AuthService] Validation réussie (utilisateur normal): ${email}`);
    // Retourner l'utilisateur sans le mot de passe (sécurité)
    // user.toObject() : Convertit le document Mongoose en objet JavaScript simple
    // const { password: _, ...result } : Destructuration pour supprimer le mot de passe
    // password: _ : Renomme password en _ (convention pour "non utilisé")
    // ...result : Récupère toutes les autres propriétés
    const userObj = user.toObject();
    const { password: _, ...result } = userObj;
    return result;
  }

  // CONNEXION UTILISATEUR
  // Cette méthode est appelée après validation réussie par LocalAuthGuard
  // user: UserDocument : Utilisateur validé (sans mot de passe)
  // Retourne les tokens JWT et les informations utilisateur
  login(user: UserDocument) {
    console.log(`🚀 [AuthService] Génération des tokens JWT pour: ${user.email}`);
    
    // Création du payload pour le JWT d'accès
    // Le payload contient les informations qui seront encodées dans le token
    const payload = { 
      email: user.email,                    // Email de l'utilisateur
      sub: user._id.toString(),             // ID MongoDB (subject du JWT)
      role: user.role,                      // Rôle de l'utilisateur
    };

    console.log(`📝 [AuthService] Payload JWT créé:`, { email: user.email, role: user.role, sub: user._id.toString() });

    // Génération du JWT d'accès avec la configuration centralisée
    // securityConfig.jwt.accessTokenExpiry : Durée depuis la config (15m)
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: securityConfig.jwt.accessTokenExpiry
    });

    console.log(`🔑 [AuthService] Access token généré (expire dans ${securityConfig.jwt.accessTokenExpiry})`);

    // Génération du refresh token avec la configuration centralisée
    // securityConfig.jwt.refreshTokenExpiry : Durée depuis la config (7d)
    const refreshToken = this.jwtService.sign(
      { 
        sub: user._id.toString(),           // ID de l'utilisateur
        type: 'refresh',                    // Type de token (pour distinguer access/refresh)
      },
      { expiresIn: securityConfig.jwt.refreshTokenExpiry }
    );

    console.log(`🔄 [AuthService] Refresh token généré (expire dans ${securityConfig.jwt.refreshTokenExpiry})`);

    // Retourne les tokens et informations utilisateur
    const result = {
      access_token: accessToken,        // Token d'accès (15 minutes)
      refresh_token: refreshToken,      // Token de renouvellement (7 jours)
      expires_in: 15 * 60,             // Durée de vie en secondes (15 minutes)
      user: {
        id: user._id.toString(),        // ID de l'utilisateur
        email: user.email,              // Email
        firstName: user.firstName,      // Prénom
        lastName: user.lastName,        // Nom
        role: user.role,                // Rôle
        isEmailVerified: user.isEmailVerified, // Email vérifié ou non
      }
    };

    console.log(`✅ [AuthService] Connexion réussie pour: ${user.email} (Rôle: ${user.role})`);
    return result;
  }

  // INSCRIPTION UTILISATEUR
  // createUserDto: CreateUserDto : Données validées pour créer un utilisateur
  // Retourne l'utilisateur créé (sans mot de passe)
  async register(createUserDto: CreateUserDto) {
    console.log('📝 [AuthService] Tentative d\'inscription avec données:', {
      email: createUserDto.email,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      phone: createUserDto.phone,
      address: createUserDto.address,
      city: createUserDto.city,
      postalCode: createUserDto.postalCode,
      country: createUserDto.country,
      hasPassword: !!createUserDto.password,
      passwordLength: createUserDto.password?.length
    });

    // Validation des entrées - Vérification que les champs obligatoires sont présents
    if (!createUserDto.email || !createUserDto.password) {
      console.log('❌ [AuthService] Champs de base manquants:', {
        hasEmail: !!createUserDto.email,
        hasPassword: !!createUserDto.password
      });
      throw new BadRequestException('Email et mot de passe requis');
    }

    // Vérification des champs de contact requis
    const missingFields = [];
    if (!createUserDto.phone) missingFields.push('téléphone');
    if (!createUserDto.address) missingFields.push('adresse');
    if (!createUserDto.city) missingFields.push('ville');
    if (!createUserDto.postalCode) missingFields.push('code postal');
    if (!createUserDto.country) missingFields.push('pays');

    if (missingFields.length > 0) {
      console.log('❌ [AuthService] Champs de contact manquants:', missingFields);
      throw new BadRequestException(`Champs manquants : ${missingFields.join(', ')}`);
    }

    // La validation du mot de passe est maintenant gérée automatiquement par le ValidationPipe
    // via les décorateurs @MinLength(8) et @Matches() dans CreateUserDto

    console.log('✅ [AuthService] Validation des données réussie, création de l\'utilisateur...');

    // Vérification si l'email existe déjà
    // this.usersService.findByEmail() : Recherche en base de données
    const existingUser = await this.usersService.findByEmail(createUserDto.email);
    if (existingUser) {
      console.log('❌ [AuthService] Email déjà utilisé:', createUserDto.email);
      // ForbiddenException : Erreur 403 - L'email est déjà utilisé
      throw new ForbiddenException('Un utilisateur avec cet email existe déjà');
    }

    // Création de l'utilisateur (toujours en tant que CLIENT pour la sécurité)
    // this.usersService.prepareRegistration() : Prépare l'inscription avec validation email
    const registrationResult = await this.usersService.prepareRegistration(createUserDto);
    
    console.log('✅ [AuthService] Inscription préparée avec succès pour:', createUserDto.email);
    
    // Note: L'utilisateur n'est pas encore créé, il faut valider l'email d'abord
    // Retourner le résultat de la préparation
    return {
      message: 'Inscription préparée. Veuillez vérifier votre email pour activer votre compte.',
      email: registrationResult.email,
      requiresEmailValidation: true
    };

    // L'utilisateur n'est pas encore créé, il faut valider l'email d'abord
  }

  // RÉFRESH DU TOKEN
  // refreshToken: string : Token de renouvellement fourni par le client
  // Retourne un nouveau token d'accès
  async refreshToken(refreshToken: string) {
    // Validation que le refresh token est fourni
    if (!refreshToken) {
      throw new BadRequestException('Token de refresh requis');
    }

    try {
      // Vérification du refresh token
      // this.jwtService.verify() : Décode et vérifie la validité du token
      const payload = this.jwtService.verify(refreshToken);
      
      // Vérification que c'est bien un token de refresh
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Token de refresh invalide');
      }

      // Récupération de l'utilisateur depuis la base de données
      // payload.sub : ID de l'utilisateur extrait du token
      const user = await this.usersService.findById(payload.sub) as UserDocument;
      if (!user) {
        throw new UnauthorizedException('Utilisateur non trouvé');
      }

      // Vérification que le compte existe toujours
      // Note: isActive a été supprimé, on vérifie juste l'existence

      // Génération d'un nouveau JWT d'accès
      const newPayload = { 
        email: user.email,                    // Email de l'utilisateur
        sub: user._id.toString(),             // ID MongoDB
        role: user.role,                      // Rôle
        // Pas de iat ni exp - le JWT service s'en charge automatiquement
      };
      
      // Création du nouveau token (le JWT service gère automatiquement l'expiration)
      const newAccessToken = this.jwtService.sign(newPayload);

      // Retourne le nouveau token et les informations utilisateur
      return {
        access_token: newAccessToken,    // Nouveau token d'accès
        expires_in: 15 * 60,            // Durée de vie en secondes
        user: {
          id: user._id.toString(),      // ID de l'utilisateur
          email: user.email,            // Email
          firstName: user.firstName,    // Prénom
          lastName: user.lastName,      // Nom
          role: user.role,              // Rôle
          isEmailVerified: user.isEmailVerified, // Email vérifié
        }
      };
    } catch (error) {
      // Gestion des erreurs de vérification du token
      if (error instanceof UnauthorizedException) {
        // Si c'est déjà une UnauthorizedException, la relancer
        throw error;
      }
      // Sinon, créer une nouvelle UnauthorizedException
      throw new UnauthorizedException('Token de refresh invalide');
    }
  }


  // VÉRIFICATION DU CODE (pour admin)
  // email: string : Email de l'administrateur
  // code: string : Code de vérification saisi
  // Retourne true si le code est valide, false sinon
  async verifyCode(email: string, code: string): Promise<boolean> {
    // Validation des entrées
    if (!email || !code) {
      throw new BadRequestException('Email et code requis');
    }

    // Vérification du code via le service utilisateur
    const isValid = await this.usersService.verifyCode(email, code);
    
    if (isValid) {
      // Supprimer le code utilisé (sécurité)
      await this.usersService.clearVerificationCode(email);
    }

    return isValid;
  }

  // FINALISATION DE LA CONNEXION ADMIN AVEC 2FA
  // email: string : Email de l'administrateur
  // code: string : Code 2FA saisi
  // Retourne les tokens JWT après validation 2FA réussie
  async finalizeAdminLogin(email: string, code: string): Promise<any> {
    // Vérifier le code 2FA
    const isCodeValid = await this.verifyCode(email, code);
    
    if (!isCodeValid) {
      throw new UnauthorizedException('Code 2FA invalide ou expiré');
    }

    // Récupérer l'utilisateur admin
    const user = await this.usersService.findByEmail(email);
    if (!user || user.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Accès administrateur requis');
    }

    // Générer les tokens JWT (connexion réussie)
    return this.login(user as UserDocument);
  }


  // DÉCONNEXION
  // Retourne un message de confirmation
  // Note : Cette méthode pourrait être étendue pour invalider les tokens
  logout(): { message: string } {
    // TODO: Ajouter le token à une liste noire si nécessaire
    // Pour l'instant, retourne juste un message de succès
    return { message: 'Déconnexion réussie' };
  }

  // VALIDATION EMAIL (depuis lien reçu par email) -> création compte définitif + connexion automatique
  async validateEmail(token: string): Promise<{ message: string; user: any; access_token: string; refresh_token: string }> {
    console.log(`🔐 [AuthService] Tentative de validation email avec token: ${token.substring(0, 8)}...`);
    
    if (!token) {
      throw new BadRequestException('Token requis');
    }

    try {
      console.log(`📝 [AuthService] Création du compte après validation email...`);
      const user = await this.usersService.createAccountAfterEmailValidation(token);
      console.log(`✅ [AuthService] Compte créé avec succès: ${user.email}`);
      
      // Connexion automatique après validation
      console.log(`🔑 [AuthService] Génération des tokens de connexion...`);
      const loginResult = this.login(user as UserDocument);
      console.log(`✅ [AuthService] Tokens générés avec succès pour: ${user.email}`);
      
      return { 
        message: 'Email validé avec succès. Votre compte a été créé et vous êtes maintenant connecté.',
        user: loginResult.user,
        access_token: loginResult.access_token,
        refresh_token: loginResult.refresh_token
      };
    } catch (error) {
      console.error(`❌ [AuthService] Erreur lors de la validation email:`, error);
      throw error; // Remonter l'erreur pour que le contrôleur puisse la gérer
    }
  }

  // RÉCUPÉRER PROFIL UTILISATEUR COMPLET
  // Cette méthode récupère toutes les informations de l'utilisateur depuis la base de données
  // userId: string : ID de l'utilisateur
  // Promise<any> : Retourne l'utilisateur complet (sans mot de passe)
  async getUserProfile(userId: string): Promise<any> {
    console.log(`👤 [AuthService] Récupération du profil utilisateur: ${userId}`);
    
    try {
      // Récupérer l'utilisateur depuis la base de données
      const user = await this.usersService.findById(userId) as UserDocument;
      
      if (!user) {
        console.log(`❌ [AuthService] Utilisateur non trouvé: ${userId}`);
        throw new UnauthorizedException('Utilisateur non trouvé');
      }

      console.log(`✅ [AuthService] Profil utilisateur récupéré: ${user.email}`);
      
      // Retourner l'utilisateur (sans le mot de passe)
      const userObj = user.toObject();
      const { password: _, ...result } = userObj;
      return result;
    } catch (error) {
      console.error(`❌ [AuthService] Erreur lors de la récupération du profil:`, error);
      throw error;
    }
  }
}
