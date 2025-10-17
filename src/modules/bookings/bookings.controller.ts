import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Patch, 
  Param, 
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { 
  CreateBookingDto, 
  AvailablePlacesDto, 
  CancelBookingDto, 
  ConfirmBookingDto
} from './bookings.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../../common/guards/admin.guard';
import { EmailService } from '../email/email.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PdfGeneratorService } from '../email/pdf-generator.service';
import type { Response } from 'express';

/**
 * Contrôleur de réservations
 * 
 * Gère toutes les opérations liées aux bookings (réservations de retraites)
 * - Routes client : création, consultation, annulation
 * - Routes admin : gestion, statistiques, confirmations
 * - Routes publiques : vérification disponibilité
 */
@Controller('bookings')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly pdfGeneratorService: PdfGeneratorService
  ) {}

  // Méthode pour extraire l'utilisateur depuis les cookies (optionnel)
  private extractUserFromCookies(req: any): { userId: string | null; isGuest: boolean } {
    try {
      // Extraire le token depuis les cookies
      const accessToken = req.cookies?.access_token;
      
      if (!accessToken) {
        console.log('🔐 [AUTH] Aucun token trouvé dans les cookies');
        return { userId: null, isGuest: true };
      }

      // Décoder le token JWT
      const payload = this.jwtService.verify(accessToken, {
        secret: this.configService.get<string>('JWT_SECRET')
      });

      console.log('🔐 [AUTH] Token décodé avec succès:', {
        sub: payload.sub,
        email: payload.email,
        role: payload.role
      });

      return {
        userId: payload.sub,
        isGuest: false
      };
    } catch (error) {
      console.log('🔐 [AUTH] Erreur lors du décodage du token:', error.message);
      return { userId: null, isGuest: true };
    }
  }

  // ROUTES CLIENT (sécurisées)

  // Vérifier les places disponibles (sans authentification pour le tunnel de paiement)
  @Post('available-places')
  @HttpCode(HttpStatus.OK)
  async getAvailablePlaces(
    @Body() availablePlacesDto: AvailablePlacesDto
  ): Promise<{ placesDisponibles: number }> {
    try {
      console.log('🔍 [PLACES] Vérification des places disponibles...', {
        retreatId: availablePlacesDto.retreatId,
        date: availablePlacesDto.date
      });

      const placesDisponibles = await this.bookingsService.getAvailablePlaces(
        availablePlacesDto.retreatId,
        new Date(availablePlacesDto.date)
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
    // 🎯 LOGS D'AUTHENTIFICATION DÉTAILLÉS
    console.log('🔐 [AUTH] ===== VÉRIFICATION AUTHENTIFICATION BACKEND =====');
    console.log('🔐 [AUTH] req.user:', req.user);
    console.log('🔐 [AUTH] req.user?.sub:', req.user?.sub);
    console.log('🔐 [AUTH] Headers authorization:', req.headers.authorization);
    console.log('🔐 [AUTH] Headers cookie:', req.headers.cookie);
    console.log('🔐 [AUTH] Tous les headers:', req.headers);
    console.log('🔐 [AUTH] ================================================');
    
    // Extraire l'utilisateur depuis les cookies (optionnel)
    const { userId, isGuest } = this.extractUserFromCookies(req);
    
    console.log('📝 [BOOKING] Création d\'un booking...', {
      retreatId: createBookingDto.retreatId,
      nbPlaces: createBookingDto.nbPlaces,
      date: createBookingDto.dateStart,
      userId: userId ? `Connecté (${userId})` : 'Non connecté',
      isGuest: isGuest ? 'Oui' : 'Non',
      statut: createBookingDto.statut
    });

    // Utiliser la méthode normale (isStripeBooking = true)
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
    
    // Vérification propriétaire : seul le propriétaire peut voir sa réservation
    if (booking.userId.toString() !== req.user.sub) {
      throw new Error('Accès non autorisé à ce booking');
    }
    
    return booking;
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/pdf')
  async downloadBookingPdf(
    @Param('id') id: string,
    @Request() req: any,
    @Res() res: Response
  ) {
    try {
      // Récupérer la réservation avec les données de la retraite
      const booking = await this.bookingsService.findByIdWithRetreat(id);
      
      // Vérification propriétaire : seul le propriétaire peut télécharger sa réservation
      if (booking.userId.toString() !== req.user.sub.toString()) {
        throw new Error('Accès non autorisé à ce booking');
      }

      // Générer le PDF
      const pdfBuffer = await this.pdfGeneratorService.generateConfirmationPdf(booking);

      // Configurer les headers pour le téléchargement
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="confirmation-${(booking.retreatName || 'retraite').replace(/\s+/g, '-').toLowerCase()}-${new Date(booking.dateStart).toLocaleDateString('fr-FR').replace(/\//g, '-')}.pdf"`,
        'Content-Length': pdfBuffer.length.toString(),
      });

      // Envoyer le PDF
      res.send(pdfBuffer);
    } catch (error) {
      console.error('Erreur lors de la génération du PDF:', error);
      res.status(500).json({ message: 'Erreur lors de la génération du PDF' });
    }
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
    @Body() confirmBookingDto: ConfirmBookingDto
  ) {
    return this.bookingsService.confirmBooking(id, confirmBookingDto.stripePaymentIntentId);
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

//NOT USED  c'est pour tester l'alerte email
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/send-payment-alert')
  async sendPaymentAlert() {
    const discrepancies = await this.bookingsService.checkPaymentDiscrepancies();
    
    if (discrepancies.summary.totalDiscrepancies > 0) {
      // Alerte email automatique si incohérences de paiement détectées
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

  // Annuler un booking (admin seulement)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/:id/cancel')
  async cancelBookingByAdmin(
    @Param('id') id: string,
    @Body() cancelBookingDto: CancelBookingDto
  ) {
    return this.bookingsService.cancelBooking(id, cancelBookingDto.raison);
  }

  // Créer un booking manuellement (admin seulement)
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/create')
  @HttpCode(HttpStatus.CREATED)
  async createBookingByAdmin(@Body() createBookingDto: CreateBookingDto) {
    console.log('👨‍💼 [ADMIN] Création manuelle d\'une réservation...');
    return this.bookingsService.createBookingByAdmin(createBookingDto);
  }
}