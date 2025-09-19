import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import { json, raw } from 'express';

async function bootstrap() {
  console.log('🚀 [Main] Démarrage de l\'application Lutea...');
  
  const app = await NestFactory.create(AppModule);
  console.log('✅ [Main] Application NestJS créée');
  
  // Middleware pour parser les cookies
  app.use(cookieParser());
  console.log('🍪 [Main] Middleware cookie-parser activé');
  
  // Configuration spéciale pour les webhooks Stripe (raw body)
  app.use('/stripe/webhook', raw({ type: 'application/json' }));
  console.log('🔧 [Main] Middleware raw body activé pour /stripe/webhook');
  
  // Middleware JSON pour toutes les autres routes
  app.use(json());
  console.log('📄 [Main] Middleware JSON activé pour les autres routes');
  
  // Configuration CORS pour permettre au frontend de se connecter
  // Frontend Next.js sur le port 3000, Backend sur le port 3001
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({
    origin: frontendUrl,
    credentials: true, // Permet l'envoi de cookies et d'en-têtes d'authentification
  });
  console.log(`🌐 [Main] CORS configuré pour: ${frontendUrl}`);
  
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
  console.log('✅ [Main] Validation globale activée avec ValidationPipe');
  
  // Port du serveur backend
  // 3001 = Backend, 3000 = Frontend Next.js
  const port = process.env.PORT || 3001;
  
  await app.listen(port);
  console.log(`🎉 [Main] Application Lutea démarrée avec succès !`);
  console.log(`📱 [Main] Accès : http://localhost:${port}`);
  console.log(`🔗 [Main] Frontend autorisé : ${frontendUrl}`);
  console.log(`🔒 [Main] Mode sécurité : ${process.env.NODE_ENV || 'development'}`);
  console.log(`📧 [Main] Service email : Resend`);
  console.log(`🗄️ [Main] Base de données : MongoDB`);
}
bootstrap();
