import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Filtre d'exception global : je log toutes les erreurs côté serveur avec contexte complet,
 * mais je renvoie des réponses génériques côté client pour éviter d'exposer des infos sensibles.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Je détermine le statut HTTP et le message selon le type d'erreur
    let status: number;
    let message: string;
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      // Pour les erreurs de validation (400), je garde les détails pour le client
      if (status === 400 && typeof exceptionResponse === 'object') {
        message = 'Données invalides';
        details = exceptionResponse;
      } else {
        message = exception.message;
      }
    } else {
      // Erreur inattendue → 500
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Erreur interne du serveur';
    }

    // Je log l'erreur avec tout le contexte (URL, méthode, IP, body, etc.)
    const errorLog = {
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      ip: request.ip || request.connection.remoteAddress,
      userAgent: request.get('User-Agent'),
      status,
      message: exception instanceof Error ? exception.message : 'Erreur inconnue',
      stack: exception instanceof Error ? exception.stack : null,
      body: request.body,
      query: request.query,
      params: request.params,
    };

    // Je n'ignore pas les 401 sur /auth/profile (vérification normale pour analytics)
    const isAuthProfile401 = status === 401 && request.url === '/auth/profile';

    if (status >= 500) {
      this.logger.error('Erreur serveur détectée', errorLog);
    } else if (!isAuthProfile401) {
      this.logger.warn('Erreur client détectée', errorLog);
    }

    // Je renvoie une réponse générique au client (sécurité)
    const errorResponse = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(details && { details }), // Détails uniquement pour les erreurs de validation
    };

    // Stack trace uniquement en développement
    if (process.env.NODE_ENV !== 'production' && exception instanceof Error) {
      errorResponse['stack'] = exception.stack;
    }

    response.status(status).json(errorResponse);
  }
}
