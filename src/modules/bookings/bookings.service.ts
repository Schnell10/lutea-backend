import { Injectable, NotFoundException, BadRequestException, ConflictException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Booking, BookingDocument, BookingStatus, PaymentStatus } from './bookings.schema';
import { Retreat, RetreatDocument } from '../retreats/retreats.schema';
import { User, UserDocument } from '../users/users.schema';
import { StripeService } from '../stripe/stripe.service';
import { PdfGeneratorService } from '../email/pdf-generator.service';
import { EmailService } from '../email/email.service';
import Stripe from 'stripe';

import { CreateBookingDto } from './bookings.dto';
import { logger } from '../../common/utils/logger';

@Injectable()
export class BookingsService {
  constructor(
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
    @InjectModel(Retreat.name) private retreatModel: Model<RetreatDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @Inject(forwardRef(() => StripeService)) private stripeService: StripeService,
    private pdfGeneratorService: PdfGeneratorService,
    private emailService: EmailService,
  ) {}

  // Je crée un nouveau booking (je bloque les places immédiatement)
  async createBooking(userId: string | null, createBookingDto: CreateBookingDto): Promise<Booking> {
    const { retreatId, nbPlaces, participants, billingAddress, notes, statut } = createBookingDto;
    
    
    const dateStart = typeof createBookingDto.dateStart === 'string' // Je convertis les dates string vers Date
      ? new Date(createBookingDto.dateStart) 
      : createBookingDto.dateStart;
    const dateEnd = typeof createBookingDto.dateEnd === 'string' 
      ? new Date(createBookingDto.dateEnd) 
      : createBookingDto.dateEnd;

    logger.log('[BOOKING] Début de création');
    logger.log('[BOOKING] Retreat ID:', retreatId);
    logger.log('[BOOKING] Date:', dateStart);
    logger.log('[BOOKING] Nombre de places:', nbPlaces);
    logger.log('[BOOKING] Utilisateur:', userId ? `Connecté (${userId})` : 'Anonyme');
    logger.log('[BOOKING] Statut demandé:', statut);
    logger.log('[BOOKING] Participants:', participants.length);
    logger.log('[BOOKING] Email principal:', participants[0]?.email);

    const retreat = await this.retreatModel.findById(retreatId).exec();
    if (!retreat) {
      logger.error('[BOOKING] Retraite non trouvée:', retreatId);
      throw new NotFoundException('Retraite non trouvée');
    }

    logger.log('[BOOKING] Retraite trouvée:', {
      titreCard: retreat.titreCard,
      prix: retreat.prix,
      capaciteMax: retreat.places
    });

    // Je vérifie que l'utilisateur existe (seulement si connecté)
    if (userId) {
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        logger.error('[BOOKING] Utilisateur non trouvé:', userId);
        throw new NotFoundException('Utilisateur non trouvé');
      }
      logger.log('[BOOKING] Utilisateur connecté:', {
        userId,
        email: user.email
      });
    } else {
      logger.log('[BOOKING] Utilisateur non connecté - booking anonyme');
    }

    // Je vérifie qu'il y a assez de places disponibles
    const placesDisponibles = await this.getAvailablePlaces(retreatId, dateStart);
    if (placesDisponibles < nbPlaces) {
      logger.error('[BOOKING] Pas assez de places:', {
        placesDisponibles,
        nbPlacesDemandees: nbPlaces
      });
      throw new ConflictException(`Seulement ${placesDisponibles} places disponibles`);
    }

    // Je trouve le bloc de dates sélectionné pour récupérer le prix
    const selectedDateBlock = retreat.dates?.find(date => {
      if (!dateStart || !date.start) return false;
      const dateStartObj = new Date(date.start);
      const dateEndObj = new Date(date.end);
      const selectedDate = new Date(dateStart);
      
      // Je vérifie si la date sélectionnée est dans ce bloc de dates
      return selectedDate >= dateStartObj && selectedDate <= dateEndObj;
    });

    const prixUnitaire = selectedDateBlock?.prix || retreat.prix || 0;
    const prixTotal = prixUnitaire * nbPlaces;

