import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  Delete, 
  UseGuards,
  Request,
  Query,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
import { RetreatsService } from './retreats.service';
import { CreateRetreatDto, UpdateRetreatDto } from './dto/retreats.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';

@Controller('retreats')
export class RetreatsController {
  constructor(private readonly retreatsService: RetreatsService) {}

  // ROUTES PUBLIQUES (pour le frontend)
  
  @Get('public')
  async getPublicRetreats() {
    return this.retreatsService.findPublicRetreats();
  }

  @Get('public/:id')
  async getPublicRetreat(@Param('id') id: string) {
    return this.retreatsService.findById(id);
  }

  // ROUTES ADMIN (sécurisées)
  
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin')
  async getAllRetreats() {
    return this.retreatsService.findAll();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/:id')
  async getRetreatById(@Param('id') id: string) {
    return this.retreatsService.findById(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin')
  @HttpCode(HttpStatus.CREATED)
  async createRetreat(@Body() createRetreatDto: CreateRetreatDto) {
    return this.retreatsService.create(createRetreatDto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/:id')
  async updateRetreat(
    @Param('id') id: string,
    @Body() updateRetreatDto: UpdateRetreatDto
  ) {
    return this.retreatsService.update(id, updateRetreatDto);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('admin/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRetreat(@Param('id') id: string) {
    return this.retreatsService.remove(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/:id/toggle-active')
  async toggleRetreatActive(@Param('id') id: string) {
    return this.retreatsService.toggleActive(id);
  }


  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/:id/reserved-places')
  async getReservedPlaces(@Param('id') id: string, @Query('date') date?: string) {
    const dateObj = date ? new Date(date) : undefined;
    const placesReservees = await this.retreatsService.getReservedPlaces(id, dateObj);
    return { placesReservees };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/search')
  async searchRetreats(@Request() req: any) {
    const { titreCard, statut, prixMin, prixMax } = req.query;
    return this.retreatsService.searchRetreats({
      titreCard,
      statut,
      prixMin: prixMin ? parseInt(prixMin) : undefined,
      prixMax: prixMax ? parseInt(prixMax) : undefined,
    });
  }
}
