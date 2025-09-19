import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    console.log('🔧 [Middleware] RawBodyMiddleware appliqué sur:', req.originalUrl);
    
    if (req.originalUrl === '/stripe/webhook') {
      console.log('🔧 [Middleware] Capture du raw body pour webhook Stripe');
      
      // Désactiver le parsing JSON d'Express pour cette route
      req.setEncoding('utf8');
      
      let data = '';
      req.on('data', (chunk) => {
        console.log('🔧 [Middleware] Chunk reçu, taille:', chunk.length);
        data += chunk;
      });
      
      req.on('end', () => {
        (req as any).rawBody = data;
        console.log('🔧 [Middleware] Raw body capturé, longueur:', data.length);
        console.log('🔧 [Middleware] Premiers caractères:', data.substring(0, 100));
        next();
      });
      
      req.on('error', (err) => {
        console.error('🔧 [Middleware] Erreur lors de la capture:', err);
        next(err);
      });
    } else {
      next();
    }
  }
}
