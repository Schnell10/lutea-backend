import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware pour capturer le corps brut des requêtes webhook Stripe
 * 
 * PROBLÈME : Stripe envoie des webhooks avec une signature cryptographique
 * Pour vérifier cette signature, Stripe a besoin du corps brut de la requête
 * Mais Express parse automatiquement le JSON, ce qui casse la signature
 * 
 * SOLUTION : Ce middleware capture le corps avant que Express le parse
 * et le stocke dans req.rawBody pour les webhooks Stripe uniquement
 */
@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log('🔧 [Middleware] RawBodyMiddleware appliqué sur:', req.originalUrl);
    
    // Vérifier si c'est la route webhook Stripe
    if (req.originalUrl === '/stripe/webhook') {
      console.log('🔧 [Middleware] Capture du raw body pour webhook Stripe');
      
      // Définir l'encodage UTF-8 pour lire les données texte
      req.setEncoding('utf8');
      
      // Variable pour accumuler les données du corps
      let data = '';
      
      // Événement 'data' : appelé à chaque chunk de données reçu
      req.on('data', (chunk) => {
        console.log('🔧 [Middleware] Chunk reçu, taille:', chunk.length);
        // Accumuler les chunks pour reconstituer le corps complet
        data += chunk;
      });
      
      // Événement 'end' : appelé quand toutes les données sont reçues
      req.on('end', () => {
        // Stocker le corps brut dans req.rawBody pour Stripe
        (req as any).rawBody = data;
        console.log('🔧 [Middleware] Raw body capturé, longueur:', data.length);
        console.log('🔧 [Middleware] Premiers caractères:', data.substring(0, 100));
        
        // Continuer vers le contrôleur Stripe
        next();
      });
      
      // Événement 'error' : gérer les erreurs de lecture
      req.on('error', (err) => {
        console.error('🔧 [Middleware] Erreur lors de la capture:', err);
        // Passer l'erreur au middleware suivant
        next(err);
      });
    } else {
      // Pour toutes les autres routes, ne rien faire et continuer
      next();
    }
  }
}
