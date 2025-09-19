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

export interface CreateBookingDto {
  retreatId: string;
  dateStart: Date;
  dateEnd: Date;
  nbPlaces: number;
  participants: Array<{
    prenom: string;
    nom: string;
    email: string;
  }>;
  billingAddress: {
    address: string;
    city: string;
    postalCode: string;
    country: string;
    phone: string;
  };
  notes?: string;
  statut?: string;
}

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
    const { retreatId, dateStart, dateEnd, nbPlaces, participants, billingAddress, notes, statut } = createBookingDto;

    // 🎯 LOG DÉTAILLÉ POUR LA CRÉATION DE BOOKING
    console.log('🎯 ===========================================');
    console.log('🎯 [BOOKING] DÉBUT DE CRÉATION');
    console.log('🎯 ===========================================');
    console.log('🎯 Retreat ID:', retreatId);
    console.log('🎯 Date:', dateStart);
    console.log('🎯 Nombre de places:', nbPlaces);
    console.log('🎯 Utilisateur:', userId ? `Connecté (${userId})` : 'Anonyme');
    console.log('🎯 Statut demandé:', statut);
    console.log('🎯 Participants:', participants.length);
    console.log('🎯 Email principal:', participants[0]?.email);
    console.log('🎯 ===========================================');

    // Vérifier que la retraite existe
    const retreat = await this.retreatModel.findById(retreatId).exec();
    if (!retreat) {
      console.error('❌ [BOOKING] Retraite non trouvée:', retreatId);
      throw new NotFoundException('Retraite non trouvée');
    }

    console.log('✅ [BOOKING] Retraite trouvée:', {
      titreCard: retreat.titreCard,
      prix: retreat.prix,
      capaciteMax: retreat.places
    });
    
    // 🎯 LOG DÉTAILLÉ POUR LA RETRAITE
    console.log('🎯 ===========================================');
    console.log('🎯 [BOOKING] RETRAITE VALIDÉE');
    console.log('🎯 ===========================================');
    console.log('🎯 Titre:', retreat.titreCard);
    console.log('🎯 Prix unitaire:', retreat.prix, '€');
    console.log('🎯 Capacité max:', retreat.places, 'places');
    console.log('🎯 ===========================================');

    // Vérifier que l'utilisateur existe (seulement si connecté)
    if (userId) {
      const user = await this.userModel.findById(userId).exec();
      if (!user) {
        console.error('❌ [BOOKING] Utilisateur non trouvé:', userId);
        throw new NotFoundException('Utilisateur non trouvé');
      }
      console.log('✅ [BOOKING] Utilisateur connecté:', {
        userId,
        email: user.email
      });
    } else {
      console.log('ℹ️ [BOOKING] Utilisateur non connecté - booking anonyme');
    }

    // Vérifier qu'il y a assez de places disponibles
    const placesDisponibles = await this.getAvailablePlaces(retreatId, dateStart);
    if (placesDisponibles < nbPlaces) {
      console.error('❌ [BOOKING] Pas assez de places:', {
        placesDisponibles,
        nbPlacesDemandees: nbPlaces
      });
      throw new ConflictException(`Seulement ${placesDisponibles} places disponibles`);
    }

    // Calculer le prix total
    const prixTotal = retreat.prix * nbPlaces;

    console.log('💰 [BOOKING] Calcul du prix:', {
      prixUnitaire: retreat.prix,
      nbPlaces,
      prixTotal
    });
    
    // 🎯 LOG DÉTAILLÉ POUR LE CALCUL DU PRIX
    console.log('🎯 ===========================================');
    console.log('🎯 [BOOKING] CALCUL DU PRIX');
    console.log('🎯 ===========================================');
    console.log('🎯 Prix unitaire:', retreat.prix, '€');
    console.log('🎯 Nombre de places:', nbPlaces);
    console.log('🎯 Prix total:', prixTotal, '€');
    console.log('🎯 ===========================================');

    // Créer le booking (avec ou sans userId)
    const booking = new this.bookingModel({
      userId: userId ? new Types.ObjectId(userId) : null,
      isGuest: !userId, // true si pas d'userId (client anonyme)
      retreatId: new Types.ObjectId(retreatId),
      dateStart,
      dateEnd,
      nbPlaces,
      prixTotal,
      participants: participants,
      billingAddress: billingAddress,
      statut: (statut as BookingStatus) || BookingStatus.PENDING,
      statutPaiement: PaymentStatus.PENDING,
      notes: notes || '',
    });

    const savedBooking = await booking.save();

    console.log('✅ [BOOKING] Booking créé avec succès:', {
      bookingId: savedBooking._id,
      retreatId,
      nbPlaces,
      prixTotal,
      statut: savedBooking.statut,
      userId: savedBooking.userId ? 'Connecté' : 'Anonyme'
    });
    
    // 🎯 LOG DÉTAILLÉ POUR LA CRÉATION RÉUSSIE
    console.log('🎯 ===========================================');
    console.log('🎯 [BOOKING] CRÉATION RÉUSSIE');
    console.log('🎯 ===========================================');
    console.log('🎯 Booking ID:', savedBooking._id);
    console.log('🎯 Statut:', savedBooking.statut);
    console.log('🎯 Statut paiement:', savedBooking.statutPaiement);
    console.log('🎯 Nombre de places:', savedBooking.nbPlaces);
    console.log('🎯 Prix total:', savedBooking.prixTotal, '€');
    console.log('🎯 Utilisateur:', savedBooking.userId ? 'Connecté' : 'Anonyme');
    console.log('🎯 Date création:', (savedBooking as any).createdAt);
    console.log('🎯 ===========================================');

    return savedBooking;
  }


  // Valider un booking après paiement réussi
  async confirmBooking(bookingId: string, stripePaymentIntentId: string): Promise<Booking> {
    // 🎯 LOG DÉTAILLÉ POUR LA CONFIRMATION DE BOOKING
    console.log('🎯 ===========================================');
    console.log('🎯 [BOOKING] DÉBUT DE CONFIRMATION');
    console.log('🎯 ===========================================');
    console.log('🎯 Booking ID:', bookingId);
    console.log('🎯 PaymentIntent ID:', stripePaymentIntentId);
    console.log('🎯 ===========================================');
    
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
    console.log('🎯 ===========================================');
    console.log('🎯 [BOOKING] ÉTAT AVANT CONFIRMATION');
    console.log('🎯 ===========================================');
    console.log('🎯 Booking ID:', booking._id);
    console.log('🎯 Statut actuel:', booking.statut);
    console.log('🎯 Statut paiement actuel:', booking.statutPaiement);
    console.log('🎯 Nombre de places:', booking.nbPlaces);
    console.log('🎯 Prix total:', booking.prixTotal, '€');
    console.log('🎯 ===========================================');

    booking.statut = BookingStatus.CONFIRMED;
    booking.statutPaiement = PaymentStatus.PAID;
    booking.stripePaymentIntentId = stripePaymentIntentId;

    const confirmedBooking = await booking.save();
    
    // 🎯 LOG DÉTAILLÉ POUR LA CONFIRMATION RÉUSSIE
    console.log('🎯 ===========================================');
    console.log('🎯 [BOOKING] CONFIRMATION RÉUSSIE');
    console.log('🎯 ===========================================');
    console.log('🎯 Booking ID:', confirmedBooking._id);
    console.log('🎯 Nouveau statut:', confirmedBooking.statut);
    console.log('🎯 Nouveau statut paiement:', confirmedBooking.statutPaiement);
    console.log('🎯 PaymentIntent ID:', confirmedBooking.stripePaymentIntentId);
    console.log('🎯 Nombre de places:', confirmedBooking.nbPlaces);
    console.log('🎯 Prix total:', confirmedBooking.prixTotal, '€');
    console.log('🎯 ===========================================');

    // Générer et envoyer le PDF de confirmation
    try {
      console.log('📄 [PDF] Génération du PDF de confirmation...');
      
      // Récupérer les données de la retraite
      const retreat = await this.retreatModel.findById(confirmedBooking.retreatId).exec();
      if (!retreat) {
        console.error('❌ [PDF] Retraite non trouvée pour la génération du PDF');
        return confirmedBooking;
      }

      // Générer le PDF
      const pdfBuffer = await this.pdfGeneratorService.generateConfirmationPdf(confirmedBooking, retreat);
      console.log('✅ [PDF] PDF généré avec succès');
      
      // Envoyer l'email avec le PDF
      console.log('📧 [EMAIL] Envoi de la confirmation par email...');
      const emailSent = await this.emailService.sendBookingConfirmation(confirmedBooking, retreat, pdfBuffer);
      
      if (emailSent) {
        console.log('✅ [EMAIL] Confirmation envoyée avec succès');
      } else {
        console.error('❌ [EMAIL] Échec de l\'envoi de la confirmation');
      }
      
    } catch (error) {
      console.error('❌ [PDF/EMAIL] Erreur lors de la génération/envoi:', error);
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

  // Récupérer les bookings d'un utilisateur
  async findUserBookings(userId: string): Promise<Booking[]> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new BadRequestException('ID d\'utilisateur invalide');
    }

    return this.bookingModel
      .find({ userId: new Types.ObjectId(userId) })
      .populate('retreatId', 'nom prix')
      .sort({ createdAt: -1 })
      .exec();
  }

  // Calculer les places disponibles pour une retraite
  async getAvailablePlaces(retreatId: string, date: Date): Promise<number> {
    // Convertir la date en objet Date si ce n'est pas déjà le cas
    const dateObj = date instanceof Date ? date : new Date(date);
    
    console.log(`🔍 [PLACES] Vérification des places disponibles...`, {
      retreatId,
      date: dateObj.toISOString(),
      timestamp: new Date().toISOString()
    });

    if (!Types.ObjectId.isValid(retreatId)) {
      console.error('❌ [PLACES] ID de retraite invalide:', retreatId);
      throw new BadRequestException('ID de retraite invalide');
    }

    const retreat = await this.retreatModel.findById(retreatId).exec();
    if (!retreat) {
      console.error('❌ [PLACES] Retraite non trouvée:', retreatId);
      throw new NotFoundException('Retraite non trouvée');
    }

    console.log(`📋 [PLACES] Retraite trouvée:`, {
      titreCard: retreat.titreCard,
      capaciteMax: retreat.places
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
    const placesDisponibles = retreat.places - totalPlacesReservees;

    console.log(`✅ [PLACES] Calcul terminé:`, {
      capaciteMax: retreat.places,
      placesReservees: totalPlacesReservees,
      placesDisponibles: Math.max(0, placesDisponibles),
      retraite: retreat.titreCard
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
    console.log('🔍 [Cleanup] Recherche des bookings créés avant:', fifteenMinutesAgo.toISOString());
    
    // Trouver les réservations expirées
    const expiredBookings = await this.bookingModel.find({
      statut: BookingStatus.PENDING,
      statutPaiement: PaymentStatus.PENDING,
      createdAt: { $lt: fifteenMinutesAgo }
    });
    
    console.log('🔍 [Cleanup] Bookings expirés trouvés:', expiredBookings.length);

    let cleanedCount = 0;

    for (const booking of expiredBookings) {
      try {
        // 1. D'ABORD : Annuler le PaymentIntent chez Stripe
        if (booking.stripePaymentIntentId) {
          try {
            await this.stripeService.cancelPaymentIntent(booking.stripePaymentIntentId);
            console.log(`✅ PaymentIntent ${booking.stripePaymentIntentId} annulé chez Stripe`);
          } catch (error) {
            console.error(`❌ Erreur annulation PaymentIntent ${booking.stripePaymentIntentId}:`, error);
            // Continue même si l'annulation Stripe échoue
          }
        }

        // 2. ENSUITE : Supprimer complètement la réservation côté Lutea
        await this.bookingModel.findByIdAndDelete(booking._id);

        console.log(`✅ Réservation ${booking._id.toString()} supprimée définitivement`);
        cleanedCount++;

      } catch (error) {
        console.error(`❌ Erreur lors du nettoyage de la réservation ${booking._id.toString()}:`, error);
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
    console.log(`🔍 [BookingsService] Vérification des incohérences de paiement par session (délai de grâce: ${gracePeriodMinutes}min)...`);

    // Calculer la date limite pour le délai de grâce
    const gracePeriodAgo = new Date(Date.now() - gracePeriodMinutes * 60 * 1000);

    // 1. Récupérer les PaymentIntent réussis de Stripe des 5 derniers jours
    const stripePayments = await this.stripeService.getSuccessfulPayments();
    
    console.log(`📊 [BookingsService] Paiements Stripe récupérés (5 derniers jours):`, stripePayments.length);
    
    // 2. Récupérer les bookings des 5 derniers jours (peu importe la date de la retraite)
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    
    const allBookings = await this.bookingModel.find({
      createdAt: { 
        $gte: fiveDaysAgo,
        $lt: gracePeriodAgo 
      }
    }).populate('retreatId', 'titreCard dates');

    console.log(`📊 [BookingsService] Bookings récupérés (5 derniers jours):`, allBookings.length);

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
    const orphanPayments = [];
    for (const [paymentId, payment] of stripeByPaymentId) {
      if (!bookingsByStripeId.has(paymentId)) {
        // Paiement sans booking correspondant
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

    console.log(`📊 [BookingsService] Incohérences détectées:`, summary);

    return {
      sessionDiscrepancies: orphanPayments,
      summary
    };
  }

  // Confirmer manuellement une réservation avec un PaymentIntent Stripe
  async manuallyConfirmBooking(bookingId: string, stripePaymentIntentId: string): Promise<Booking> {
    console.log(`✅ [BookingsService] Confirmation manuelle de la réservation ${bookingId} avec PaymentIntent ${stripePaymentIntentId}`);

    const booking = await this.bookingModel.findById(bookingId);
    if (!booking) {
      throw new NotFoundException('Réservation non trouvée');
    }

    if (booking.statut !== BookingStatus.PENDING) {
      throw new BadRequestException('Cette réservation n\'est pas en attente');
    }

    // Vérifier que le PaymentIntent existe et est réussi
    const paymentIntent = await this.stripeService.getPaymentIntent(stripePaymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      throw new BadRequestException('Le PaymentIntent n\'est pas réussi');
    }

    // Confirmer la réservation
    booking.statut = BookingStatus.CONFIRMED;
    booking.statutPaiement = PaymentStatus.PAID;
    booking.stripePaymentIntentId = stripePaymentIntentId;
    (booking as any).confirmationDate = new Date();

    await booking.save();

    console.log(`✅ [BookingsService] Réservation ${bookingId} confirmée manuellement`);

    return booking;
  }

  // Supprimer un booking par ID (pour annulation manuelle)
  async deleteBooking(id: string): Promise<boolean> {
    try {
      const result = await this.bookingModel.findByIdAndDelete(id);
      if (!result) {
        throw new NotFoundException('Booking non trouvé');
      }
      console.log(`✅ [BookingsService] Booking ${id} supprimé avec succès`);
      return true;
    } catch (error) {
      console.error(`❌ [BookingsService] Erreur lors de la suppression du booking ${id}:`, error);
      throw error;
    }
  }
}