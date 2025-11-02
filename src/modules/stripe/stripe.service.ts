import { Injectable, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { BookingsService } from '../bookings/bookings.service';
import { stripeConfig } from '../../config/stripe.config';
import { logger } from '../../common/utils/logger';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    private configService: ConfigService,
    @Inject(forwardRef(() => BookingsService)) private bookingsService: BookingsService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY non trouvée dans les variables d\'environnement');
    }

    this.stripe = new Stripe(
      secretKey,
      {
        apiVersion: stripeConfig.payment.apiVersion as any,
      }
    );
  }

  // Créer un PaymentIntent
  async createPaymentIntent(amount: number, currency: string = stripeConfig.payment.currency, metadata: any = {}): Promise<Stripe.PaymentIntent> {
    try {
      // 🎯 LOG DÉTAILLÉ POUR LA CRÉATION DE PAYMENTINTENT
      logger.log('🎯 ===========================================');
      logger.log('🎯 [STRIPE] DÉBUT DE CRÉATION PAYMENTINTENT');
      logger.log('🎯 ===========================================');
      logger.log('🎯 Montant:', amount, 'centimes');
      logger.log('🎯 Montant en euros:', (amount / 100), '€');
      logger.log('🎯 Devise:', currency);
      logger.log('🎯 Booking ID:', metadata.bookingId);
      logger.log('🎯 Retreat ID:', metadata.retreatId);
      logger.log('🎯 Nom retraite:', metadata.retreatName);
      logger.log('🎯 Email client:', metadata.clientEmail);
      logger.log('🎯 Nombre de places:', metadata.nbPlaces);
      logger.log('🎯 ===========================================');
      
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amount, // Le montant est déjà en centimes depuis le frontend
        currency,
        metadata: {
          ...metadata,
          ...stripeConfig.paymentIntent.metadata,
        },
        automatic_payment_methods: stripeConfig.paymentIntent.automaticPaymentMethods,
      });

      // 🎯 LOG DÉTAILLÉ POUR LA CRÉATION RÉUSSIE
      logger.log('🎯 ===========================================');
      logger.log('🎯 [STRIPE] PAYMENTINTENT CRÉÉ AVEC SUCCÈS');
      logger.log('🎯 ===========================================');
      logger.log('🎯 PaymentIntent ID:', paymentIntent.id);
      logger.log('🎯 Statut:', paymentIntent.status);
      logger.log('🎯 Montant:', (amount/100) + '€');
      logger.log('🎯 Devise:', paymentIntent.currency);
      logger.log('🎯 Booking ID:', metadata.bookingId);
      logger.log('🎯 Client Secret:', paymentIntent.client_secret ? '✅ Oui' : '❌ Non');
      logger.log('🎯 ===========================================');
      return paymentIntent;
    } catch (error) {
      logger.error('❌ [STRIPE] Erreur lors de la création du PaymentIntent:', error.message);
      throw new BadRequestException(`Erreur lors de la création du PaymentIntent: ${error.message}`);
    }
  }

  // Récupérer un PaymentIntent par ID
  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      throw new BadRequestException(`Erreur lors de la récupération du PaymentIntent: ${error.message}`);
    }
  }

  // Annuler un PaymentIntent
  async cancelPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      logger.log('🚫 [STRIPE] Annulation de la session de paiement...', {
        paymentIntentId,
        timestamp: new Date().toISOString()
      });
      
      const cancelledPaymentIntent = await this.stripe.paymentIntents.cancel(paymentIntentId);
      
      logger.log('✅ [STRIPE] Session de paiement annulée avec succès !', {
        paymentIntentId,
        statut: cancelledPaymentIntent.status,
        montant: (cancelledPaymentIntent.amount/100) + '€'
      });
      
      return cancelledPaymentIntent;
    } catch (error) {
      logger.error('❌ [STRIPE] Erreur lors de l\'annulation du PaymentIntent:', error.message);
      throw new BadRequestException(`Erreur lors de l'annulation du PaymentIntent: ${error.message}`);
    }
  }

  // Traiter un webhook Stripe
  async handleWebhook(payload: string, signature: string): Promise<void> {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      throw new BadRequestException('STRIPE_WEBHOOK_SECRET non trouvée dans les variables d\'environnement');
    }
    
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      throw new BadRequestException(`Erreur de signature webhook: ${error.message}`);
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentIntentSucceeded(event.data.object);
        break;
      
      case 'payment_intent.payment_failed':
        await this.handlePaymentIntentFailed(event.data.object);
        break;
      
      default:
        logger.log(`Événement webhook non géré: ${event.type}`);
    }
  }

  // Gérer un paiement réussi
  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.Event.Data.Object): Promise<void> {
    const pi = paymentIntent as Stripe.PaymentIntent;
    const bookingId = pi.metadata.bookingId;
    
    // 🎯 LOG DÉTAILLÉ POUR LE WEBHOOK DE PAIEMENT RÉUSSI
    logger.log('🎯 ===========================================');
    logger.log('🎯 [WEBHOOK] PAIEMENT RÉUSSI REÇU');
    logger.log('🎯 ===========================================');
    logger.log('🎯 PaymentIntent ID:', pi.id);
    logger.log('🎯 Booking ID:', bookingId);
    logger.log('🎯 Montant:', (pi.amount / 100) + '€');
    logger.log('🎯 Devise:', pi.currency);
    logger.log('🎯 Email client:', pi.metadata.clientEmail || 'Non fourni');
    logger.log('🎯 Nom retraite:', pi.metadata.retreatName || 'Non fourni');
    logger.log('🎯 ===========================================');
    
    if (!bookingId) {
      logger.error('❌ [WEBHOOK] Aucun bookingId trouvé dans les métadonnées du PaymentIntent');
      return;
    }

    try {
      await this.bookingsService.confirmBooking(bookingId, pi.id);
      
      // 🎯 LOG DÉTAILLÉ POUR LA CONFIRMATION RÉUSSIE
      logger.log('🎯 ===========================================');
      logger.log('🎯 [WEBHOOK] BOOKING CONFIRMÉ AVEC SUCCÈS');
      logger.log('🎯 ===========================================');
      logger.log('🎯 Booking ID:', bookingId);
      logger.log('🎯 PaymentIntent ID:', pi.id);
      logger.log('🎯 Montant payé:', (pi.amount / 100) + '€');
      logger.log('🎯 Email client:', pi.metadata.clientEmail || 'Non fourni');
      logger.log('🎯 ===========================================');
    } catch (error) {
      logger.error(`❌ [WEBHOOK] Erreur lors de la confirmation du booking ${bookingId}:`, error);
    }
  }

  // Gérer un échec de paiement
  private async handlePaymentIntentFailed(paymentIntent: Stripe.Event.Data.Object): Promise<void> {
    const pi = paymentIntent as Stripe.PaymentIntent;
    const bookingId = pi.metadata.bookingId;
    
    if (!bookingId) {
      logger.error('Aucun bookingId trouvé dans les métadonnées du PaymentIntent');
      return;
    }

    try {
      await this.bookingsService.cancelBooking(bookingId, 'Échec de paiement Stripe');
      logger.log(`Booking ${bookingId} annulé suite à un échec de paiement`);
    } catch (error) {
      logger.error(`Erreur lors de l'annulation du booking ${bookingId}:`, error);
    }
  }

  // Récupérer les informations d'un client Stripe
  async getCustomer(customerId: string): Promise<Stripe.Customer> {
    try {
      return await this.stripe.customers.retrieve(customerId) as Stripe.Customer;
    } catch (error) {
      throw new BadRequestException(`Erreur lors de la récupération du client: ${error.message}`);
    }
  }

  // Créer un client Stripe
  async createCustomer(email: string, name?: string): Promise<Stripe.Customer> {
    try {
      return await this.stripe.customers.create({
        email,
        name,
        metadata: stripeConfig.customer.defaultMetadata,
      });
    } catch (error) {
      throw new BadRequestException(`Erreur lors de la création du client: ${error.message}`);
    }
  }

  // Récupérer tous les PaymentIntent réussis (5 derniers jours - pour l'admin)
  async getSuccessfulPayments(): Promise<Stripe.PaymentIntent[]> {
    logger.log('🔍 [StripeService] Récupération des paiements réussis...');
    
    try {
      const paymentIntents = await this.stripe.paymentIntents.list({
        limit: 100, // Limite pour éviter les timeouts
        created: {
          gte: Math.floor((Date.now() - 5 * 24 * 60 * 60 * 1000) / 1000) // 5 derniers jours
        }
      });

    // Filtrer seulement les paiements réussis ET non remboursés
    const successfulPayments = [];
    
    for (const pi of paymentIntents.data) {
      if (pi.status === 'succeeded' && pi.amount_received > 0) {
        // Vérifier s'il y a des remboursements pour ce PaymentIntent
        try {
          const refunds = await this.stripe.refunds.list({
            payment_intent: pi.id,
            limit: 1
          });
          
          const hasRefunds = refunds.data.length > 0;
          
          logger.log(`🔍 [DEBUG] PaymentIntent ${pi.id}:`, {
            status: pi.status,
            amount: pi.amount,
            amount_received: pi.amount_received,
            hasRefunds,
            willInclude: !hasRefunds
          });
          
          if (!hasRefunds) {
            successfulPayments.push(pi);
          }
        } catch (error) {
          logger.error(`❌ Erreur vérification remboursements pour ${pi.id}:`, error);
        }
      }
    }

    logger.log(`📊 [StripeService] ${successfulPayments.length} paiements réussis trouvés (sans remboursements)`);
    logger.log(`🔍 [StripeService] Détail des paiements filtrés:`, successfulPayments.map(p => ({ id: p.id, amount: p.amount, amount_received: p.amount_received })));
    return successfulPayments;
    } catch (error) {
      logger.error('❌ [StripeService] Erreur lors de la récupération des paiements:', error);
      throw new BadRequestException(`Erreur lors de la récupération des paiements: ${error.message}`);
    }
  }

}
