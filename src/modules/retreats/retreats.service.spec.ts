import { Test, TestingModule } from '@nestjs/testing';
import { RetreatsService } from './retreats.service';
import { getModelToken } from '@nestjs/mongoose';
import { Retreat } from './retreats.schema';
import { Booking } from '../bookings/bookings.schema';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';

describe('RetreatsService - Tests Unitaires', () => {
  let service: RetreatsService;
  let mockRetreatModel: any;
  let mockBookingModel: any;

  beforeEach(async () => {
    // Mock complet du modèle Retreat avec support du constructeur
    const mockRetreatInstance = {
      save: jest.fn().mockResolvedValue({
        _id: new Types.ObjectId(),
        titreCard: 'Retraite Yoga',
        imageCard: 'https://example.com/image.jpg',
        altImageCard: 'Image de yoga',
        imageModal: ['https://example.com/modal1.jpg'],
        altImageModal: ['Alt modal 1'],
        texteModal: 'Description complète',
        dates: [],
      }),
    };

    mockRetreatModel = jest.fn(() => mockRetreatInstance);
    mockRetreatModel.find = jest.fn();
    mockRetreatModel.findById = jest.fn();
    mockRetreatModel.findByIdAndUpdate = jest.fn();
    mockRetreatModel.findByIdAndDelete = jest.fn();
    mockRetreatModel.countDocuments = jest.fn();

    // Mock du modèle Booking (requis par RetreatsService)
    mockBookingModel = {
      find: jest.fn(),
      countDocuments: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetreatsService,
        {
          provide: getModelToken(Retreat.name),
          useValue: mockRetreatModel,
        },
        {
          provide: getModelToken(Booking.name),
          useValue: mockBookingModel,
        },
      ],
    }).compile();

    service = module.get<RetreatsService>(RetreatsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // TESTS : Création de retraite
  // ==========================================
  describe('create()', () => {
    it('OK devrait créer une retraite avec succès', async () => {
      // ARRANGE
      const createRetreatDto = {
        titreCard: 'Retraite Yoga',
        imageCard: 'https://example.com/image.jpg',
        altImageCard: 'Image de yoga',
        imageModal: ['https://example.com/modal1.jpg'],
        altImageModal: ['Alt modal 1'],
        texteModal: 'Description complète de la retraite',
        dates: [{
          start: '2024-06-01',
          end: '2024-06-05',
          prix: 500,
          places: 10,
          adresseRdv: 'Test Address'
        }],
      };

      // ACT
      const result = await service.create(createRetreatDto);

      // ASSERT
      expect(result).toHaveProperty('_id');
      expect(result.titreCard).toBe('Retraite Yoga');
      expect(mockRetreatModel).toHaveBeenCalled();
    });
  });

  // ==========================================
  // TESTS : Mise à jour de retraite
  // ==========================================
  describe('update()', () => {
    it('OK devrait mettre à jour une retraite avec succès', async () => {
      // ARRANGE
      const retreatId = new Types.ObjectId().toString();
      const updateData = {
        titreCard: 'Retraite Yoga Mise à jour',
        texteModal: 'Nouvelle description',
      };

      const updatedRetreat = {
        _id: retreatId,
        ...updateData,
      };

      mockRetreatModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(updatedRetreat),
      });

      // ACT
      const result = await service.update(retreatId, updateData);

      // ASSERT
      expect(result.titreCard).toBe('Retraite Yoga Mise à jour');
      expect(result.texteModal).toBe('Nouvelle description');
      expect(mockRetreatModel.findByIdAndUpdate).toHaveBeenCalledWith(
        retreatId,
        updateData,
        { new: true, runValidators: true }
      );
    });

    it('ERREUR devrait lancer une exception si la retraite n\'existe pas', async () => {
      // ARRANGE
      const retreatId = new Types.ObjectId().toString();

      mockRetreatModel.findByIdAndUpdate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      // ACT & ASSERT
      await expect(service.update(retreatId, { titreCard: 'Test' }))
        .rejects
        .toThrow(NotFoundException);
    });

    it('ERREUR devrait lancer une exception si l\'ID est invalide', async () => {
      // ARRANGE
      const invalidId = 'invalid-id';

      // ACT & ASSERT
      await expect(service.update(invalidId, { titreCard: 'Test' }))
        .rejects
        .toThrow(BadRequestException);
    });
  });

  // ==========================================
  // TESTS : Suppression de retraite
  // ==========================================
  describe('remove()', () => {
    it('OK devrait supprimer une retraite avec succès', async () => {
      // ARRANGE
      const retreatId = new Types.ObjectId().toString();
      const deletedRetreat = {
        _id: retreatId,
        titreCard: 'Retraite à supprimer',
      };

      mockRetreatModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(deletedRetreat),
      });

      // ACT
      await service.remove(retreatId);

      // ASSERT
      expect(mockRetreatModel.findByIdAndDelete).toHaveBeenCalledWith(retreatId);
    });

    it('ERREUR devrait lancer une exception si la retraite n\'existe pas', async () => {
      // ARRANGE
      const retreatId = new Types.ObjectId().toString();

      mockRetreatModel.findByIdAndDelete.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      // ACT & ASSERT
      await expect(service.remove(retreatId))
        .rejects
        .toThrow(NotFoundException);
    });
  });

  // ==========================================
  // TESTS : Recherche de retraite par ID
  // ==========================================
  describe('findById()', () => {
    it('OK devrait trouver une retraite par ID', async () => {
      // ARRANGE
      const retreatId = new Types.ObjectId().toString();
      const mockRetreat = {
        _id: retreatId,
        titreCard: 'Retraite Yoga',
        imageCard: 'https://example.com/image.jpg',
        altImageCard: 'Image de yoga',
      };

      mockRetreatModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRetreat),
      });

      // ACT
      const result = await service.findById(retreatId);

      // ASSERT
      expect(result).toEqual(mockRetreat);
      expect(mockRetreatModel.findById).toHaveBeenCalledWith(retreatId);
    });

    it('ERREUR devrait lancer une exception si la retraite n\'existe pas', async () => {
      // ARRANGE
      const retreatId = new Types.ObjectId().toString();

      mockRetreatModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      // ACT & ASSERT
      await expect(service.findById(retreatId))
        .rejects
        .toThrow(NotFoundException);
    });

    it('ERREUR devrait lancer une exception si l\'ID est invalide', async () => {
      // ARRANGE
      const invalidId = 'invalid-id';

      // ACT & ASSERT
      await expect(service.findById(invalidId))
        .rejects
        .toThrow(BadRequestException);
    });
  });

  // ==========================================
  // TESTS : Liste de toutes les retraites
  // ==========================================
  describe('findAll()', () => {
    it('OK devrait retourner toutes les retraites', async () => {
      // ARRANGE
      const mockRetreats = [
        {
          _id: new Types.ObjectId(),
          titreCard: 'Retraite Yoga',
          imageCard: 'https://example.com/image1.jpg',
        },
        {
          _id: new Types.ObjectId(),
          titreCard: 'Retraite Méditation',
          imageCard: 'https://example.com/image2.jpg',
        },
      ];

      mockRetreatModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockRetreats),
      });

      // ACT
      const result = await service.findAll();

      // ASSERT
      expect(result).toHaveLength(2);
      expect(result[0].titreCard).toBe('Retraite Yoga');
      expect(mockRetreatModel.find).toHaveBeenCalled();
    });

    it('OK devrait retourner un tableau vide si aucune retraite', async () => {
      // ARRANGE
      mockRetreatModel.find.mockReturnValue({
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      });

      // ACT
      const result = await service.findAll();

      // ASSERT
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });
});
