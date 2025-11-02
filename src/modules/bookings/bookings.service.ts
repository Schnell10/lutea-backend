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

// Import du DTO depuis le fichier dédié
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

  // Créer un nouveau booking (bloque les places immédiatement)
  async createBooking(userId: string | null, createBookingDto: CreateBookingDto): Promise<Booking> {
    const { retreatId, nbPlaces, participants, billingAddress, notes, statut } = createBookingDto;
    
    // Conversion des dates string vers Date si nécessaire
    const dateStart = typeof createBookingDto.dateStart === 'string' 
      ? new Date(createBookingDto.dateStart) 
      : createBookingDto.dateStart;
    const dateEnd = typeof createBookingDto.dateEnd === 'string' 
      ? new Date(createBookingDto.dateEnd) 
      : createBookingDto.dateEnd;

    // 🎯 LOG DÉTAILLÉ POUR LA CRÉATION DE BOOKING
    logger.log('🎯 ===========================================');
    logger.log('🎯 [BOOKING] DÉBUT DE CRÉATION');
    logger.log('🎯 ===========================================');
    logger.log('🎯 Retreat ID:', retreatId);
    logger.log('🎯 Date:', dateStart);
    logger.log('🎯 Nombre de places:', nbPlaces);
    logger.log('🎯 Utilisateur:', userId ? `Connecté (${userId})` : 'Anonyme');
    logger.log('🎯 Statut demandé:', statut);
    logger.log('🎯 Participants:', participants.length);
    logger.log('🎯 Email principal:', participants[0]?.email);
    logger.log('🎯 ===========================================');

    // Vérifier que la retraite existe
    const retreat = await this.retreatModel.findById(retreatId).exec();
    if (!retreat) {
      logger.error('❌ [BOOKING] Retraite non trouvée:', retreatId);
      throw new NotFoundException('Retraite non trouvée');
    }

    logger.log('✅ [BOOKING] Retraite trouvée:', {
      titreCard: retreat.titreCard,
      prix: retreat.prix,
      capaciteMax: retreat.places
    });
    
    // 🎯 LOG DÉTAILLÉ POUR LA RETRAITE
    logger.log('🎯 ===========================================');
    logger.log('🎯 [BOOKING] RETRAITE VALIDÉE');
    logger.log('🎯 ===========================================');
    logger.log('🎯 Titre:', retreat.titreCard);
    logger.log('🎯 Prix unitaire:', retreat.prix, '€');
    logger.log('🎯 Capacité max:', retreat.places, 'places');
    logger.log('🎯 ===========================================');

    // Vérifier que l'utilisateur existe (seulement si connecté)
    if (userId) {
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        logger.error('❌ [BOOKING] Utilisateur non trouvé:', userId);
        throw new NotFoundException('Utilisateur non trouvé');
      }
      logger.log('✅ [BOOKING] Utilisateur connecté:', {
        userId,
        email: user.email
      });
    } else {
      logger.log('ℹ️ [BOOKING] Utilisateur non connecté - booking anonyme');
    }

    // Vérifier qu'il y a assez de places disponibles
    const placesDisponibles = await this.getAvailablePlaces(retreatId, dateStart);
    if (placesDisponibles < nbPlaces) {
      logger.error('❌ [BOOKING] Pas assez de places:', {
        placesDisponibles,
        nbPlacesDemandees: nbPlaces
      });
      throw new ConflictException(`Seulement ${placesDisponibles} places disponibles`);
    }

    // Trouver le bloc de dates sélectionné pour récupérer le prix
    const selectedDateBlock = retreat.dates?.find(date => {
      if (!dateStart || !date.start) return false;
      const dateStartObj = new Date(date.start);
      const dateEndObj = new Date(date.end);
      const selectedDate = new Date(dateStart);
      
      // Vérifier si la date sélectionnée est dans ce bloc de dates
      return selectedDate >= dateStartObj && selectedDate <= dateEndObj;
    });

    // Calculer le prix total avec le prix de la date sélectionnée
    const prixUnitaire = selectedDateBlock?.prix || retreat.prix || 0;
    const prixTotal = prixUnitaire * nbPlaces;

    logger.log('💰 [BOOKING] Calcul du prix:', {
      selectedDateBlock: selectedDateBlock ? {
        start: selectedDateBlock.start,
        end: selectedDateBlock.end,
        prix: selectedDateBlock.prix
      } : null,
      prixUnitaire,
      nbPlaces,
      prixTotal
    });
    
    // 🎯 LOG DÉTAILLÉ POUR LE CALCUL DU PRIX
    logger.log('🎯 ===========================================');
    logger.log('🎯 [BOOKING] CALCUL DU PRIX');
    logger.log('🎯 ===========================================');
    logger.log('🎯 Prix unitaire:', prixUnitaire, '€');
    logger.log('🎯 Nombre de places:', nbPlaces);
    logger.log('🎯 Prix total:', prixTotal, '€');
    logger.log('🎯 ===========================================');

    // Créer le booking (avec ou sans userId)
    const booking = new this.bookingModel({
      userId: userId ? new Types.ObjectId(userId) : null,
      isGuest: !userId, // true si pas d'userId (client anonyme)
      isStripeBooking: true, // true par défaut car créé via le tunnel Stripe
      retreatId: new Types.ObjectId(retreatId),
      // Informations spécifiques de la retraite sélectionnée (viennent du tunnel de réservation)
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

    logger.log('✅ [BOOKING] Booking créé avec succès:', {
      bookingId: savedBooking._id,
      retreatId,
      nbPlaces,
      prixTotal,
      statut: savedBooking.statut,
      userId: savedBooking.userId ? 'Connecté' : 'Anonyme'
    });
    
    // 🎯 LOG DÉTAILLÉ POUR LA CRÉATION RÉUSSIE
    logger.log('🎯 ===========================================');
    logger.log('🎯 [BOOKING] CRÉATION RÉUSSIE');
    logger.log('🎯 ===========================================');
    logger.log('🎯 Booking ID:', savedBooking._id);
    logger.log('🎯 Statut:', savedBooking.statut);
    logger.log('🎯 Statut paiement:', savedBooking.statutPaiement);
    logger.log('🎯 Nombre de places:', savedBooking.nbPlaces);
    logger.log('🎯 Prix total:', savedBooking.prixTotal, '€');
    logger.log('🎯 Utilisateur:', savedBooking.userId ? 'Connecté' : 'Anonyme');
    logger.log('🎯 Date création:', (savedBooking as any).createdAt);
    logger.log('🎯 ===========================================');

    return savedBooking;
  }


  // Valider un booking après paiement réussi
  async confirmBooking(bookingId: string, stripePaymentIntentId: string): Promise<Booking> {
    // 🎯 LOG DÉTAILLÉ POUR LA CONFIRMATION DE BOOKING
    logger.log('🎯 ===========================================');
    logger.log('🎯 [BOOKING] DÉBUT DE CONFIRMATION');
    logger.log('🎯 ===========================================');
    logger.log('🎯 Booking ID:', bookingId);
    logger.log('🎯 PaymentIntent ID:', stripePaymentIntentId);
    logger.log('🎯 ===========================================');
    
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

    // 🎯 LOG DÉTAILLÉ POUR L'ÉTAT AVANT CONFIRMATION
    logger.log('🎯 ===========================================');
    logger.log('🎯 [BOOKING] ÉTAT AVANT CONFIRMATION');
    logger.log('🎯 ===========================================');
    logger.log('🎯 Booking ID:', booking._id);
    logger.log('🎯 Statut actuel:', booking.statut);
    logger.log('🎯 Statut paiement actuel:', booking.statutPaiement);
    logger.log('🎯 Nombre de places:', booking.nbPlaces);
    logger.log('🎯 Prix total:', booking.prixTotal, '€');
    logger.log('🎯 ===========================================');

    booking.statut = BookingStatus.CONFIRMED;
    booking.statutPaiement = PaymentStatus.PAID;
    booking.stripePaymentIntentId = stripePaymentIntentId;

    const confirmedBooking = await booking.save();
    
    // 🎯 LOG DÉTAILLÉ POUR LA CONFIRMATION RÉUSSIE
    logger.log('🎯 ===========================================');
    logger.log('🎯 [BOOKING] CONFIRMATION RÉUSSIE');
    logger.log('🎯 ===========================================');
    logger.log('🎯 Booking ID:', confirmedBooking._id);
    logger.log('🎯 Nouveau statut:', confirmedBooking.statut);
    logger.log('🎯 Nouveau statut paiement:', confirmedBooking.statutPaiement);
    logger.log('🎯 PaymentIntent ID:', confirmedBooking.stripePaymentIntentId);
    logger.log('🎯 Nombre de places:', confirmedBooking.nbPlaces);
    logger.log('🎯 Prix total:', confirmedBooking.prixTotal, '€');
    logger.log('🎯 ===========================================');

    // Générer et envoyer le PDF de confirmation
    try {
      logger.log('📄 [PDF] Génération du PDF de confirmation...');
      
      // Récupérer les données de la retraite
      const retreat = await this.retreatModel.findById(confirmedBooking.retreatId).exec();
      if (!retreat) {
        logger.error('❌ [PDF] Retraite non trouvée pour la génération du PDF');
        return confirmedBooking;
      }

      // Générer le PDF
      const pdfBuffer = await this.pdfGeneratorService.generateConfirmationPdf(confirmedBooking);
      logger.log('✅ [PDF] PDF généré avec succès');
      
      // Envoyer l'email avec le PDF
      logger.log('📧 [EMAIL] Envoi de la confirmation par email...');
      const emailSent = await this.emailService.sendBookingConfirmation(confirmedBooking, retreat, pdfBuffer);
      
      if (emailSent) {
        logger.log('✅ [EMAIL] Confirmation envoyée avec succès');
      } else {
        logger.error('❌ [EMAIL] Échec de l\'envoi de la confirmation');
      }
      
    } catch (error) {
      logger.error('❌ [PDF/EMAIL] Erreur lors de la génération/envoi:', error);
      // Ne pas faire échouer la confirmation si le PDF/email échoue
    }

    return confirmedBooking;
  }

  // Annuler un booking
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

  // Récupérer un booking par ID
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

  // Récupérer un booking par ID pour PDF (plus besoin de populate)
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

  // Récupérer les bookings d'un utilisateur
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

  // Calculer les places disponibles pour une retraite
  async getAvailablePlaces(retreatId: string, date: Date): Promise<number> {
    // Convertir la date en objet Date si ce n'est pas déjà le cas
    const dateObj = date instanceof Date ? date : new Date(date);
    
    logger.log(`🔍 [PLACES] Vérification des places disponibles...`, {
      retreatId,
      date: dateObj.toISOString(),
      timestamp: new Date().toISOString()
    });

    if (!Types.ObjectId.isValid(retreatId)) {
      logger.error('❌ [PLACES] ID de retraite invalide:', retreatId);
      throw new BadRequestException('ID de retraite invalide');
    }

    const retreat = await this.retreatModel.findById(retreatId).exec();
    if (!retreat) {
      logger.error('❌ [PLACES] Retraite non trouvée:', retreatId);
      throw new NotFoundException('Retraite non trouvée');
    }

    // Trouver la date correspondante dans retreat.dates[]
    const selectedDate = retreat.dates?.find(d => 
      new Date(d.start).getTime() === dateObj.getTime()
    );

    if (!selectedDate) {
      logger.error('❌ [PLACES] Date non trouvée dans la retraite:', dateObj);
      throw new NotFoundException('Date de retraite non trouvée');
    }

    logger.log(`📋 [PLACES] Retraite trouvée:`, {
      titreCard: retreat.titreCard,
      date: dateObj,
      capaciteMax: selectedDate.places
    });

    // Compter les places déjà réservées (bookings confirmés ET pending)
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

    logger.log(`✅ [PLACES] Calcul terminé:`, {
      capaciteMax: selectedDate.places,
      placesReservees: totalPlacesReservees,
      placesDisponibles: Math.max(0, placesDisponibles),
      retraite: retreat.titreCard,
      date: dateObj
    });

    return Math.max(0, placesDisponibles);
  }

  // Récupérer tous les bookings (admin)
  async findAll(): Promise<Booking[]> {
    return this.bookingModel
      .find()
      .populate('retreatId', 'nom prix')
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .exec();
  }

  // Nettoyer les bookings expirés
  async cleanupExpiredBookings(): Promise<number> {
    // Bookings expirés après 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 16 * 60 * 1000);
    logger.log('🔍 [Cleanup] Recherche des bookings créés avant:', fifteenMinutesAgo.toISOString());
    
    // Trouver les réservations expirées
    const expiredBookings = await this.bookingModel.find({
      statut: BookingStatus.PENDING,
      statutPaiement: PaymentStatus.PENDING,
      createdAt: { $lt: fifteenMinutesAgo }
    });
    
    logger.log('🔍 [Cleanup] Bookings expirés trouvés:', expiredBookings.length);

    let cleanedCount = 0;

    for (const booking of expiredBookings) {
      try {
        // 1. D'ABORD : Annuler le PaymentIntent chez Stripe
        if (booking.stripePaymentIntentId) {
          try {
            await this.stripeService.cancelPaymentIntent(booking.stripePaymentIntentId);
            logger.log(`✅ PaymentIntent ${booking.stripePaymentIntentId} annulé chez Stripe`);
          } catch (error) {
            logger.error(`❌ Erreur annulation PaymentIntent ${booking.stripePaymentIntentId}:`, error);
            // Continue même si l'annulation Stripe échoue
          }
        }

        // 2. ENSUITE : Supprimer complètement la réservation côté Lutea
        await this.bookingModel.findByIdAndDelete(booking._id);

        logger.log(`✅ Réservation ${booking._id.toString()} supprimée définitivement`);
        cleanedCount++;

      } catch (error) {
        logger.error(`❌ Erreur lors du nettoyage de la réservation ${booking._id.toString()}:`, error);
      }
    }

    return cleanedCount;
  }

  // Statistiques des bookings (admin)
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

  // Vérifier les incohérences entre Stripe et les réservations par session (retraite + date)
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
    summary: {
      totalDiscrepancies: number;
      sessionsWithIssues: number;
      retreatsWithIssues: number;
    };
  }> {
    logger.log(`🔍 [BookingsService] Vérification des incohérences de paiement par session (délai de grâce: ${gracePeriodMinutes}min)...`);

    // Calculer la date limite pour le délai de grâce
    const gracePeriodAgo = new Date(Date.now() - gracePeriodMinutes * 60 * 1000);

    // 1. Récupérer les PaymentIntent réussis de Stripe des 5 derniers jours
    const stripePayments = await this.stripeService.getSuccessfulPayments();
    
    logger.log(`📊 [BookingsService] Paiements Stripe récupérés (5 derniers jours):`, stripePayments.length);
    
    // 2. Récupérer SEULEMENT les bookings Stripe des 5 derniers jours
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    
    const allBookings = await this.bookingModel.find({
      createdAt: { 
        $gte: fiveDaysAgo
        // Supprimé: $lt: gracePeriodAgo pour inclure TOUS les bookings
      },
      isStripeBooking: true, // ← SEULEMENT les bookings créés via Stripe
      statut: 'CONFIRMED' // ← SEULEMENT les bookings confirmés (avec paiement)
    }).populate('retreatId', 'titreCard dates');

    logger.log(`📊 [BookingsService] Bookings Stripe récupérés (5 derniers jours):`, allBookings.length);

    // 3. Créer un mapping des paiements Stripe par stripePaymentIntentId
    const stripeByPaymentId = new Map<string, Stripe.PaymentIntent>();
    for (const payment of stripePayments) {
      stripeByPaymentId.set(payment.id, payment);
    }

    // 4. Créer un mapping des bookings par stripePaymentIntentId
    const bookingsByStripeId = new Map<string, any>();
    for (const booking of allBookings) {
      if (booking.stripePaymentIntentId) {
        bookingsByStripeId.set(booking.stripePaymentIntentId, booking);
      }
    }

    // 5. Détecter les paiements "orphelins" (sans booking correspondant)
    // Mais ignorer les paiements récents (délai de grâce)
    const orphanPayments = [];
    for (const [paymentId, payment] of stripeByPaymentId) {
      if (!bookingsByStripeId.has(paymentId)) {
        // Vérifier si le paiement est récent (délai de grâce)
        const paymentDate = new Date(payment.created * 1000);
        const isRecentPayment = paymentDate > gracePeriodAgo;
        
        if (isRecentPayment) {
          logger.log(`⏰ [BookingsService] Paiement récent ignoré (délai de grâce): ${paymentId}`);
          continue; // Ignorer les paiements récents
        }
        
        // Paiement sans booking correspondant (et pas récent)
        const retreatId = payment.metadata?.retreatId;
        const retreatName = payment.metadata?.retreatName || 'N/A';
        let sessionDate = payment.metadata?.sessionDate;
        
        // Extraire la date de session si pas disponible
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

    // 6. Calculer le résumé
    const summary = {
      totalDiscrepancies: orphanPayments.length,
      sessionsWithIssues: orphanPayments.length,
      retreatsWithIssues: new Set(orphanPayments.map(p => p.retreatId)).size
    };

    logger.log(`📊 [BookingsService] Incohérences détectées:`, summary);

    return {
      sessionDiscrepancies: orphanPayments,
      summary
    };
  }


  // Créer un booking manuellement par l'admin (non-Stripe)
  async createBookingByAdmin(createBookingDto: CreateBookingDto): Promise<Booking> {
    const { retreatId, nbPlaces, participants, billingAddress, notes, statut } = createBookingDto;
    
    // Conversion des dates string vers Date si nécessaire
    const dateStart = typeof createBookingDto.dateStart === 'string' 
      ? new Date(createBookingDto.dateStart) 
      : createBookingDto.dateStart;
    const dateEnd = typeof createBookingDto.dateEnd === 'string' 
      ? new Date(createBookingDto.dateEnd) 
      : createBookingDto.dateEnd;

    // Extraire le userId s'il est fourni (quand admin trouve un compte existant)
    const userId: string | null = (createBookingDto as any).userId || null;
    const isGuest = !userId; // Si pas de userId, c'est un invité

    logger.log('👨‍💼 [ADMIN] Création manuelle d\'un booking...', {
      retreatId,
      date: dateStart,
      nbPlaces,
      statut: statut || 'CONFIRMED',
      userId: userId ? `Associé à l'utilisateur ${userId}` : 'Invité (sans compte)',
      isGuest
    });

    // Vérifier que la retraite existe
    const retreat = await this.retreatModel.findById(retreatId).exec();
    if (!retreat) {
      throw new NotFoundException('Retraite non trouvée');
    }

    // Vérifier qu'il y a assez de places disponibles
    const placesDisponibles = await this.getAvailablePlaces(retreatId, dateStart);
    if (placesDisponibles < nbPlaces) {
      throw new ConflictException(`Seulement ${placesDisponibles} places disponibles`);
    }

    // Calculer le prix total
    const prixTotal = retreat.prix * nbPlaces;

    // Créer le booking avec isStripeBooking = false
    const booking = new this.bookingModel({
      userId: userId ? new Types.ObjectId(userId) : null, // Associer au compte si trouvé
      isGuest: isGuest, // false si utilisateur trouvé, true sinon
      isStripeBooking: false, // ← FALSE car créé manuellement par admin
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

    logger.log('✅ [ADMIN] Booking créé manuellement avec succès:', {
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