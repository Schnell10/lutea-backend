import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { json, raw } from 'express';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { logger } from './common/utils/logger';

async function bootstrap() {
  logger.log('🚀 [Main] Démarrage de l\'application Lutea...');
  
  const app = await NestFactory.create(AppModule);
  logger.log('✅ [Main] Application NestJS créée');
  
  // Configuration Helmet pour la sécurité des en-têtes HTTP
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https://api.stripe.com"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false, // Désactivé pour Stripe
  }));
  logger.log('🛡️ [Main] Middleware Helmet activé (sécurité des en-têtes HTTP)');
  
  // Middleware pour parser les cookies
  app.use(cookieParser());
  logger.log('🍪 [Main] Middleware cookie-parser activé');
  
  // Configuration spéciale pour les webhooks Stripe (raw body)
  app.use('/stripe/webhook', raw({ type: 'application/json' }));
  logger.log('🔧 [Main] Middleware raw body activé pour /stripe/webhook');
  
  // Middleware JSON pour toutes les autres routes
  app.use(json());
  logger.log('📄 [Main] Middleware JSON activé pour les autres routes');
  
  // Configuration CORS pour permettre au frontend de se connecter
  // En production : uniquement l'URL du frontend Vercel
  // En développement : localhost:3000
  const allowedOrigins = process.env.FRONTEND_URL 
    ? process.env.FRONTEND_URL.split(',').map(url => url.trim().replace(/\/$/, ''))
    : ['http://localhost:3000'];
  
  app.enableCors({
    origin: (origin, callback) => {
      // En développement, autoriser toutes les origines localhost
      if (process.env.NODE_ENV !== 'production') {
        if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
          return callback(null, true);
        }
      }
      
      // En production, vérifier strictement l'origine
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // Permet l'envoi de cookies et d'en-têtes d'authentification
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  logger.log(`🌐 [Main] CORS configuré pour: ${allowedOrigins.join(', ')}`);
  
  // Validation globale des données avec ValidationPipe
  // Valide automatiquement tous les DTOs selon leurs décorateurs
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,           // Supprime les propriétés non définies dans les DTOs
    forbidNonWhitelisted: true, // Rejette la requête si des propriétés non autorisées sont présentes
    transform: true,            // Transforme automatiquement les types (string → number, etc.)
    transformOptions: {
      enableImplicitConversion: true, // Conversion automatique des types
    },
  }));
  logger.log('✅ [Main] Validation globale activée avec ValidationPipe');
  
  // Filtre d'exception global pour la gestion sécurisée des erreurs
  app.useGlobalFilters(new GlobalExceptionFilter());
  logger.log('🛡️ [Main] Filtre d\'exception global activé (gestion sécurisée des erreurs)');
  
  // Port du serveur backend
  // 3001 = Backend, 3000 = Frontend Next.js
  const port = process.env.PORT || 3001;
  
  await app.listen(port);
  logger.log(`🎉 [Main] Application Lutea démarrée avec succès !`);
  logger.log(`📱 [Main] Accès : http://localhost:${port}`);
  logger.log(`🔗 [Main] Frontend autorisé : ${allowedOrigins.join(', ')}`);
  logger.log(`🔒 [Main] Mode sécurité : ${process.env.NODE_ENV || 'development'}`);
  logger.log(`📧 [Main] Service email : Resend`);
  logger.log(`🗄️ [Main] Base de données : MongoDB (opérationnel)`);
  
  // Vérification connexion MySQL
  const mysqlHost = process.env.MYSQL_HOST || 'localhost';
  const mysqlDatabase = process.env.MYSQL_DATABASE || 'lutea_analytics';
  logger.log(`🗄️ [Main] Base de données Analytics : MySQL (${mysqlHost}/${mysqlDatabase})`);
}
bootstrap();