    logger.log('[BOOKING] Calcul du prix:', {
      selectedDateBlock: selectedDateBlock ? {
        start: selectedDateBlock.start,
        end: selectedDateBlock.end,
        prix: selectedDateBlock.prix
      } : null,
      prixUnitaire,
      nbPlaces,
      prixTotal
    });

    // Je crée le booking (avec ou sans userId)
    const booking = new this.bookingModel({
      userId: userId ? new Types.ObjectId(userId) : null,
      isGuest: !userId, 
      isStripeBooking: true,
      retreatId: new Types.ObjectId(retreatId),
      retreatName: createBookingDto.retreatName || retreat.titreCard,
      retreatAddress: createBookingDto.retreatAddress || selectedDateBlock?.adresseRdv || retreat.adresseRdv,
      retreatHeureArrivee: createBookingDto.retreatHeureArrivee,
      retreatHeureDepart: createBookingDto.retreatHeureDepart,
      dateStart,
      dateEnd,
      nbPlaces,
      prixTotal,
      participants: participants,
      billingAddress: billingAddress,
      statut: statut || BookingStatus.PENDING,
      statutPaiement: PaymentStatus.PENDING,
      notes: notes || '',
    });

    const savedBooking = await booking.save();

    logger.log('[BOOKING] Booking créé avec succès:', {
      bookingId: savedBooking._id,
      retreatId,
      nbPlaces,
      prixTotal,
      statut: savedBooking.statut,
      userId: savedBooking.userId ? 'Connecté' : 'Anonyme'
    });

