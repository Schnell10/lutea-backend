import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Delete,
  Param, 
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import type { CreateBookingDto } from './bookings.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { EmailService } from '../email/email.service';

@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly emailService: EmailService
  ) {}

  // ROUTES CLIENT (sécurisées)

  // Vérifier les places disponibles (sans authentification pour le tunnel de paiement)
  @Post('available-places')
  @HttpCode(HttpStatus.OK)
  async getAvailablePlaces(
    @Body() body: { retreatId: string; date: string }
  ): Promise<{ placesDisponibles: number }> {
    try {
      console.log('🔍 [PLACES] Vérification des places disponibles...', {
        retreatId: body.retreatId,
        date: body.date
      });

      const placesDisponibles = await this.bookingsService.getAvailablePlaces(
        body.retreatId,
        new Date(body.date)
      );

      console.log('✅ [PLACES] Places disponibles:', placesDisponibles);

      return { placesDisponibles };
    } catch (error) {
      console.error('❌ [PLACES] Erreur lors de la vérification:', error.message);
      throw error;
    }
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createBooking(@Body() createBookingDto: CreateBookingDto, @Request() req: any) {
    // Récupérer l'userId si l'utilisateur est connecté, sinon null
    const userId = req.user?.sub || null;
    
    console.log('📝 [BOOKING] Création d\'un booking...', {
      retreatId: createBookingDto.retreatId,
      nbPlaces: createBookingDto.nbPlaces,
      date: createBookingDto.dateStart,
      userId: userId ? 'Connecté' : 'Non connecté',
      statut: createBookingDto.statut
    });

    return this.bookingsService.createBooking(userId, createBookingDto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('my-bookings')
  async getMyBookings(@Request() req: any) {
    const userId = req.user.sub;
    return this.bookingsService.findUserBookings(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getBooking(@Param('id') id: string, @Request() req: any) {
    const booking = await this.bookingsService.findById(id);
    
    // Vérifier que l'utilisateur peut accéder à ce booking
    if (booking.userId.toString() !== req.user.sub) {
      throw new Error('Accès non autorisé à ce booking');
    }
    
    return booking;
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/cancel')
  async cancelBooking(
    @Param('id') id: string,
    @Body() body: { raison?: string },
    @Request() req: any
  ) {
    const booking = await this.bookingsService.findById(id);
    
    // Vérifier que l'utilisateur peut annuler ce booking
    if (booking.userId.toString() !== req.user.sub) {
      throw new Error('Accès non autorisé à ce booking');
    }
    
    return this.bookingsService.cancelBooking(id, body.raison);
  }

  // ROUTES PUBLIQUES

  @Get('availability/:retreatId')
  async getAvailability(
    @Param('retreatId') retreatId: string,
    @Request() req: any
  ) {
    const { date } = req.query;
    if (!date) {
      throw new Error('Paramètre date requis');
    }

    const targetDate = new Date(date);
    const placesDisponibles = await this.bookingsService.getAvailablePlaces(retreatId, targetDate);
    
    return {
      retreatId,
      date: targetDate,
      placesDisponibles,
      message: placesDisponibles > 0 
        ? `${placesDisponibles} places disponibles` 
        : 'Aucune place disponible'
    };
  }

  // ROUTES ADMIN (sécurisées)

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/all')
  async getAllBookings() {
    return this.bookingsService.findAll();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/:id')
  async getBookingById(@Param('id') id: string) {
    return this.bookingsService.findById(id);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/:id/confirm')
  async confirmBooking(
    @Param('id') id: string,
    @Body() body: { stripePaymentIntentId: string }
  ) {
    return this.bookingsService.confirmBooking(id, body.stripePaymentIntentId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/cleanup')
  @HttpCode(HttpStatus.OK)
  async cleanupExpiredBookings() {
    const cleanedCount = await this.bookingsService.cleanupExpiredBookings();
    return {
      message: `${cleanedCount} bookings expirés ont été nettoyés`,
      cleanedCount
    };
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/stats')
  async getBookingStats() {
    return this.bookingsService.getStats();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/payment-discrepancies')
  async getPaymentDiscrepancies() {
    return this.bookingsService.checkPaymentDiscrepancies();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/manually-confirm/:id')
  async manuallyConfirmBooking(
    @Param('id') id: string,
    @Body() body: { stripePaymentIntentId: string }
  ) {
    return this.bookingsService.manuallyConfirmBooking(id, body.stripePaymentIntentId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/send-payment-alert')
  async sendPaymentAlert() {
    const discrepancies = await this.bookingsService.checkPaymentDiscrepancies();
    
    if (discrepancies.summary.totalDiscrepancies > 0) {
      // Envoyer une alerte par email à l'admin
      const alertMessage = `
        🚨 ALERTE - Incohérences de paiement détectées
        
        Résumé :
        - Total des incohérences : ${discrepancies.summary.totalDiscrepancies}
        - Retraites avec problèmes : ${discrepancies.summary.retreatsWithIssues}
        
        Veuillez vérifier le dashboard admin pour plus de détails.
      `;

      await this.emailService.sendAdminAlert(
        '🚨 Incohérences de paiement détectées',
        alertMessage
      );

      return {
        message: 'Alerte envoyée par email',
        discrepancies: discrepancies.summary
      };
    }

    return {
      message: 'Aucune incohérence détectée',
      discrepancies: discrepancies.summary
    };
  }

  // Supprimer un booking (pour annulation manuelle)
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async deleteBooking(@Param('id') id: string) {
    try {
      await this.bookingsService.deleteBooking(id);
      return {
        message: 'Booking supprimé avec succès',
        bookingId: id
      };
    } catch (error) {
      throw new BadRequestException(`Erreur lors de la suppression du booking: ${error.message}`);
    }
  }
}