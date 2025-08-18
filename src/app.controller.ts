// Import des fonctionnalités NATIVES de NestJS
// Controller : Décorateur qui indique que cette classe est un contrôleur (gère les routes HTTP)
// Get : Décorateur pour définir les routes GET
import { Controller, Get } from '@nestjs/common';

// Import de notre service principal
import { AppService } from './app.service';

// Décorateur Controller : Indique que cette classe gère les routes racines de l'application
// Pas de préfixe = routes à la racine (/, /health, /info, etc.)
@Controller()
export class AppController {
  
  // Constructeur avec injection de dépendance
  // private readonly : Crée une propriété privée en lecture seule
  // NestJS va automatiquement créer une instance de AppService et l'injecter ici
  constructor(private readonly appService: AppService) {}

  // ROUTE RACINE - ACCUEIL
  // @Get() : Route GET / (racine de l'API)
  // Retourne un message d'accueil avec des informations sur l'API
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // ROUTE DE SANTÉ - VÉRIFICATION DU STATUT
  // @Get('health') : Route GET /health
  // Retourne le statut de santé de l'application
  // Utile pour les health checks automatiques et la surveillance
  @Get('health')
  getHealth() {
    return this.appService.getHealth();
  }

  // ROUTE D'INFORMATIONS - DÉTAILS DE L'APPLICATION
  // @Get('info') : Route GET /info
  // Retourne des informations détaillées sur l'application
  // Utile pour le debugging et la documentation
  @Get('info')
  getAppInfo() {
    return this.appService.getAppInfo();
  }

  // ROUTE DE VÉRIFICATION - CONFIGURATION DE L'ENVIRONNEMENT
  // @Get('check') : Route GET /check
  // Vérifie que toutes les variables d'environnement nécessaires sont présentes
  // Utile pour le debugging et la configuration
  @Get('check')
  checkEnvironment() {
    return this.appService.checkEnvironment();
  }

  // ROUTE DE STATISTIQUES - INFORMATIONS SYSTÈME
  // @Get('stats') : Route GET /stats
  // Retourne des statistiques système (mémoire, plateforme, etc.)
  // Utile pour le monitoring et la surveillance
  @Get('stats')
  getSystemStats() {
    return this.appService.getSystemStats();
  }

  // ROUTE DE DOCUMENTATION - LIENS UTILES
  // @Get('docs') : Route GET /docs
  // Retourne des liens vers la documentation et les ressources
  // Utile pour les développeurs qui découvrent l'API
  @Get('docs')
  getDocumentation() {
    return {
      message: '📚 Documentation de l\'API Lutea Backend',
      version: '1.0.0',
      endpoints: {
        auth: {
          description: '🔐 Authentification et gestion des utilisateurs',
          routes: [
            'POST /auth/register - Inscription d\'un nouvel utilisateur',
            'POST /auth/login - Connexion utilisateur',
            'POST /auth/refresh - Renouvellement du token JWT',
            'POST /auth/logout - Déconnexion utilisateur',
            'POST /auth/2fa/generate - Génération du code 2FA (admin)',
            'POST /auth/2fa/verify - Vérification du code 2FA (admin)',
            'GET /auth/profile - Profil de l\'utilisateur connecté',
          ],
        },
        users: {
          description: '👥 Gestion des profils utilisateurs',
          routes: [
            'GET /users/profile - Profil de l\'utilisateur connecté',
            'PUT /users/profile - Modification du profil',
            'PUT /users/profile/password - Changement de mot de passe',
            'GET /users/:id - Récupération d\'un utilisateur (admin)',
            'GET /users - Liste de tous les utilisateurs (admin)',
          ],
        },
        system: {
          description: '⚙️ Informations système et monitoring',
          routes: [
            'GET / - Page d\'accueil',
            'GET /health - Vérification de la santé',
            'GET /info - Informations sur l\'application',
            'GET /check - Vérification de la configuration',
            'GET /stats - Statistiques système',
            'GET /docs - Cette documentation',
          ],
        },
      },
      security: {
        note: '🔒 Toutes les routes utilisateurs nécessitent une authentification JWT',
        roles: {
          CLIENT: 'Utilisateur standard - Accès à son propre profil',
          ADMIN: 'Administrateur - Accès à tous les utilisateurs et fonctionnalités 2FA',
        },
      },
      environment: {
        note: '🌍 Variables d\'environnement requises :',
        required: [
          'MONGODB_URI - URL de connexion MongoDB',
          'JWT_SECRET - Clé secrète pour les JWT (production obligatoire)',
          'NODE_ENV - Environnement (development/production)',
        ],
      },
    };
  }
}

// COMMENTAIRES SUR LE CONTRÔLEUR PRINCIPAL :
// 
// 1. Rôle du contrôleur principal :
//    - Gère les routes racines de l'API
//    - Fournit des informations sur l'application
//    - Permet le monitoring et la surveillance
//    - Sert de point d'entrée pour la documentation
//
// 2. Routes disponibles :
//    - / : Page d'accueil basique
//    - /health : Vérification de la santé (health check)
//    - /info : Informations sur l'application
//    - /check : Vérification de la configuration
//    - /stats : Statistiques système
//    - /docs : Documentation complète de l'API
//
// 3. Utilisation typique :
//    - Monitoring automatique (/health)
//    - Debugging et configuration (/check, /info)
//    - Surveillance système (/stats)
//    - Documentation pour développeurs (/docs)
//
// 4. Sécurité :
//    - Routes publiques (pas d'authentification requise)
//    - Pas d'informations sensibles exposées
//    - Documentation des routes protégées
//
// 5. Extensibilité :
//    - Facile d'ajouter de nouvelles routes utilitaires
//    - Structure claire et organisée
//    - Documentation automatique des endpoints
