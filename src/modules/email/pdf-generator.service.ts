import { Injectable } from '@nestjs/common';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { luteaConfig } from '../../config/lutea.config';

// Couleurs Lutea - style propre et moderne
const COLORS = {
  primary: rgb(0.506, 0.627, 0.522), // #81a085
  title: rgb(0.306, 0.388, 0.318), // #4e6351
  text: rgb(0.2, 0.2, 0.2), // #333333
  white: rgb(1, 1, 1),
  lightGray: rgb(0.95, 0.95, 0.95),
  border: rgb(0.85, 0.85, 0.85),
  accent: rgb(0.4, 0.5, 0.4), // Pour les accents
};

@Injectable()
export class PdfGeneratorService {
  async generateConfirmationPdf(bookingData: any, retreatData: any): Promise<Buffer> {
    // Créer un nouveau PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4

    // Charger les polices
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Titre principal en haut - style propre
    page.drawText('CONFIRMATION DE RÉSERVATION', {
      x: 50,
      y: 780,
      size: 20,
      font: boldFont,
      color: COLORS.title,
    });

    // Date de paiement
    const paymentDate = new Date(bookingData.createdAt).toLocaleDateString('fr-FR');
    page.drawText(`Paiement effectué le ${paymentDate}`, {
      x: 50,
      y: 750,
      size: 12,
      font: font,
      color: COLORS.text,
    });

    // Ligne de séparation
    page.drawLine({
      start: { x: 50, y: 730 },
      end: { x: 545, y: 730 },
      thickness: 2,
      color: COLORS.primary,
    });

    // Section prestation - style épuré
    page.drawText('PRESTATION', {
      x: 50,
      y: 700,
      size: 14,
      font: boldFont,
      color: COLORS.title,
    });
    
    page.drawText(retreatData.titreCard, {
      x: 50,
      y: 675,
      size: 16,
      font: boldFont,
      color: COLORS.text,
    });

    // Dates et horaires
    if (retreatData.dates && retreatData.dates.length > 0) {
      const firstDate = retreatData.dates[0];
      const startDate = new Date(firstDate.start).toLocaleDateString('fr-FR');
      const endDate = new Date(firstDate.end).toLocaleDateString('fr-FR');
      
      page.drawText('DATES ET HORAIRES', {
        x: 50,
        y: 640,
        size: 14,
        font: boldFont,
        color: COLORS.title,
      });
      
      page.drawText(`${startDate} au ${endDate}`, {
        x: 50,
        y: 615,
        size: 12,
        font: font,
        color: COLORS.text,
      });

      if (firstDate.heureArrivee && firstDate.heureDepart) {
        page.drawText(`Rendez-vous: ${firstDate.heureArrivee} - Départ: ${firstDate.heureDepart}`, {
          x: 50,
          y: 595,
          size: 12,
          font: font,
          color: COLORS.text,
        });
      }
    }

    // Lieu de rendez-vous
    if (retreatData.adresseRdv) {
      page.drawText('LIEU DE RENDEZ-VOUS', {
        x: 50,
        y: 560,
        size: 14,
        font: boldFont,
        color: COLORS.title,
      });
      
      page.drawText(retreatData.adresseRdv, {
        x: 50,
        y: 535,
        size: 12,
        font: font,
        color: COLORS.text,
      });
    }

    // Prix total - style normal comme le texte
    page.drawText('PRIX TOTAL TTC', {
      x: 50,
      y: 500,
      size: 14,
      font: boldFont,
      color: COLORS.title,
    });
    
    page.drawText(`${bookingData.prixTotal}€`, {
      x: 50,
      y: 475,
      size: 12,
      font: font,
      color: COLORS.text,
    });

    // Coordonnées de contact
    page.drawText('COORDONNÉES DE CONTACT', {
      x: 50,
      y: 430,
      size: 14,
      font: boldFont,
      color: COLORS.title,
    });
    
    page.drawText(`Email: ${luteaConfig.company.email}`, {
      x: 50,
      y: 405,
      size: 12,
      font: font,
      color: COLORS.text,
    });
    
    page.drawText(`Téléphone: ${luteaConfig.company.phone}`, {
      x: 50,
      y: 380,
      size: 12,
      font: font,
      color: COLORS.text,
    });

    // Conditions d'annulation
    page.drawText('CONDITIONS D\'ANNULATION / REMBOURSEMENT', {
      x: 50,
      y: 340,
      size: 14,
      font: boldFont,
      color: COLORS.title,
    });
    
    page.drawText('Prestation non remboursable, sauf en cas de force majeure ou sur présentation d\'un justificatif médical.', {
      x: 50,
      y: 315,
      size: 12,
      font: font,
      color: COLORS.text,
      maxWidth: 495,
    });
    

    // Description des prestations incluses
    page.drawText('PRESTATIONS INCLUSES', {
      x: 50,
      y: 255,
      size: 14,
      font: boldFont,
      color: COLORS.title,
    });
    
    page.drawText('Le tarif inclus l\'hébergement, les repas, les cours de yoga & de pilates ainsi que les ateliers et activités. Le transport n\'est pas inclus dans ces frais.', {
      x: 50,
      y: 230,
      size: 12,
      font: font,
      color: COLORS.text,
      maxWidth: 495, // Largeur maximale pour forcer le retour à la ligne naturel
    });

    // Ligne de séparation avant les mentions légales
    page.drawLine({
      start: { x: 50, y: 175 },
      end: { x: 545, y: 175 },
      thickness: 1,
      color: COLORS.border,
    });

    page.drawText('LUTEA', {
      x: 250,
      y: 145,
      size: 20,
      font: boldFont,
      color: COLORS.title,
    });

    // Mentions légales - style épuré sous LUTEA
    page.drawText(`Entreprise: ${luteaConfig.company.name}`, {
      x: 50,
      y: 115,
      size: 11,
      font: font,
      color: COLORS.text,
    });
    
    page.drawText(`Adresse: ${luteaConfig.company.address}`, {
      x: 50,
      y: 95,
      size: 11,
      font: font,
      color: COLORS.text,
    });
    
    page.drawText(`SIRET: ${luteaConfig.company.siret}`, {
      x: 50,
      y: 75,
      size: 11,
      font: font,
      color: COLORS.text,
    });

    // Générer le PDF
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  }
}