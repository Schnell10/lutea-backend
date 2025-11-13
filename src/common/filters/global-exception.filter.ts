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
 * Filtre d'exception global pour gérer toutes les erreurs de l'application
 * 
 * Fonctionnalités :
 * - Log des erreurs complètes côté serveur
 * - Réponses génériques côté client (pas d'exposition d'informations sensibles)
 * - Gestion spéciale des erreurs de validation
 * - Log des erreurs avec contexte (URL, méthode, IP, etc.)
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Déterminer le statut HTTP et le message d'erreur
    let status: number;
    let message: string;
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      // Gestion des erreurs de validation (BadRequestException)
      if (status === 400 && typeof exceptionResponse === 'object') {
        message = 'Données invalides';
        details = exceptionResponse;
      } else {
        message = exception.message;
      }
    } else {
      // Erreur inattendue (500)
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Erreur interne du serveur';
    }

    // Log de l'erreur côté serveur avec contexte complet
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

    // Ignorer les 401 sur /auth/profile (vérification normale pour analytics)
    const isAuthProfile401 = status === 401 && request.url === '/auth/profile';

    if (status >= 500) {
      // Erreur serveur - log en erreur
      this.logger.error('Erreur serveur détectée', errorLog);
    } else if (!isAuthProfile401) {
      // Erreur client - log en warning (sauf 401 sur /auth/profile)
      this.logger.warn('Erreur client détectée', errorLog);
    }
    // Les 401 sur /auth/profile sont silencieuses (vérification normale)

    // Réponse côté client (générique pour la sécurité)
    const errorResponse = {
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
      ...(details && { details }), // Ajouter les détails seulement pour les erreurs de validation
    };

    // Ne jamais exposer la stack trace en production
    if (process.env.NODE_ENV !== 'production' && exception instanceof Error) {
      errorResponse['stack'] = exception.stack;
    }

    response.status(status).json(errorResponse);
  }
}
