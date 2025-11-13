import { 
  Controller, 
  Post, 
  Get,
  Body, 
  Patch,
  Delete,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CreateSessionDto, UpdateSessionDto, CreateUserEventDto } from './dto/analytics.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { logger } from '../../common/utils/logger';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  // Créer une session (sans authentification pour le tracking)
  @Post('session')
  @HttpCode(HttpStatus.CREATED)
  async createSession(@Body() createSessionDto: CreateSessionDto) {
    return this.analyticsService.createSession(createSessionDto);
  }

  // Mettre à jour une session (fin de session)
  @Patch('session/:sessionId')
  @HttpCode(HttpStatus.OK)
  async updateSession(
    @Param('sessionId') sessionId: string,
    @Body() updateSessionDto: UpdateSessionDto
  ) {
    return this.analyticsService.updateSession(sessionId, updateSessionDto);
  }

  // Supprimer une session (et ses événements via CASCADE)
  @Delete('session/:sessionId')
  @HttpCode(HttpStatus.OK)
  async deleteSession(@Param('sessionId') sessionId: string) {
    return this.analyticsService.deleteSession(sessionId);
  }

  // Créer un événement utilisateur (sans authentification pour le tracking)
  @Post('event')
  @HttpCode(HttpStatus.CREATED)
  async createUserEvent(@Body() createUserEventDto: CreateUserEventDto) {
    return this.analyticsService.createUserEvent(createUserEventDto);
  }

  // Récupérer les statistiques (admin seulement)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('stats')
  async getStats() {
    logger.log('📊 [Analytics] Récupération statistiques');
    return this.analyticsService.getStats();
  }

  // Récupérer les types d'événements (admin seulement)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('event-types')
  async getEventTypes() {
    logger.log('📊 [Analytics] Récupération types d\'événements');
    return this.analyticsService.getEventTypes();
  }

  // Vider toute la base de données analytics (admin seulement)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('clear-all')
  @HttpCode(HttpStatus.OK)
  async clearAllData() {
    logger.log('🗑️ [Analytics] Demande de vidage de la base de données');
    return this.analyticsService.clearAllData();
  }
}

