import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Middleware pour capturer le corps brut des requêtes webhook Stripe.
 * NestJS parse automatiquement le JSON, ce qui casse la signature cryptographique de Stripe.
 * Je capture donc le corps avant le parsing et le stocke dans req.rawBody.
 */
@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Je ne capture le raw body que pour les webhooks Stripe
    if (req.originalUrl === '/stripe/webhook') {
      req.setEncoding('utf8');
      let data = '';
      
      // J'accumule les chunks pour reconstituer le corps complet
      req.on('data', (chunk) => {
        data += chunk;
      });
      
      // Quand toutes les données sont reçues, je stocke le raw body
      req.on('end', () => {
        (req as any).rawBody = data;
        next();
      });
      
      req.on('error', (err) => {
        logger.error('Erreur lors de la capture du raw body:', err);
        next(err);
      });
    } else {
      next();
    }
  }
}
