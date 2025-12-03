import { 
  Controller, 
  Get, 
  Post,
  Put, 
  Delete, 
  Param, 
  Body, 
  Query,
  UseGuards,
  ForbiddenException
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UserDocument } from './users.schema';
import { logger } from '../../common/utils/logger';

@Controller('users')
@UseGuards(JwtAuthGuard) // Je protège toutes les routes avec JWT
export class UsersController {
  
  constructor(private readonly usersService: UsersService) {}

  // ROUTE : GET /users/profile
  // Je récupère le profil de l'utilisateur connecté
  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    // user contient les infos du JWT (sub, email, role)
    const userProfile = await this.usersService.findById(user.sub) as UserDocument;
    
    if (!userProfile) {
      throw new ForbiddenException('Utilisateur non trouvé');
    }
    
    // Je retourne le profil sans le mot de passe
    const { password: _password, ...profile } = userProfile.toObject();
    return profile;
  }

  // ROUTE : PUT /users/profile
  // Je mets à jour le profil de l'utilisateur connecté
  @Put('profile')
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateData: any
  ) {
    logger.log(`[UsersController] Demande de mise à jour du profil pour l'utilisateur: ${user.sub}`);
    logger.log(`[UsersController] Email utilisateur: ${user.email}`);
    logger.log(`[UsersController] Données reçues:`, {
      hasPasswordFields: !!(updateData.currentPassword || updateData.newPassword || updateData.confirmPassword),
      otherFields: Object.keys(updateData).filter(key => !['currentPassword', 'newPassword', 'confirmPassword'].includes(key))
    });

    try {
      // Je vérifie que l'utilisateur met à jour son propre profil
      const updatedUser = await this.usersService.updateProfile(user.sub, updateData) as UserDocument;
      
      if (!updatedUser) {
        logger.error(`[UsersController] Aucun utilisateur mis à jour trouvé pour l'ID: ${user.sub}`);
        throw new ForbiddenException('Erreur lors de la mise à jour');
      }
      
      logger.log(`[UsersController] Profil mis à jour avec succès pour: ${user.email}`);
      
      // Je retourne le profil mis à jour sans le mot de passe
      const { password: _password, ...profile } = updatedUser.toObject();
      logger.log(`[UsersController] Retour du profil mis à jour (sans mot de passe)`);
      
      return profile;
    } catch (error) {
      logger.error(`[UsersController] Erreur lors de la mise à jour du profil:`, error);
      throw error;
    }
  }

  // ROUTE : DELETE /users/profile
  // Je supprime le compte de l'utilisateur connecté
  @Delete('profile')
  async deleteProfile(@CurrentUser() user: any) {
    const deletedUser = await this.usersService.remove(user.sub);
    
    if (!deletedUser) {
      throw new ForbiddenException('Erreur lors de la suppression');
    }
    
    return { message: 'Compte supprimé avec succès' };
  }

  // ROUTE : GET /users
  // Je liste tous les utilisateurs (ADMIN SEULEMENT)
  @Get()
  @UseGuards(AdminGuard)
  async getAllUsers() {
    const users = await this.usersService.findAll();
    
    // Je retourne les utilisateurs sans les mots de passe
    return users.map(user => {
      const { password: _password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  // ROUTE : GET /users/:id
  // Je récupère un utilisateur par ID (ADMIN SEULEMENT)
  @Get(':id')
  @UseGuards(AdminGuard)
  async getUserById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    
    if (!user) {
      throw new ForbiddenException('Utilisateur non trouvé');
    }
    
    // Je retourne l'utilisateur sans le mot de passe
    const { password: _password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // ROUTE : DELETE /users/:id
  // Je supprime un utilisateur par ID (ADMIN SEULEMENT)
  @Delete(':id')
  @UseGuards(AdminGuard)
  async deleteUser(@Param('id') id: string) {
    const deletedUser = await this.usersService.remove(id);
    
    if (!deletedUser) {
      throw new ForbiddenException('Utilisateur non trouvé');
    }
    
    return { message: 'Utilisateur supprimé avec succès' };
  }

  // ROUTE : POST /users/validate-password
  // Je valide le mot de passe actuel de l'utilisateur connecté
  @Post('validate-password')
  @UseGuards(JwtAuthGuard)
  async validateCurrentPassword(
    @CurrentUser() user: any,
    @Body() body: { currentPassword: string }
  ) {
    logger.log(`[UsersController] Validation du mot de passe pour l'utilisateur: ${user.sub}`);
    logger.log(`[UsersController] Email utilisateur: ${user.email}`);
    logger.log(`[UsersController] Mot de passe fourni: ${body.currentPassword ? 'Oui' : 'Non'}`);

    try {
      const userProfile = await this.usersService.findById(user.sub);
      
      if (!userProfile) {
        logger.error(`[UsersController] Utilisateur non trouvé avec l'ID: ${user.sub}`);
        throw new ForbiddenException('Utilisateur non trouvé');
      }

      logger.log(`[UsersController] Utilisateur trouvé: ${userProfile.email}`);
      const isValid = await this.usersService.validatePassword(userProfile, body.currentPassword);
      
      logger.log(`[UsersController] Résultat validation: ${isValid ? 'Valide' : 'Invalide'} pour ${user.email}`);
      
      return { isValid };
    } catch (error) {
      logger.error(`[UsersController] Erreur lors de la validation du mot de passe:`, error);
      throw error;
    }
  }

  // ROUTE : GET /users/check-temporary/:email
  // Je vérifie le statut d'un utilisateur temporaire
  @Get('check-temporary/:email')
  async checkTemporaryUser(@Param('email') email: string) {
    return this.usersService.checkTemporaryUserStatus(email);
  }

  // ROUTE : GET /users/admin/search-by-email?email=xxx
  // Je recherche un utilisateur par email (ADMIN SEULEMENT)
  @Get('admin/search-by-email')
  @UseGuards(AdminGuard)
  async searchUserByEmail(@Query('email') email: string) {
    logger.log('[ADMIN] Recherche d\'utilisateur par email:', email);
    
    if (!email) {
      throw new ForbiddenException('Email requis');
    }

    const user = await this.usersService.findByEmail(email);
    
    if (!user) {
      return { found: false, user: null };
    }
    
    // Je convertis le document Mongoose en objet et je retourne sans le mot de passe
    const userObject = (user as any).toObject ? (user as any).toObject() : user;
    const { password: _password, ...userWithoutPassword } = userObject;
    
    logger.log('[ADMIN] Utilisateur trouvé et converti:', {
      firstName: userWithoutPassword.firstName,
      lastName: userWithoutPassword.lastName,
      email: userWithoutPassword.email
    });
    
    return { found: true, user: userWithoutPassword };
  }
}
