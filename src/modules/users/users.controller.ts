// Import des fonctionnalités NATIVES de NestJS
import { 
  Controller, 
  Get, 
  Put, 
  Delete, 
  Param, 
  Body, 
  UseGuards,
  ForbiddenException
} from '@nestjs/common';

// Import de nos guards personnalisés
import { AdminGuard } from '../../common/guards';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// Import de nos décorateurs personnalisés
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// Import de nos services et DTOs
import { UsersService } from './users.service';
import { UserDocument } from './users.schema';

@Controller('users')
@UseGuards(JwtAuthGuard) // Protection JWT sur toutes les routes
export class UsersController {
  
  constructor(private readonly usersService: UsersService) {}

  // ROUTE : GET /users/profile
  // Récupère le profil de l'utilisateur connecté
  @Get('profile')
  async getProfile(@CurrentUser() user: any) {
    // user contient les infos du JWT (sub, email, role)
    const userProfile = await this.usersService.findById(user.sub) as UserDocument;
    
    if (!userProfile) {
      throw new ForbiddenException('Utilisateur non trouvé');
    }
    
    // Retourner le profil sans le mot de passe
    const { password: _password, ...profile } = userProfile.toObject();
    return profile;
  }

  // ROUTE : PUT /users/profile
  // Met à jour le profil de l'utilisateur connecté
  @Put('profile')
  async updateProfile(
    @CurrentUser() user: any,
    @Body() updateData: any
  ) {
    // Vérifier que l'utilisateur met à jour son propre profil
    const updatedUser = await this.usersService.updateProfile(user.sub, updateData) as UserDocument;
    
    if (!updatedUser) {
      throw new ForbiddenException('Erreur lors de la mise à jour');
    }
    
    // Retourner le profil mis à jour sans le mot de passe
    const { password: _password, ...profile } = updatedUser.toObject();
    return profile;
  }

  // ROUTE : DELETE /users/profile
  // Supprime le compte de l'utilisateur connecté
  @Delete('profile')
  async deleteProfile(@CurrentUser() user: any) {
    const deletedUser = await this.usersService.remove(user.sub);
    
    if (!deletedUser) {
      throw new ForbiddenException('Erreur lors de la suppression');
    }
    
    return { message: 'Compte supprimé avec succès' };
  }

  // ROUTE : GET /users
  // Liste tous les utilisateurs (ADMIN SEULEMENT)
  @Get()
  @UseGuards(AdminGuard)
  async getAllUsers() {
    const users = await this.usersService.findAll();
    
    // Retourner les utilisateurs sans les mots de passe
    return users.map(user => {
      const { password: _password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
  }

  // ROUTE : GET /users/:id
  // Récupère un utilisateur par ID (ADMIN SEULEMENT)
  @Get(':id')
  @UseGuards(AdminGuard)
  async getUserById(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    
    if (!user) {
      throw new ForbiddenException('Utilisateur non trouvé');
    }
    
    // Retourner l'utilisateur sans le mot de passe
    const { password: _password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  // ROUTE : DELETE /users/:id
  // Supprime un utilisateur par ID (ADMIN SEULEMENT)
  @Delete(':id')
  @UseGuards(AdminGuard)
  async deleteUser(@Param('id') id: string) {
    const deletedUser = await this.usersService.remove(id);
    
    if (!deletedUser) {
      throw new ForbiddenException('Utilisateur non trouvé');
    }
    
    return { message: 'Utilisateur supprimé avec succès' };
  }

  // ROUTE : GET /users/check-temporary/:email
  // Vérifie le statut d'un utilisateur temporaire
  @Get('check-temporary/:email')
  async checkTemporaryUser(@Param('email') email: string) {
    return this.usersService.checkTemporaryUserStatus(email);
  }
}
