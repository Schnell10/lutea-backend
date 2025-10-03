import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from './users.service';

@Injectable()
export class UsersCronService {

  constructor(private readonly usersService: UsersService) {}

  // Nettoyage horaire des utilisateurs temporaires expirés
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

}
