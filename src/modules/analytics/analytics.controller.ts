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

  // Je crée une session (sans authentification pour le tracking)
  @Post('session')
  @HttpCode(HttpStatus.CREATED)
  async createSession(@Body() createSessionDto: CreateSessionDto) {
    return this.analyticsService.createSession(createSessionDto);
  }

  // Je mets à jour une session (fin de session)
  @Patch('session/:sessionId')
  @HttpCode(HttpStatus.OK)
  async updateSession(
    @Param('sessionId') sessionId: string,
    @Body() updateSessionDto: UpdateSessionDto
  ) {
    return this.analyticsService.updateSession(sessionId, updateSessionDto);
  }

  // Je supprime une session (et ses événements via CASCADE)
  @Delete('session/:sessionId')
  @HttpCode(HttpStatus.OK)
  async deleteSession(@Param('sessionId') sessionId: string) {
    return this.analyticsService.deleteSession(sessionId);
  }

  // Je crée un événement utilisateur (sans authentification pour le tracking)
  @Post('event')
  @HttpCode(HttpStatus.CREATED)
  async createUserEvent(@Body() createUserEventDto: CreateUserEventDto) {
    return this.analyticsService.createUserEvent(createUserEventDto);
  }

  // Admin seulement
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('stats')
  async getStats() {
    return this.analyticsService.getStats();
  }

  // Admin seulement
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('event-types')
  async getEventTypes() {
    return this.analyticsService.getEventTypes();
  }

  // Admin seulement
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('clear-all')
  @HttpCode(HttpStatus.OK)
  async clearAllData() {
    return this.analyticsService.clearAllData();
  }
}

