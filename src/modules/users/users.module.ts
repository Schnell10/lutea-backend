import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema, TemporaryUser, TemporaryUserSchema } from './users.schema';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UsersCronService } from './users.cron';
import { EmailModule } from '../email/email.module';
import { AdminGuard } from '../../common/guards/admin.guard';

@Module({
  imports: [
    // Je configure les modèles MongoDB
    MongooseModule.forFeature([
      // Collection "users" pour les utilisateurs permanents
      { name: User.name, schema: UserSchema },
      // Collection "temporary_users" pour les inscriptions en attente
      { name: TemporaryUser.name, schema: TemporaryUserSchema }
    ]),
    
    // Module email pour l'envoi des codes 2FA et validation
    EmailModule
  ],
  
  // Services disponibles dans ce module
  providers: [
    UsersService,        // Service principal de gestion des utilisateurs
    UsersCronService,    // Service de nettoyage automatique
    AdminGuard           // Guard pour vérifier le rôle admin
  ],
  
  // Contrôleurs qui exposent les routes API
  controllers: [
    UsersController      // Routes pour la gestion des profils et admin
  ],
  
  // Services exportés pour être utilisés par d'autres modules
  exports: [
    UsersService        // Je permets à AuthModule d'utiliser UsersService
  ]
})
export class UsersModule {}
