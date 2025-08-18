// Import des fonctionnalités NATIVES de NestJS
// Injectable : Décorateur qui permet à NestJS d'injecter ce service dans d'autres classes
import { Injectable } from '@nestjs/common';

// Décorateur Injectable : Permet à NestJS d'injecter ce service dans d'autres classes
// Ce service est le service principal de l'application
@Injectable()
export class AppService {
  
  // MÉTHODE DE BASE - ACCUEIL
  // getHello() : Méthode de base pour tester que l'application fonctionne
  // Retourne un message d'accueil avec des informations sur l'API
  getHello(): string {
    return '🚀 API Lutea Backend - Système d\'authentification sécurisé';
  }

  // MÉTHODE DE SANTÉ - VÉRIFICATION DU STATUT
  // getHealth() : Méthode pour vérifier que l'application est en bonne santé
  // Utile pour les health checks et la surveillance
  getHealth(): { status: string; timestamp: string; uptime: number } {
    return {
      status: 'healthy',                    // Statut de l'application
      timestamp: new Date().toISOString(),  // Date et heure actuelles
      uptime: process.uptime(),             // Temps de fonctionnement en secondes
    };
  }

  // MÉTHODE D'INFORMATIONS - DÉTAILS DE L'APPLICATION
  // getAppInfo() : Méthode qui retourne des informations sur l'application
  // Utile pour le debugging et la documentation
  getAppInfo(): { 
    name: string; 
    version: string; 
    environment: string; 
    features: string[] 
  } {
    return {
      name: 'Lutea Backend API',           // Nom de l'application
      version: '1.0.0',                    // Version actuelle
      environment: process.env.NODE_ENV || 'development', // Environnement (dev/prod)
      features: [                          // Fonctionnalités disponibles
        '🔐 Authentification sécurisée',
        '👥 Gestion des utilisateurs',
        '🛡️ Contrôle d\'accès par rôles',
        '🔒 Double authentification (2FA)',
        '📊 Base de données MongoDB',
        '🚀 API RESTful avec NestJS',
      ],
    };
  }

  // MÉTHODE DE VÉRIFICATION DES VARIABLES D'ENVIRONNEMENT
  // checkEnvironment() : Méthode pour vérifier que toutes les variables nécessaires sont présentes
  // Utile pour le debugging et la configuration
  checkEnvironment(): { 
    mongodb: boolean; 
    jwt: boolean; 
    warnings: string[] 
  } {
    const warnings: string[] = [];
    
    // Vérification de MongoDB
    const hasMongoDB = !!process.env.MONGODB_URI;
    if (!hasMongoDB) {
      warnings.push('⚠️ MONGODB_URI manquant - Connexion base de données impossible');
    }
    
    // Vérification de JWT
    const hasJWT = !!process.env.JWT_SECRET;
    if (!hasJWT) {
      warnings.push('⚠️ JWT_SECRET manquant - Utilisation de la clé par défaut (non sécurisé)');
    }
    
    // Vérification de l'environnement
    if (process.env.NODE_ENV === 'production' && !hasJWT) {
      warnings.push('🚨 PRODUCTION: JWT_SECRET manquant - Sécurité compromise !');
    }
    
    return {
      mongodb: hasMongoDB,     // MongoDB configuré ou non
      jwt: hasJWT,             // JWT configuré ou non
      warnings,                 // Liste des avertissements
    };
  }

  // MÉTHODE DE STATISTIQUES - INFORMATIONS SYSTÈME
  // getSystemStats() : Méthode qui retourne des statistiques système
  // Utile pour le monitoring et la surveillance
  getSystemStats(): { 
    memory: { used: number; total: number; percentage: number }; 
    platform: string; 
    nodeVersion: string 
  } {
    const memUsage = process.memoryUsage();
    const totalMemory = memUsage.heapTotal;
    const usedMemory = memUsage.heapUsed;
    
    return {
      memory: {
        used: Math.round(usedMemory / 1024 / 1024),      // Mémoire utilisée en MB
        total: Math.round(totalMemory / 1024 / 1024),    // Mémoire totale en MB
        percentage: Math.round((usedMemory / totalMemory) * 100), // Pourcentage d'utilisation
      },
      platform: process.platform,                         // Plateforme (win32, linux, darwin)
      nodeVersion: process.version,                       // Version de Node.js
    };
  }
}

// COMMENTAIRES SUR LE SERVICE PRINCIPAL :
// 
// 1. Rôle du service principal :
//    - Point d'entrée pour les fonctionnalités globales
//    - Méthodes utilitaires pour toute l'application
//    - Vérifications de santé et de configuration
//
// 2. Méthodes disponibles :
//    - getHello() : Message d'accueil basique
//    - getHealth() : Vérification de la santé de l'application
//    - getAppInfo() : Informations sur l'application
//    - checkEnvironment() : Vérification de la configuration
//    - getSystemStats() : Statistiques système
//
// 3. Utilisation typique :
//    - Health checks automatiques
//    - Monitoring et surveillance
//    - Debugging et configuration
//    - Documentation de l'API
//
// 4. Sécurité :
//    - Vérification des variables d'environnement critiques
//    - Avertissements pour la production
//    - Pas d'informations sensibles exposées
//
// 5. Extensibilité :
//    - Facile d'ajouter de nouvelles méthodes utilitaires
//    - Centralisation des fonctionnalités communes
//    - Réutilisable dans d'autres modules
