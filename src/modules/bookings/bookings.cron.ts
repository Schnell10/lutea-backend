import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BookingsService } from './bookings.service';
import { EmailService } from '../email/email.service';
import { logger } from '../../common/utils/logger';

@Injectable()
export class BookingsCronService {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly emailService: EmailService
  ) {}

  // Nettoyer les bookings expirés toutes les 20 minutes 
  @Cron('0 */20 * * * *')
  async cleanupExpiredBookings() {
    try {
      logger.log('[Cron] Début du nettoyage des bookings expirés...');
      const cleanedCount = await this.bookingsService.cleanupExpiredBookings();
      
      if (cleanedCount > 0) {
        logger.log(`[Cron] Nettoyage automatique: ${cleanedCount} bookings expirés supprimés définitivement`);
      } else {
        logger.log('[Cron] Aucun booking expiré à supprimer');
      }
    } catch (error) {
      logger.error('[Cron] Erreur lors du nettoyage automatique des bookings:', error);
    }
  }

  // Vérifier les incohérences de paiement toutes les 6 heures
  @Cron('0 0 */6 * * *') // Toutes les 6 heures
  async checkPaymentDiscrepancies() {
    try {
      logger.log('[Cron] Vérification automatique des incohérences de paiement...');
      
      // Vérifier avec un délai de grâce de 5 minutes pour éviter les fausses alertes
      const discrepancies = await this.bookingsService.checkPaymentDiscrepancies(5);
      
      if (discrepancies.summary.totalDiscrepancies > 0) {
        logger.log(`[Cron] ${discrepancies.summary.totalDiscrepancies} incohérences détectées (${discrepancies.summary.orphanPaymentsCount || 0} paiements orphelins, ${discrepancies.summary.orphanBookingsCount || 0} bookings orphelins)`);
        
        // Construire le message d'alerte détaillé
        const alertMessage = this.buildAlertMessage(discrepancies);
        
        // Envoyer l'alerte par email
        await this.emailService.sendAdminAlert(
          'Incohérences de paiement détectées - Lutea',
          alertMessage
        );
        
        logger.log('[Cron] Alerte envoyée par email à l\'admin');
      } else {
        logger.log('[Cron] Aucune incohérence détectée');
      }
    } catch (error) {
      logger.error('[Cron] Erreur lors de la vérification des incohérences:', error);
    }
  }

  // Construire le message d'alerte détaillé
  private buildAlertMessage(discrepancies: any): string {
    let message = `<h2>Incohérences de paiement détectées</h2>\n\n`;
    message += `<p><strong>RESUME :</strong></p>\n`;
    message += `<ul>\n`;
    message += `<li>Total des incohérences : <strong>${discrepancies.summary.totalDiscrepancies}</strong></li>\n`;
    message += `<li>Paiements orphelins (sans booking) : <strong>${discrepancies.summary.orphanPaymentsCount || 0}</strong></li>\n`;
    message += `<li>Bookings orphelins (sans paiement valide) : <strong>${discrepancies.summary.orphanBookingsCount || 0}</strong></li>\n`;
    message += `</ul>\n\n`;

    // Paiements orphelins (Stripe sans booking)
    if (discrepancies.sessionDiscrepancies && discrepancies.sessionDiscrepancies.length > 0) {
      discrepancies.sessionDiscrepancies.forEach((payment: any, index: number) => {
        const paymentDate = payment.createdAt ? new Date(payment.createdAt).toLocaleString('fr-FR', { 
          dateStyle: 'short', 
          timeStyle: 'short' 
        }) : 'N/A';
        message += `<p><strong>Paiement Stripe sans booking #${index + 1}</strong><br>\n`;
        message += `Retraite: ${payment.retreatName}<br>\n`;
        message += `Date session: ${payment.sessionDate}<br>\n`;
        message += `Booking ID: N/A<br>\n`;
        message += `PaymentIntent: ${payment.paymentId}<br>\n`;
        message += `Email: ${payment.clientEmail}<br>\n`;
        message += `Date paiement: ${paymentDate}</p>\n\n`;
      });
    }

    // Bookings orphelins (booking sans paiement Stripe valide)
    if (discrepancies.bookingDiscrepancies && discrepancies.bookingDiscrepancies.length > 0) {
      discrepancies.bookingDiscrepancies.forEach((booking: any, index: number) => {
        const bookingDate = booking.createdAt ? new Date(booking.createdAt).toLocaleString('fr-FR', { 
          dateStyle: 'short', 
          timeStyle: 'short' 
        }) : 'N/A';
        message += `<p><strong>Booking sans paiement Stripe valide #${index + 1}</strong><br>\n`;
        message += `Retraite: ${booking.retreatName}<br>\n`;
        message += `Date session: ${booking.sessionDate}<br>\n`;
        message += `Booking ID: ${booking.bookingId}<br>\n`;
        message += `PaymentIntent: ${booking.paymentIntentId}<br>\n`;
        message += `Email: ${booking.clientEmail}<br>\n`;
        message += `Date paiement: ${bookingDate}</p>\n\n`;
      });
    }

    return message;
  }
}
