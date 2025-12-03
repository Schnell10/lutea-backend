import { 
  Controller, 
  Post, 
  Body, 
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  Req
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import { BookingsService } from '../bookings/bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePaymentIntentDto, GetPaymentIntentDto } from './stripe.dto';
import { logger } from '../../common/utils/logger';

@Controller('stripe')
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly bookingsService: BookingsService,
  ) {}

  // Je crée un PaymentIntent (sans authentification requise)
  @Post('create-payment-intent')
  @HttpCode(HttpStatus.OK)
  async createPaymentIntent(@Body() createPaymentIntentDto: CreatePaymentIntentDto) {
    const { amount, currency, metadata } = createPaymentIntentDto;
    
    logger.log('[Stripe] Création du PaymentIntent...', { amount, currency, metadata });
    
    const paymentIntent = await this.stripeService.createPaymentIntent(amount, currency, metadata);
    
    // Je retourne seulement les données nécessaires pour le frontend
    return {
      clientSecret: paymentIntent.client_secret,
      id: paymentIntent.id
    };
  }

  // Je récupère un PaymentIntent
  @UseGuards(JwtAuthGuard)
  @Post('get-payment-intent')
  @HttpCode(HttpStatus.OK)
  async getPaymentIntent(@Body() getPaymentIntentDto: GetPaymentIntentDto) {
    const { paymentIntentId } = getPaymentIntentDto;
    return this.stripeService.getPaymentIntent(paymentIntentId);
  }

  // J'annule un PaymentIntent (sans authentification pour le tunnel de paiement)
  @Post('cancel-payment-intent')
  @HttpCode(HttpStatus.OK)
  async cancelPaymentIntent(
    @Body() body: { paymentIntentId: string }
  ): Promise<{ success: boolean; message: string }> {
    try {
      logger.log('[Stripe] Annulation du PaymentIntent:', body.paymentIntentId);
      
      await this.stripeService.cancelPaymentIntent(body.paymentIntentId);
      
      return {
        success: true,
        message: 'PaymentIntent annulé avec succès'
      };
    } catch (error) {
      logger.error('[Stripe] Erreur lors de l\'annulation:', error.message);
      return {
        success: false,
        message: `Erreur lors de l'annulation: ${error.message}`
      };
    }
  }

  // Je gère le webhook Stripe (pas d'authentification requise)
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string
  ): Promise<{ received: boolean }> {
    logger.log('[Webhook] Réception webhook...', { 
      hasBody: !!req.body, 
      hasSignature: !!signature,
      bodyType: typeof req.body,
      bodyLength: req.body ? req.body.length : 0
    });
    
    if (!signature) {
      logger.log('[Webhook] Signature manquante, requête ignorée');
      return { received: false };
    }

    // req.body est maintenant le raw body grâce au middleware Express
    const payload = req.body;
    
    if (!payload) {
      logger.error('[Webhook] Body manquant');
      return { received: false };
    }

    try {
      await this.stripeService.handleWebhook(payload, signature);
      logger.log('[Webhook] Webhook traité avec succès');
      return { received: true };
    } catch (error) {
      logger.error('[Webhook] Erreur lors du traitement:', error.message);
      return { received: false };
    }
  }

}
