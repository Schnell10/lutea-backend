import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Retreat, RetreatDocument } from './retreats.schema';
import { Booking, BookingDocument } from '../bookings/bookings.schema';
import { CreateRetreatDto, UpdateRetreatDto } from './dto/retreats.dto';

@Injectable()
export class RetreatsService {
  constructor(
    @InjectModel(Retreat.name) private retreatModel: Model<RetreatDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<BookingDocument>,
  ) {}

  // Récupérer toutes les retraites (pour admin)
  async findAll(): Promise<Retreat[]> {
    return this.retreatModel.find().sort({ createdAt: -1 }).exec();
  }

  // Récupérer les retraites publiques (pour le frontend)
  // Utilise le filtrage MongoDB optimisé
  async findPublicRetreats(): Promise<Retreat[]> {
    const now = new Date();
    
    // Solution optimisée : MongoDB pour isActive + JS pour les dates
    const retreats = await this.retreatModel.find({ isActive: true }).exec();
    
    // Filtrage côté JS (plus fiable pour les arrays de dates)
    const filteredRetreats = retreats.filter(retreat => {
      // Retraites "bientôt disponibles" (peuvent avoir ou pas de dates)
      if (retreat.bientotDisponible) {
        return true;
      }
      
      // Retraites avec au moins une date future (basé sur la date de début)
      return retreat.dates && retreat.dates.length > 0 && 
             retreat.dates.some(date => date.start && new Date(date.start) > now);
    });
    
    return filteredRetreats;
  }

  // Récupérer une retraite par ID
  async findById(id: string): Promise<Retreat> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de retraite invalide');
    }

    const retreat = await this.retreatModel.findById(id).exec();
    if (!retreat) {
      throw new NotFoundException('Retraite non trouvée');
    }

    return retreat;
  }

  // Créer une nouvelle retraite
  async create(createRetreatDto: CreateRetreatDto): Promise<Retreat> {
    const retreat = new this.retreatModel(createRetreatDto);
    return retreat.save();
  }

  // Mettre à jour une retraite
  async update(id: string, updateRetreatDto: UpdateRetreatDto): Promise<Retreat> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de retraite invalide');
    }

    const retreat = await this.retreatModel
      .findByIdAndUpdate(id, updateRetreatDto, { new: true, runValidators: true })
      .exec();

    if (!retreat) {
      throw new NotFoundException('Retraite non trouvée');
    }

    return retreat;
  }

  // Supprimer une retraite
  async remove(id: string): Promise<void> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de retraite invalide');
    }

    const result = await this.retreatModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('Retraite non trouvée');
    }
  }

  // Activer/désactiver une retraite
  async toggleActive(id: string): Promise<Retreat> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException('ID de retraite invalide');
    }

    const retreat = await this.retreatModel.findById(id).exec();
    if (!retreat) {
      throw new NotFoundException('Retraite non trouvée');
    }

    retreat.isActive = !retreat.isActive;
    return retreat.save();
  }

  // Calculer les places réservées pour une retraite à une date spécifique (méthode dynamique)
  async getReservedPlaces(retreatId: string, date?: Date): Promise<number> {
    if (!Types.ObjectId.isValid(retreatId)) {
      throw new BadRequestException('ID de retraite invalide');
    }

    const retreat = await this.retreatModel.findById(retreatId).exec();
    if (!retreat) {
      throw new NotFoundException('Retraite non trouvée');
    }

    // Si une date est fournie, calculer pour cette date spécifique
    if (date) {
      const placesReservees = await this.bookingModel.aggregate([
        {
          $match: {
            retreatId: new Types.ObjectId(retreatId),
            dateStart: date,
            $or: [
              { 
                statut: 'CONFIRMED',
                statutPaiement: 'PAID'
              },
              { 
                statut: 'PENDING',
                statutPaiement: 'PENDING'
              }
            ]
          }
        },
        {
          $group: {
            _id: null,
            totalPlaces: { $sum: '$nbPlaces' }
          }
        }
      ]);

      return placesReservees.length > 0 ? placesReservees[0].totalPlaces : 0;
    }

    // Si pas de date, calculer pour tous les blocs (pour l'admin)
    let totalPlacesReservees = 0;

    for (const dateBlock of retreat.dates) {
      const placesReservees = await this.bookingModel.aggregate([
        {
          $match: {
            retreatId: new Types.ObjectId(retreatId),
            dateStart: dateBlock.start,
            $or: [
              { 
                statut: 'CONFIRMED',
                statutPaiement: 'PAID'
              },
              { 
                statut: 'PENDING',
                statutPaiement: 'PENDING'
              }
            ]
          }
        },
        {
          $group: {
            _id: null,
            totalPlaces: { $sum: '$nbPlaces' }
          }
        }
      ]);

      const blockPlaces = placesReservees.length > 0 ? placesReservees[0].totalPlaces : 0;
      totalPlacesReservees += blockPlaces;
    }

    return totalPlacesReservees;
  }

  // Rechercher des retraites par critères (pour admin)
  async searchRetreats(criteria: any): Promise<Retreat[]> {
    const query: any = {};

    if (criteria.titreCard) {
      query.titreCard = { $regex: criteria.titreCard, $options: 'i' };
    }

    if (criteria.statut) {
      query.isActive = criteria.statut === 'active';
    }

    if (criteria.prixMin || criteria.prixMax) {
      query.prix = {};
      if (criteria.prixMin) query.prix.$gte = criteria.prixMin;
      if (criteria.prixMax) query.prix.$lte = criteria.prixMax;
    }

    return this.retreatModel.find(query).sort({ createdAt: -1 }).exec();
  }
}