    return savedBooking;
  }


  // Je valide un booking après paiement réussi
  async confirmBooking(bookingId: string, stripePaymentIntentId: string): Promise<Booking> {
    logger.log('[BOOKING] Début de confirmation');
    logger.log('[BOOKING] Booking ID:', bookingId);
    logger.log('[BOOKING] PaymentIntent ID:', stripePaymentIntentId);
    
    if (!Types.ObjectId.isValid(bookingId)) {
      throw new BadRequestException('ID de booking invalide');
    }

    const booking = await this.bookingModel.findById(bookingId).exec();
    if (!booking) {
      throw new NotFoundException('Booking non trouvé');
    }

    if (booking.statut !== BookingStatus.PENDING) {
      throw new BadRequestException('Le booking n\'est pas en attente');
    }

    booking.statut = BookingStatus.CONFIRMED;
    booking.statutPaiement = PaymentStatus.PAID;
    booking.stripePaymentIntentId = stripePaymentIntentId;

    const confirmedBooking = await booking.save();

    // Je génère et j'envoie le PDF de confirmation
    try {
      logger.log('[PDF] Génération du PDF de confirmation...');
      
      // Je récupère les données de la retraite
      const retreat = await this.retreatModel.findById(confirmedBooking.retreatId).exec();
      if (!retreat) {
        logger.error('[PDF] Retraite non trouvée pour la génération du PDF');
        return confirmedBooking;
      }

      // Je génère le PDF
      const pdfBuffer = await this.pdfGeneratorService.generateConfirmationPdf(confirmedBooking);
      logger.log('[PDF] PDF généré avec succès');
      
      // J'envoie l'email avec le PDF
      logger.log('[EMAIL] Envoi de la confirmation par email...');
      const emailSent = await this.emailService.sendBookingConfirmation(confirmedBooking, retreat, pdfBuffer);
      
      if (emailSent) {
        logger.log('[EMAIL] Confirmation envoyée avec succès');
      } else {
        logger.error('[EMAIL] Échec de l\'envoi de la confirmation');
      }
      
    } catch (error) {
      logger.error('[PDF/EMAIL] Erreur lors de la génération/envoi:', error);
      // Je ne fais pas échouer la confirmation si le PDF/email échoue
    }

    return confirmedBooking;
  }

  // J'annule un booking
  async cancelBooking(bookingId: string, raison?: string): Promise<Booking> {
    if (!Types.ObjectId.isValid(bookingId)) {
      throw new BadRequestException('ID de booking invalide');
    }

    const booking = await this.bookingModel.findById(bookingId).exec();
    if (!booking) {
      throw new NotFoundException('Booking non trouvé');
    }

    if (booking.statut === BookingStatus.CANCELLED) {
      return booking; // Déjà annulé
    }

    booking.statut = BookingStatus.CANCELLED;
    booking.annulationRaison = raison || 'Annulation';
    booking.annulationDate = new Date();

    return booking.save();
  }

  // Je récupère un booking par ID
  async findById(id: string): Promise<Booking> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de booking invalide');
    }

    const booking = await this.bookingModel
      .findById(id)
      .populate('retreatId', 'nom prix')
      .populate('userId', 'firstName lastName email')
      .exec();

    if (!booking) {
      throw new NotFoundException('Booking non trouvé');
    }

    return booking;
  }

  // Je récupère un booking par ID pour PDF (plus besoin de populate)
  async findByIdWithRetreat(id: string): Promise<any> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de booking invalide');
    }

    const booking = await this.bookingModel.findById(id).exec();

    if (!booking) {
      throw new BadRequestException('Booking non trouvé');
    }

    return booking;
  }

  // Je récupère les bookings d'un utilisateur
  async findUserBookings(userId: string): Promise<Booking[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('ID d\'utilisateur invalide');
    }

    const bookings = await this.bookingModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();

    return bookings;
  }

  // Je calcule les places disponibles pour une retraite
  async getAvailablePlaces(retreatId: string, date: Date): Promise<number> {
    // Je convertis la date en objet Date
    const dateObj = date instanceof Date ? date : new Date(date);

    if (!Types.ObjectId.isValid(retreatId)) {
      logger.error('[PLACES] ID de retraite invalide:', retreatId);
      throw new BadRequestException('ID de retraite invalide');
    }

    const retreat = await this.retreatModel.findById(retreatId).exec();
    if (!retreat) {
      logger.error('[PLACES] Retraite non trouvée:', retreatId);
      throw new NotFoundException('Retraite non trouvée');
    }

    // Je trouve la date correspondante dans retreat.dates[]
    const selectedDate = retreat.dates?.find(d => 
      new Date(d.start).getTime() === dateObj.getTime()
    );

    if (!selectedDate) {
      logger.error('[PLACES] Date non trouvée dans la retraite:', dateObj);
      throw new NotFoundException('Date de retraite non trouvée');
    }

    // Je compte les places déjà réservées (bookings confirmés ET pending)
    const placesReservees = await this.bookingModel.aggregate([
      {
        $match: {
          retreatId: new Types.ObjectId(retreatId),
          dateStart: dateObj,
          $or: [
            { 
              statut: BookingStatus.CONFIRMED,
              statutPaiement: PaymentStatus.PAID
            },
            { 
              statut: BookingStatus.PENDING,
              statutPaiement: PaymentStatus.PENDING
            }
          ]
        }
      },
      {
        $group: {
          _id: null,
          totalPlaces: { $sum: '$nbPlaces' }
        }
      }
    ]);

    const totalPlacesReservees = placesReservees.length > 0 ? placesReservees[0].totalPlaces : 0;
    const placesDisponibles = selectedDate.places - totalPlacesReservees;

    return Math.max(0, placesDisponibles);
  }

  // Je récupère tous les bookings (admin)
  async findAll(): Promise<Booking[]> {
    return this.bookingModel
      .find()
      .populate('retreatId', 'nom prix')
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .exec();
  }

  // nettoie les bookings expirés
  async cleanupExpiredBookings(): Promise<number> {
    // Bookings expirés après 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 16 * 60 * 1000);
    // réservations expirées
    const expiredBookings = await this.bookingModel.find({
      statut: BookingStatus.PENDING,
      statutPaiement: PaymentStatus.PENDING,
      createdAt: { $lt: fifteenMinutesAgo }
    }); 

    let cleanedCount = 0;
    for (const booking of expiredBookings) {
      try {
        // J'annule le PaymentIntent chez Stripe
        if (booking.stripePaymentIntentId) {
          try {
            await this.stripeService.cancelPaymentIntent(booking.stripePaymentIntentId);
            logger.log(`PaymentIntent ${booking.stripePaymentIntentId} annulé chez Stripe`);
          } catch (error) {
            logger.error(`Erreur annulation PaymentIntent ${booking.stripePaymentIntentId}:`, error);
            // Je continue même si l'annulation Stripe échoue
          }
        }
        // Supprime la réservation
        await this.bookingModel.findByIdAndDelete(booking._id);
        logger.log(`Réservation ${booking._id.toString()} supprimée définitivement`);
        cleanedCount++;
      } catch (error) {
        logger.error(`Erreur lors du nettoyage de la réservation ${booking._id.toString()}:`, error);
      }
    }
    return cleanedCount;
  }

  // Je calcule les statistiques des bookings (admin)
  async getStats(): Promise<{
    total: number;
    pending: number;
    confirmed: number;
    cancelled: number;
    revenue: number;
  }> {
    const stats = await this.bookingModel.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ['$statut', BookingStatus.PENDING] }, 1, 0] }
          },
          confirmed: {
            $sum: { $cond: [{ $eq: ['$statut', BookingStatus.CONFIRMED] }, 1, 0] }
          },
          cancelled: {
            $sum: { $cond: [{ $eq: ['$statut', BookingStatus.CANCELLED] }, 1, 0] }
          },
          revenue: {
            $sum: {
              $cond: [
                { $and: [
                  { $eq: ['$statut', BookingStatus.CONFIRMED] },
                  { $eq: ['$statutPaiement', PaymentStatus.PAID] }
                ]},
                '$prixTotal',
                0
              ]
            }
          }
        }
      }
    ]);

    return stats[0] || {
      total: 0,
      pending: 0,
      confirmed: 0,
      cancelled: 0,
      revenue: 0
    };
  }

  // Je vérifie les incohérences entre Stripe et les réservations par session (retraite + date)
  async checkPaymentDiscrepancies(gracePeriodMinutes: number = 0): Promise<{
    sessionDiscrepancies: Array<{
      retreatId: string;
      retreatName: string;
      sessionDate: string;
      stripePayments: number;
      totalBookings: number;
      confirmedBookings: number;
      discrepancy: number;
    }>;
    bookingDiscrepancies: Array<{
      bookingId: string;
      paymentIntentId: string;
      retreatId: string;
      retreatName: string;
      sessionDate: string;
      clientEmail: string;
      amount: number;
      amountRefunded?: number;
      createdAt: Date;
      problem: string;
    }>;
    summary: {
      totalDiscrepancies: number;
      sessionsWithIssues: number;
      retreatsWithIssues: number;
      orphanPaymentsCount: number;
      orphanBookingsCount: number;
    };
  }> {
    logger.log(`[BookingsService] Vérification des incohérences de paiement (délai de grâce: ${gracePeriodMinutes}min)...`);

    // Je calcule la date limite pour le délai de grâce
    const gracePeriodAgo = new Date(Date.now() - gracePeriodMinutes * 60 * 1000);

    // 1. Je récupère les PaymentIntent réussis de Stripe des 5 derniers jours
    const stripePayments = await this.stripeService.getSuccessfulPayments();
    
    // 2. Je récupère SEULEMENT les bookings Stripe des 5 derniers jours
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    
    const allBookings = await this.bookingModel.find({
      createdAt: { 
        $gte: fiveDaysAgo
      },
      isStripeBooking: true, // SEULEMENT les bookings créés via Stripe (pas ceux créés manuellement)
      statut: 'CONFIRMED' // SEULEMENT les bookings confirmés (avec paiement)
    }).populate('retreatId', 'titreCard dates');

    // 3. Je crée un mapping des paiements Stripe par stripePaymentIntentId
    const stripeByPaymentId = new Map<string, Stripe.PaymentIntent>();
    for (const payment of stripePayments) {
      stripeByPaymentId.set(payment.id, payment);
    }

    // 4. Je crée un mapping des bookings par stripePaymentIntentId
    const bookingsByStripeId = new Map<string, any>();
    for (const booking of allBookings) {
      if (booking.stripePaymentIntentId) {
        bookingsByStripeId.set(booking.stripePaymentIntentId, booking);
      }
    }

    // 5. Je détecte les paiements "orphelins" (sans booking correspondant)
    // Mais j'ignore les paiements récents (délai de grâce)
    const orphanPayments = [];
    for (const [paymentId, payment] of stripeByPaymentId) {
      if (!bookingsByStripeId.has(paymentId)) {
        // Je vérifie si le paiement est récent (délai de grâce)
        const paymentDate = new Date(payment.created * 1000);
        const isRecentPayment = paymentDate > gracePeriodAgo;
        
        if (isRecentPayment) {
          continue; // J'ignore les paiements récents (délai de grâce)
        }
        
        // Paiement sans booking correspondant (et pas récent)
        const retreatId = payment.metadata?.retreatId;
        const retreatName = payment.metadata?.retreatName || 'N/A';
        let sessionDate = payment.metadata?.sessionDate;
        
        // J'extrais la date de session si pas disponible
        if (!sessionDate && payment.metadata?.retreatDates) {
          const retreatDates = payment.metadata.retreatDates;
          const dateMatch = retreatDates.match(/(\d{1,2})\s+\w+\s+(\d{4})/);
          if (dateMatch) {
            const day = dateMatch[1].padStart(2, '0');
            const year = dateMatch[2];
            const month = retreatDates.includes('janvier') ? '01' :
                         retreatDates.includes('février') ? '02' :
                         retreatDates.includes('mars') ? '03' :
                         retreatDates.includes('avril') ? '04' :
                         retreatDates.includes('mai') ? '05' :
                         retreatDates.includes('juin') ? '06' :
                         retreatDates.includes('juillet') ? '07' :
                         retreatDates.includes('août') ? '08' :
                         retreatDates.includes('septembre') ? '09' :
                         retreatDates.includes('octobre') ? '10' :
                         retreatDates.includes('novembre') ? '11' :
                         retreatDates.includes('décembre') ? '12' : '01';
            sessionDate = `${year}-${month}-${day}`;
          }
        }
        
        orphanPayments.push({
          paymentId: payment.id,
          retreatId,
          retreatName,
          sessionDate: sessionDate || 'N/A',
          amount: payment.amount,
          clientEmail: payment.metadata?.clientEmail || 'N/A',
          createdAt: new Date(payment.created * 1000)
        });
      }
    }

    // 6. VÉRIFICATION INVERSE : Je détecte les bookings sans paiement Stripe valide
    const orphanBookings = [];
    for (const booking of allBookings) {
      if (!booking.stripePaymentIntentId) {
        continue; // Booking sans PaymentIntent ID, j'ignore
      }

      const paymentIntentId = booking.stripePaymentIntentId;
      const stripePayment = stripeByPaymentId.get(paymentIntentId);

      if (!stripePayment) {
        // Booking avec un PaymentIntent ID qui n'existe pas dans la liste des paiements réussis
        // Cela signifie soit : PaymentIntent introuvable, annulé, ou remboursé (car getSuccessfulPayments() filtre les remboursements)
        const retreat = booking.retreatId as any;
        orphanBookings.push({
          bookingId: booking._id.toString(),
          paymentIntentId: paymentIntentId,
          retreatId: booking.retreatId?.toString() || 'N/A',
          retreatName: retreat?.titreCard || 'N/A',
          sessionDate: booking.dateStart ? new Date(booking.dateStart).toISOString().split('T')[0] : 'N/A',
          clientEmail: booking.participants?.[0]?.email || 'N/A',
          amount: booking.prixTotal || 0,
          createdAt: (booking as any).createdAt || new Date(),
          problem: 'PaymentIntent introuvable dans les paiements réussis Stripe (peut-être remboursé, annulé, ou introuvable)'
        });
      }
      // Si stripePayment existe, c'est qu'il est dans la liste des paiements réussis sans remboursement, donc pas de problème
    }

    // 7. Je calcule le résumé total (paiements orphelins + bookings orphelins)
    const totalDiscrepancies = orphanPayments.length + orphanBookings.length;
    const summary = {
      totalDiscrepancies,
      sessionsWithIssues: totalDiscrepancies,
      retreatsWithIssues: new Set([
        ...orphanPayments.map(p => p.retreatId),
        ...orphanBookings.map(b => b.retreatId)
      ]).size,
      orphanPaymentsCount: orphanPayments.length,
      orphanBookingsCount: orphanBookings.length
    };

    // Log détaillé des paiements orphelins
    if (orphanPayments.length > 0) {
      orphanPayments.forEach((payment) => {
        logger.log(`[BookingsService] Paiement Stripe sans booking correspondant - PaymentIntent: ${payment.paymentId} | Retraite: ${payment.retreatName} | Date: ${payment.sessionDate} | Email: ${payment.clientEmail}`);
      });
    }

    // Log détaillé des bookings orphelins
    if (orphanBookings.length > 0) {
      orphanBookings.forEach((booking) => {
        logger.log(`[BookingsService] Booking sans paiement Stripe valide - Booking ID: ${booking.bookingId} | PaymentIntent: ${booking.paymentIntentId} | Retraite: ${booking.retreatName} | Date: ${booking.sessionDate} | Email: ${booking.clientEmail}`);
      });
    }

    return {
      sessionDiscrepancies: orphanPayments,
      bookingDiscrepancies: orphanBookings,
      summary
    };
  }


  // Je crée un booking manuellement par l'admin (non-Stripe)
  async createBookingByAdmin(createBookingDto: CreateBookingDto): Promise<Booking> {
    const { retreatId, nbPlaces, participants, billingAddress, notes, statut } = createBookingDto;
    
    // Je convertis les dates string vers Date si nécessaire
    const dateStart = typeof createBookingDto.dateStart === 'string' 
      ? new Date(createBookingDto.dateStart) 
      : createBookingDto.dateStart;
    const dateEnd = typeof createBookingDto.dateEnd === 'string' 
      ? new Date(createBookingDto.dateEnd) 
      : createBookingDto.dateEnd;

    // J'extrais le userId s'il est fourni (quand admin trouve un compte existant)
    const userId: string | null = (createBookingDto as any).userId || null;
    const isGuest = !userId; // Si pas de userId, c'est un invité

    logger.log('[ADMIN] Création manuelle d\'un booking...', {
      retreatId,
      date: dateStart,
      nbPlaces,
      statut: statut || 'CONFIRMED',
      userId: userId ? `Associé à l'utilisateur ${userId}` : 'Invité (sans compte)',
      isGuest
    });

    // Je vérifie que la retraite existe
    const retreat = await this.retreatModel.findById(retreatId).exec();
    if (!retreat) {
      throw new NotFoundException('Retraite non trouvée');
    }

    // Je vérifie qu'il y a assez de places disponibles
    const placesDisponibles = await this.getAvailablePlaces(retreatId, dateStart);
    if (placesDisponibles < nbPlaces) {
      throw new ConflictException(`Seulement ${placesDisponibles} places disponibles`);
    }

    // Je calcule le prix total
    const prixTotal = retreat.prix * nbPlaces;

    // Je crée le booking avec isStripeBooking = false
    const booking = new this.bookingModel({
      userId: userId ? new Types.ObjectId(userId) : null, // J'associe au compte si trouvé
      isGuest: isGuest, // false si utilisateur trouvé, true sinon
      isStripeBooking: false, // FALSE car créé manuellement par admin
      retreatId: new Types.ObjectId(retreatId),
      // Informations de la retraite au moment de la réservation
      retreatName: retreat.titreCard,
      retreatAddress: retreat.adresseRdv,
      retreatHeureArrivee: retreat.dates?.[0]?.heureArrivee,
      retreatHeureDepart: retreat.dates?.[0]?.heureDepart,
      dateStart,
      dateEnd,
      nbPlaces,
      prixTotal,
      participants: participants,
      billingAddress: billingAddress,
      statut: statut || BookingStatus.CONFIRMED, // Par défaut confirmé
      statutPaiement: PaymentStatus.PAID, // Admin considère comme payé
      notes: notes || 'Créé manuellement par l\'admin',
    });

    const savedBooking = await booking.save();

    logger.log('[ADMIN] Booking créé manuellement avec succès:', {
      bookingId: savedBooking._id,
      retreatId,
      nbPlaces,
      prixTotal,
      statut: savedBooking.statut,
      isStripeBooking: savedBooking.isStripeBooking,
      userId: savedBooking.userId ? savedBooking.userId.toString() : null,
      isGuest: savedBooking.isGuest
    });

    return savedBooking;
  }
}