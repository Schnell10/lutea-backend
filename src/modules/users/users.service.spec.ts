import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getModelToken } from '@nestjs/mongoose';
import { User, TemporaryUser } from './users.schema';
import { EmailService } from '../email/email.service';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock de bcrypt
jest.mock('bcrypt');

describe('UsersService - Tests Unitaires', () => {
  let service: UsersService;
  let mockUserModel: any;
  let mockTemporaryUserModel: any;
  let mockEmailService: any;

  beforeEach(async () => {
    // Mock complet du modèle User avec support du constructeur
    const mockUserInstance = {
      save: jest.fn().mockResolvedValue({
        _id: 'user123',
        email: 'test@example.com',
        firstName: 'Jean',
        lastName: 'Dupont',
      }),
    };

    mockUserModel = jest.fn(() => mockUserInstance);
    mockUserModel.findOne = jest.fn();
    mockUserModel.findById = jest.fn();
    mockUserModel.findByIdAndUpdate = jest.fn();
    mockUserModel.findByIdAndDelete = jest.fn();

    // Mock complet du modèle TemporaryUser avec support du constructeur
    const mockTempUserInstance = {
      save: jest.fn().mockResolvedValue({
        _id: 'temp123',
        email: 'test@example.com',
        validationToken: 'token123',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }),
    };

    mockTemporaryUserModel = jest.fn(() => mockTempUserInstance);
    mockTemporaryUserModel.findOne = jest.fn().mockReturnValue({
      exec: jest.fn(),
    });
    mockTemporaryUserModel.findByIdAndDelete = jest.fn();

    // Mock du service Email
    mockEmailService = {
      sendRegistrationValidation: jest.fn().mockResolvedValue(true),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(TemporaryUser.name),
          useValue: mockTemporaryUserModel,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // TESTS : Préparation de l'inscription
  // ==========================================
  describe('prepareRegistration()', () => {
    it('✅ devrait créer un utilisateur temporaire et envoyer un email', async () => {
      // ARRANGE
      const createUserDto = {
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
        phone: '0612345678',
        address: '123 rue Test',
        city: 'Paris',
        postalCode: '75001',
        country: 'France',
      };

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null), // L'email n'existe pas
      });

      mockTemporaryUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null), // Pas d'utilisateur temporaire
      });

      (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

      // ACT
      const result = await service.prepareRegistration(createUserDto);

      // ASSERT
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(result).toHaveProperty('verificationToken');
      expect(mockEmailService.sendRegistrationValidation).toHaveBeenCalled();
    });

    it('❌ devrait lancer une erreur si l\'email existe déjà', async () => {
      // ARRANGE
      const createUserDto = {
        email: 'existing@example.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
        phone: '0612345678',
        address: '123 rue Test',
        city: 'Paris',
        postalCode: '75001',
        country: 'France',
      };

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ email: 'existing@example.com' }),
      });

      // ACT & ASSERT
      await expect(service.prepareRegistration(createUserDto))
        .rejects
        .toThrow(BadRequestException);
    });
  });

  // ==========================================
  // TESTS : Création de compte après validation
  // ==========================================
  describe('createAccountAfterEmailValidation()', () => {
    it('✅ devrait créer un compte permanent après validation', async () => {
      // ARRANGE
      const validationToken = 'valid-token-123';
      const mockTempUser = {
        _id: 'temp123',
        email: 'test@example.com',
        password: 'hashedPassword',
        firstName: 'Jean',
        lastName: 'Dupont',
        phone: '0612345678',
        address: '123 rue Test',
        city: 'Paris',
        postalCode: '75001',
        country: 'France',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // Expire dans 24h
        validationToken,
      };

      mockTemporaryUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTempUser),
      });

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null), // L'email n'existe pas encore dans users
      });

      mockTemporaryUserModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockTempUser),
      });

      // ACT
      const result = await service.createAccountAfterEmailValidation(validationToken);

      // ASSERT
      expect(result).toHaveProperty('email', 'test@example.com');
      expect(mockTemporaryUserModel.findByIdAndDelete).toHaveBeenCalledWith('temp123');
    });

    it('❌ devrait lancer une erreur si le token est invalide', async () => {
      // ARRANGE
      mockTemporaryUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null), // Token introuvable
      });

      // ACT & ASSERT
      await expect(service.createAccountAfterEmailValidation('invalid-token'))
        .rejects
        .toThrow(BadRequestException);
    });

    it('❌ devrait lancer une erreur si le token est expiré', async () => {
      // ARRANGE
      const expiredTempUser = {
        _id: 'temp123',
        email: 'test@example.com',
        validationToken: 'expired-token',
        expiresAt: new Date(Date.now() - 1000), // Expiré il y a 1 seconde
      };

      mockTemporaryUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(expiredTempUser),
      });

      mockTemporaryUserModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(expiredTempUser),
      });

      // ACT & ASSERT
      await expect(service.createAccountAfterEmailValidation('expired-token'))
        .rejects
        .toThrow(BadRequestException);
    });
  });

  // ==========================================
  // TESTS : Recherche d'utilisateur par email
  // ==========================================
  describe('findByEmail()', () => {
    it('✅ devrait trouver un utilisateur par email', async () => {
      // ARRANGE
      const mockUser = {
        _id: 'user123',
        email: 'test@example.com',
        firstName: 'Jean',
        lastName: 'Dupont',
      };

      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockUser),
      });

      // ACT
      const result = await service.findByEmail('test@example.com');

      // ASSERT
      expect(result).toEqual(mockUser);
      expect(mockUserModel.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
    });

    it('✅ devrait retourner null si l\'utilisateur n\'existe pas', async () => {
      // ARRANGE
      mockUserModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      // ACT
      const result = await service.findByEmail('inexistant@example.com');

      // ASSERT
      expect(result).toBeNull();
    });
  });
});
