import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BookingsService } from './bookings.service';
import { EmailService } from '../email/email.service';

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
      console.log('🧹 [Cron] Début du nettoyage des bookings expirés...');
      const cleanedCount = await this.bookingsService.cleanupExpiredBookings();
      
      if (cleanedCount > 0) {
        console.log(`🧹 [Cron] Nettoyage automatique: ${cleanedCount} bookings expirés supprimés définitivement`);
      } else {
        console.log('🧹 [Cron] Aucun booking expiré à supprimer');
      }
    } catch (error) {
      console.error('❌ [Cron] Erreur lors du nettoyage automatique des bookings:', error);
    }
  }

  // Vérifier les incohérences de paiement toutes les 30 secondes (pour test)
  @Cron('0 */30 * * * *') // Toutes les 30 secondes
  async checkPaymentDiscrepancies() {
    try {
      console.log('🔍 [Cron] Vérification automatique des incohérences de paiement...');
      
      // Vérifier avec un délai de grâce de 5 minutes pour éviter les fausses alertes
      const discrepancies = await this.bookingsService.checkPaymentDiscrepancies(5);
      
      if (discrepancies.summary.totalDiscrepancies > 0) {
        console.log(`🚨 [Cron] ${discrepancies.summary.totalDiscrepancies} incohérences détectées sur ${discrepancies.summary.sessionsWithIssues} sessions !`);
        
        // Construire le message d'alerte détaillé
        const alertMessage = this.buildAlertMessage(discrepancies);
        
        // Envoyer l'alerte par email
        await this.emailService.sendAdminAlert(
          '🚨 Incohérences de paiement détectées - Lutea',
          alertMessage
        );
        
        console.log('📧 [Cron] Alerte envoyée par email à l\'admin');
      } else {
        console.log('✅ [Cron] Aucune incohérence détectée');
      }
    } catch (error) {
      console.error('❌ [Cron] Erreur lors de la vérification des incohérences:', error);
    }
  }

  // Construire le message d'alerte détaillé
  private buildAlertMessage(discrepancies: any): string {
    let message = `🚨 ALERTE AUTOMATIQUE - Incohérences de paiement détectées\n\n`;
    message += `📊 RÉSUMÉ :\n`;
    message += `- Total des incohérences : ${discrepancies.summary.totalDiscrepancies}\n`;
    message += `- Sessions avec problèmes : ${discrepancies.summary.sessionsWithIssues}\n`;
    message += `- Retraites concernées : ${discrepancies.summary.retreatsWithIssues}\n\n`;

    if (discrepancies.sessionDiscrepancies && discrepancies.sessionDiscrepancies.length > 0) {
      message += `🚨 PAIEMENTS ORPHELINS (Sans booking correspondant) :\n`;
      discrepancies.sessionDiscrepancies.forEach((payment: any, index: number) => {
        message += `${index + 1}. ${payment.retreatName}\n`;
        message += `   📅 Date de session : ${payment.sessionDate}\n`;
        message += `   🆔 Retraite ID: ${payment.retreatId}\n`;
        message += `   💳 PaymentIntent ID: ${payment.paymentId}\n`;
        message += `   👤 Email client: ${payment.clientEmail}\n`;
        message += `   💰 Montant: ${(payment.amount / 100).toFixed(2)}€\n`;
        message += `   📅 Date paiement: ${payment.createdAt.toLocaleDateString('fr-FR')}\n\n`;
      });
    }

    message += `🔧 ACTION REQUISE :\n`;
    message += `Connectez-vous au dashboard admin pour corriger ces incohérences.\n`;
    message += `URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin\n\n`;
    message += `Cette alerte a été générée automatiquement par le système Lutea.`;

    return message;
  }
}
