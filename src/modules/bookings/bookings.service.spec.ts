import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { getModelToken } from '@nestjs/mongoose';
import { StripeService } from '../stripe/stripe.service';
import { PdfGeneratorService } from '../email/pdf-generator.service';
import { EmailService } from '../email/email.service';
import { Booking, BookingStatus } from './bookings.schema';
import { Retreat } from '../retreats/retreats.schema';
import { User } from '../users/users.schema';
import { Types } from 'mongoose';

describe('BookingsService - Tests Unitaires', () => {
  let service: BookingsService;
  let mockBookingModel: any;
  let mockRetreatModel: any;
  let mockUserModel: any;

  beforeEach(async () => {
    // Mock des modèles avec support complet
    mockBookingModel = {
      find: jest.fn(),
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
    };

    mockRetreatModel = {
      findById: jest.fn(),
    };

    mockUserModel = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: getModelToken(Booking.name),
          useValue: mockBookingModel,
        },
        {
          provide: getModelToken(Retreat.name),
          useValue: mockRetreatModel,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: StripeService,
          useValue: { refundPayment: jest.fn() },
        },
        {
          provide: PdfGeneratorService,
          useValue: {},
        },
        {
          provide: EmailService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // TESTS : Calcul des places disponibles
  // ==========================================
  describe('getAvailablePlaces()', () => {
    it('✅ devrait calculer correctement les places disponibles', async () => {
      // ARRANGE
      const retreatId = new Types.ObjectId().toString(); // Vrai ObjectId
      const date = new Date('2024-06-01');
      
      const mockRetreat = {
        _id: retreatId,
        places: 10,
        dates: [{
          start: new Date('2024-06-01'),
          end: new Date('2024-06-05'),
          prix: 500,
          places: 10,
          adresseRdv: 'Test Address'
        }]
      };

      // Mock aggregate pour retourner un tableau avec le nombre total de places réservées
      mockBookingModel.aggregate.mockResolvedValue([
        { totalPlaces: 5 } // 5 places déjà réservées
      ]);

      mockRetreatModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRetreat),
      });

      // ACT
      const result = await service.getAvailablePlaces(retreatId, date);

      // ASSERT
      expect(result).toBe(5); // 10 places - 5 réservées = 5 disponibles
      expect(mockBookingModel.aggregate).toHaveBeenCalled();
    });

    it('❌ devrait retourner 0 si toutes les places sont prises', async () => {
      // ARRANGE
      const retreatId = new Types.ObjectId().toString();
      const date = new Date('2024-06-01');
      
      const mockRetreat = {
        _id: retreatId,
        places: 10,
        dates: [{
          start: new Date('2024-06-01'),
          end: new Date('2024-06-05'),
          prix: 500,
          places: 10,
          adresseRdv: 'Test Address'
        }]
      };

      // Mock aggregate pour retourner que toutes les places sont prises
      mockBookingModel.aggregate.mockResolvedValue([
        { totalPlaces: 10 } // Toutes les places réservées
      ]);

      mockRetreatModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockRetreat),
      });

      // ACT
      const result = await service.getAvailablePlaces(retreatId, date);

      // ASSERT
      expect(result).toBe(0); // Aucune place disponible
    });
  });

  // ==========================================
  // TESTS : Statistiques des réservations
  // ==========================================
  describe('getStats()', () => {
    it('✅ devrait calculer les statistiques correctement', async () => {
      // ARRANGE
      const mockStats = {
        total: 100,
        pending: 20,
        confirmed: 60,
        cancelled: 15,
        expired: 5,
        totalRevenue: 50000,
      };

      // Mock aggregate pour retourner des stats
      mockBookingModel.aggregate.mockResolvedValue([mockStats]);

      // ACT
      const result = await service.getStats();

      // ASSERT
      expect(result).toEqual(mockStats);
      expect(mockBookingModel.aggregate).toHaveBeenCalled();
    });
  });

  // ==========================================
  // TESTS : Recherche de réservation par ID
  // ==========================================
  describe('findById()', () => {
    it('✅ devrait trouver une réservation par ID', async () => {
      // ARRANGE
      const bookingId = new Types.ObjectId().toString();
      const mockBooking = {
        _id: bookingId,
        retreatId: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        nbPlaces: 2,
        montantTotal: 1000,
        statut: BookingStatus.CONFIRMED,
      };

      mockBookingModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockBooking),
      });

      // ACT
      const result = await service.findById(bookingId);

      // ASSERT
      expect(result).toEqual(mockBooking);
      expect(mockBookingModel.findById).toHaveBeenCalledWith(bookingId);
    });

    it('❌ devrait lancer une exception si la réservation n\'existe pas', async () => {
      // ARRANGE
      const bookingId = new Types.ObjectId().toString();

      mockBookingModel.findById.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null), // Pas de résultat
      });

      // ACT & ASSERT
      await expect(service.findById(bookingId)).rejects.toThrow('Booking non trouvé');
    });
  });

  // ==========================================
  // TESTS : Annulation de réservation
  // ==========================================
  describe('cancelBooking()', () => {
    it('✅ devrait annuler une réservation avec succès', async () => {
      // ARRANGE
      const bookingId = new Types.ObjectId().toString();
      const mockBooking = {
        _id: bookingId,
        retreatId: new Types.ObjectId(),
        userId: new Types.ObjectId(),
        nbPlaces: 2,
        montantTotal: 1000,
        statut: BookingStatus.CONFIRMED,
        stripePaymentIntentId: 'pi_123',
        save: jest.fn().mockResolvedValue({
          _id: bookingId,
          statut: BookingStatus.CANCELLED,
          annulationDate: expect.any(Date),
        }),
      };

      mockBookingModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockBooking),
      });

      // ACT
      const result = await service.cancelBooking(bookingId, 'Raison test');

      // ASSERT
      expect(result.statut).toBe(BookingStatus.CANCELLED);
      expect(mockBooking.save).toHaveBeenCalled();
    });
  });

  // ==========================================
  // TESTS : Recherche des réservations utilisateur
  // ==========================================
  describe('findUserBookings()', () => {
    it('✅ devrait retourner toutes les réservations d\'un utilisateur', async () => {
      // ARRANGE
      const userId = new Types.ObjectId().toString();
      const mockBookings = [
        {
          _id: new Types.ObjectId(),
          userId,
          nbPlaces: 2,
          statut: BookingStatus.CONFIRMED,
        },
        {
          _id: new Types.ObjectId(),
          userId,
          nbPlaces: 1,
          statut: BookingStatus.PENDING,
        },
      ];

      mockBookingModel.find.mockReturnValue({
        populate: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockBookings),
      });

      // ACT
      const result = await service.findUserBookings(userId);

      // ASSERT
      expect(result).toHaveLength(2);
      expect(mockBookingModel.find).toHaveBeenCalled();
      // Note : Le service convertit userId en ObjectId, donc on vérifie juste l'appel
    });
  });
});
