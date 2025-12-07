/* eslint-disable @typescript-eslint/unbound-method */
// "Dans ce fichier, ignore les avertissements sur les méthodes non liées"
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { EmailService } from '../email/email.service';
import { UnauthorizedException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('AuthService - Tests Unitaires', () => {
  let authService: AuthService;
  let usersService: UsersService;
  let jwtService: JwtService;
  let emailService: EmailService;

  // Je configure les mocks des dépendances avant chaque test
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          // Je mock UsersService (pas la vraie classe)
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            validatePassword: jest.fn(),
            incrementFailedAttempts: jest.fn(),
            resetFailedAttempts: jest.fn(),
            updateLastLogin: jest.fn(),
            isAccountLocked: jest.fn(),
            prepareRegistration: jest.fn(),
            checkTemporaryUserStatus: jest.fn(),
            createAccountAfterEmailValidation: jest.fn(),
            generateAndSendVerificationCode: jest.fn(),
            verifyCode: jest.fn(),
            clearVerificationCode: jest.fn(),
          },
        },
        {
          // Je mock JwtService
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn(),
          },
        },
        {
          // Je mock EmailService
          provide: EmailService,
          useValue: {
            verifyRecaptcha: jest.fn(),
            send2FACode: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    usersService = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
    emailService = module.get<EmailService>(EmailService);
  });

  describe('validateUser()', () => {
    it('OK devrait retourner l\'utilisateur sans mot de passe si credentials valides', async () => {
      // ARRANGE : Je prépare les données de test
      const mockUser = {
        _id: '123',
        email: 'test@example.com',
        password: 'hashedPassword',
        firstName: 'Test',
        lastName: 'User',
        role: 'client',
        toObject: jest.fn().mockReturnValue({
          _id: '123',
          email: 'test@example.com',
          password: 'hashedPassword',
          firstName: 'Test',
          lastName: 'User',
          role: 'client',
        }),
      };

      // Je configure les mocks pour retourner les bonnes valeurs
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser as any);
      jest.spyOn(usersService, 'isAccountLocked').mockReturnValue(false);
      jest.spyOn(usersService, 'validatePassword').mockResolvedValue(true);
      jest.spyOn(usersService, 'resetFailedAttempts').mockResolvedValue(undefined);
      jest.spyOn(usersService, 'updateLastLogin').mockResolvedValue(undefined);

      // ACT : J'exécute la méthode à tester
      const result = await authService.validateUser('test@example.com', 'correctPassword');

      // ASSERT : Je vérifie les résultats
      expect(result).toBeDefined();
      expect(result.email).toBe('test@example.com');
      expect(result.password).toBeUndefined(); // Mot de passe supprimé
      expect(usersService.resetFailedAttempts).toHaveBeenCalledWith('test@example.com');
      expect(usersService.updateLastLogin).toHaveBeenCalledWith('123');
    });

    it('ERREUR devrait lancer UnauthorizedException si email n\'existe pas', async () => {
      // ARRANGE
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(usersService, 'checkTemporaryUserStatus').mockResolvedValue({
        isTemporary: false,
      });

      // ACT & ASSERT
      await expect(
        authService.validateUser('inexistant@example.com', 'password123')
      ).rejects.toThrow(UnauthorizedException);
    });

    it('ERREUR devrait lancer UnauthorizedException si compte verrouillé', async () => {
      // ARRANGE
      const mockUser = {
        _id: '123',
        email: 'test@example.com',
        lockUntil: new Date(Date.now() + 15 * 60 * 1000), // Verrouillé pour 15 min
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser as any);
      jest.spyOn(usersService, 'isAccountLocked').mockReturnValue(true);

      // ACT & ASSERT
      await expect(
        authService.validateUser('test@example.com', 'password123')
      ).rejects.toThrow(UnauthorizedException);
      
      // Je vérifie que le message contient "verrouillé"
      await expect(
        authService.validateUser('test@example.com', 'password123')
      ).rejects.toThrow(/verrouillé/i);
    });

    it('ERREUR devrait incrémenter les tentatives échouées si mot de passe incorrect', async () => {
      // ARRANGE
      const mockUser = {
        _id: '123',
        email: 'test@example.com',
        password: 'hashedPassword',
        failedLoginAttempts: 2,
        toObject: jest.fn(),
      };

      jest.spyOn(usersService, 'findByEmail')
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce({ ...mockUser, failedLoginAttempts: 3 } as any);
      jest.spyOn(usersService, 'isAccountLocked').mockReturnValue(false);
      jest.spyOn(usersService, 'validatePassword').mockResolvedValue(false);
      jest.spyOn(usersService, 'incrementFailedAttempts').mockResolvedValue(undefined);

      // ACT & ASSERT
      await expect(
        authService.validateUser('test@example.com', 'wrongPassword')
      ).rejects.toThrow(UnauthorizedException);

      // Je vérifie que incrementFailedAttempts a été appelé
      expect(usersService.incrementFailedAttempts).toHaveBeenCalledWith('test@example.com');
    });

    it('SECURITE devrait générer un code 2FA pour les admins', async () => {
      // ARRANGE
      const mockAdmin = {
        _id: '123',
        email: 'admin@example.com',
        password: 'hashedPassword',
        role: 'admin', // Admin
        toObject: jest.fn().mockReturnValue({
          _id: '123',
          email: 'admin@example.com',
          role: 'admin',
        }),
      };

      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockAdmin as any);
      jest.spyOn(usersService, 'isAccountLocked').mockReturnValue(false);
      jest.spyOn(usersService, 'validatePassword').mockResolvedValue(true);
      jest.spyOn(usersService, 'resetFailedAttempts').mockResolvedValue(undefined);
      jest.spyOn(usersService, 'updateLastLogin').mockResolvedValue(undefined);
      jest.spyOn(usersService, 'generateAndSendVerificationCode').mockResolvedValue({
        success: true,
        message: 'Code envoyé',
      });

      // ACT
      const result = await authService.validateUser('admin@example.com', 'correctPassword');

      // ASSERT
      expect(result.requires2FA).toBe(true); // 2FA requise
      expect(usersService.generateAndSendVerificationCode).toHaveBeenCalledWith('admin@example.com');
    });
  });

  describe('register()', () => {
    it('OK devrait créer un utilisateur temporaire avec reCAPTCHA valide', async () => {
      // ARRANGE
      const createUserDto = {
        email: 'new@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
        phone: '0612345678',
        address: '123 rue Test',
        city: 'Paris',
        postalCode: '75001',
        country: 'France',
        token: 'recaptcha_token',
      };

      jest.spyOn(emailService, 'verifyRecaptcha').mockResolvedValue(true);
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue(null);
      jest.spyOn(usersService, 'prepareRegistration').mockResolvedValue({
        email: 'new@example.com',
        verificationToken: 'token123',
      } as any);

      // ACT
      const result = await authService.register(createUserDto);

      // ASSERT
      expect(result.requiresEmailValidation).toBe(true);
      expect(emailService.verifyRecaptcha).toHaveBeenCalledWith('recaptcha_token');
      expect(usersService.prepareRegistration).toHaveBeenCalled();
    });

    it('ERREUR devrait rejeter si reCAPTCHA invalide', async () => {
      // ARRANGE
      const createUserDto = {
        email: 'new@example.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
        phone: '0612345678',
        address: '123 rue Test',
        city: 'Paris',
        postalCode: '75001',
        country: 'France',
        token: 'invalid_recaptcha_token',
      };

      jest.spyOn(emailService, 'verifyRecaptcha').mockResolvedValue(false); // reCAPTCHA invalide

      // ACT & ASSERT
      await expect(authService.register(createUserDto)).rejects.toThrow(BadRequestException);
      await expect(authService.register(createUserDto)).rejects.toThrow(/reCAPTCHA/i);
    });

    it('ERREUR devrait rejeter si email déjà existant', async () => {
      // ARRANGE
      const createUserDto = {
        email: 'existing@example.com',
        password: 'Password123!',
        firstName: 'Test',
        lastName: 'User',
        phone: '0612345678',
        address: '123 rue Test',
        city: 'Paris',
        postalCode: '75001',
        country: 'France',
        token: 'recaptcha_token',
      };

      jest.spyOn(emailService, 'verifyRecaptcha').mockResolvedValue(true);
      jest.spyOn(usersService, 'findByEmail').mockResolvedValue({ email: 'existing@example.com' } as any);

      // ACT & ASSERT
      await expect(authService.register(createUserDto)).rejects.toThrow(ForbiddenException);
      await expect(authService.register(createUserDto)).rejects.toThrow(/existe déjà/i);
    });
  });

  describe('login()', () => {
    it('OK devrait générer des tokens JWT valides', () => {
      // ARRANGE
      const mockUser = {
        _id: '123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'client',
        isEmailVerified: true,
      };

      jest.spyOn(jwtService, 'sign')
        .mockReturnValueOnce('access_token_123')
        .mockReturnValueOnce('refresh_token_123');

      // ACT
      const result = authService.login(mockUser as any);

      // ASSERT
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.access_token).toBe('access_token_123');
      expect(result.refresh_token).toBe('refresh_token_123');
      expect(result.expires_in).toBe(15 * 60); // 15 minutes
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('OK devrait retourner les informations utilisateur correctes', () => {
      // ARRANGE
      const mockUser = {
        _id: '123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'admin',
        isEmailVerified: true,
      };

      jest.spyOn(jwtService, 'sign').mockReturnValue('token');

      // ACT
      const result = authService.login(mockUser as any);

      // ASSERT
      expect(result.user).toEqual({
        id: '123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'admin',
        isEmailVerified: true,
      });
    });
  });

  describe('refreshToken()', () => {
    it('OK devrait générer un nouveau access token avec un refresh token valide', async () => {
      // ARRANGE
      const mockUser = {
        _id: '123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'client',
        isEmailVerified: true,
      };

      const mockPayload = {
        sub: '123',
        type: 'refresh',
      };

      jest.spyOn(jwtService, 'verify').mockReturnValue(mockPayload);
      jest.spyOn(usersService, 'findById').mockResolvedValue(mockUser as any);
      jest.spyOn(jwtService, 'sign').mockReturnValue('new_access_token');

      // ACT
      const result = await authService.refreshToken('valid_refresh_token');

      // ASSERT
      expect(result.access_token).toBe('new_access_token');
      expect(result.user.email).toBe('test@example.com');
      expect(jwtService.verify).toHaveBeenCalledWith('valid_refresh_token');
    });

    it('ERREUR devrait rejeter un refresh token invalide', async () => {
      // ARRANGE
      jest.spyOn(jwtService, 'verify').mockImplementation(() => {
        throw new Error('Token invalide');
      });

      // ACT & ASSERT
      await expect(authService.refreshToken('invalid_token')).rejects.toThrow(UnauthorizedException);
    });

    it('ERREUR devrait rejeter un refresh token sans type "refresh"', async () => {
      // ARRANGE
      jest.spyOn(jwtService, 'verify').mockReturnValue({
        sub: '123',
        type: 'access', // Mauvais type
      });

      // ACT & ASSERT
      await expect(authService.refreshToken('wrong_type_token')).rejects.toThrow(UnauthorizedException);
    });
  });
});

