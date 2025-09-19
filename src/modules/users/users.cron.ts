// Import des fonctionnalités NATIVES de NestJS
import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

// Import de notre service utilisateur
import { UsersService } from './users.service';

@Injectable()
export class UsersCronService {

  constructor(private readonly usersService: UsersService) {
    console.log('⏰ [UsersCronService] Service de tâches automatiques initialisé');
  }

  // NETTOYAGE HOURLIER DES UTILISATEURS TEMPORAIRES EXPIRÉS
  // @Cron('0 * * * *') : Toutes les heures, à la minute 0
  @Cron(CronExpression.EVERY_HOUR)
  async handleCleanupExpiredTemporaryUsers() {
    console.log('🧹 [UsersCronService] Début du nettoyage horaire des utilisateurs temporaires...');
    
    try {
      const result = await this.usersService.cleanupExpiredTemporaryUsersWithLogs();
      console.log(`✅ [UsersCronService] Nettoyage horaire terminé: ${result.deletedCount} comptes supprimés`);
      
      if (result.cleanedEmails.length > 0) {
        console.log(`📧 [UsersCronService] Emails nettoyés: ${result.cleanedEmails.join(', ')}`);
      }
    } catch (error) {
      console.log(`❌ [UsersCronService] Erreur lors du nettoyage horaire:`, error.message);
    }
  }

  // NETTOYAGE QUOTIDIEN À 2H DU MATIN
  // @Cron('0 2 * * *') : Tous les jours à 2h00
  @Cron('0 2 * * *')
  async handleDailyCleanup() {
    console.log('🌅 [UsersCronService] Début du nettoyage quotidien des utilisateurs temporaires...');
    
    try {
      const result = await this.usersService.cleanupExpiredTemporaryUsersWithLogs();
      console.log(`✅ [UsersCronService] Nettoyage quotidien terminé: ${result.deletedCount} comptes supprimés`);
      
      if (result.cleanedEmails.length > 0) {
        console.log(`📧 [UsersCronService] Emails nettoyés: ${result.cleanedEmails.join(', ')}`);
      }
    } catch (error) {
      console.log(`❌ [UsersCronService] Erreur lors du nettoyage quotidien:`, error.message);
    }
  }
}
