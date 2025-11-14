# Sécurité - Backend Lutea

## Ce qui est en place

**Authentification JWT**
- Token d'accès : 15 minutes
- Refresh token : 7 jours
- Clé secrète forte

**Mots de passe**
- Hachage bcrypt avec 12 rounds
- Minimum 8 caractères

**Protection contre les attaques**
- Verrouillage après 5 tentatives échouées (15 minutes)
- Rate limiting : 100 requêtes par minute par IP
- Validation de toutes les entrées

**Rôles**
- AdminGuard pour les endpoints admin
- ClientGuard pour les endpoints client
- OwnerGuard pour vérifier la propriété

**2FA pour les admins**
- Code à 8 chiffres
- Expiration 10 minutes

## Variables d'environnement importantes

JWT_SECRET=clé_très_longue_et_complexe
MONGODB_URI=mongodb://...
MYSQL_HOST=...
MYSQL_USER=...
MYSQL_PASSWORD=...
MYSQL_DATABASE=...
NODE_ENV=production
FRONTEND_URL=https://mon-site.vercel.app

En production, je dois absolument changer les clés JWT par des valeurs fortes et uniques.

## Configuration CORS

**CORS est configuré pour accepter uniquement les requêtes depuis le frontend autorisé.**

**En production (Render) :**
- Variable `FRONTEND_URL` = URL exacte du frontend Vercel (ex: `https://mon-site.vercel.app`)
- Le backend n'accepte QUE les requêtes venant de cette URL
- Toutes les autres origines sont rejetées

**En développement :**
- Autorise localhost automatiquement
- Pas besoin de configurer FRONTEND_URL en local

**Côté frontend (Vercel) :**
- Variable `NEXT_PUBLIC_API_BASE_URL` = URL exacte du backend Render (ex: `https://mon-backend.onrender.com`)
- Le frontend n'appelle QUE cette URL

**Sécurité :**
- En production, CORS vérifie strictement l'origine
- Seules les requêtes depuis FRONTEND_URL sont acceptées
- Les cookies et credentials sont autorisés (nécessaire pour l'auth JWT)

## Endpoints protégés

**Public (pas d'authentification)**
- POST /auth/register - Inscription
- POST /auth/login - Connexion
- POST /auth/forgot-password - Mot de passe oublié
- POST /auth/reset-password - Réinitialisation mot de passe
- POST /auth/validate-email - Validation email après inscription
- POST /auth/refresh - Renouvellement token
- POST /auth/2fa/finalize - Finalisation connexion admin avec 2FA
- GET /retreats/public - Liste retraites publiques
- GET /retreats/public/:id - Détail retraite
- POST /bookings - Créer réservation
- POST /bookings/available-places - Vérifier places disponibles
- GET /bookings/availability/:retreatId - Disponibilités
- POST /analytics/session - Créer session analytics
- PATCH /analytics/session/:sessionId - Mettre à jour session
- DELETE /analytics/session/:sessionId - Supprimer session
- POST /analytics/event - Créer événement analytics
- POST /stripe/create-payment-intent - Créer paiement
- POST /stripe/webhook - Webhook Stripe
- POST /email/contact - Formulaire contact

**Authentifié (JWT requis)**
- POST /auth/logout - Déconnexion
- GET /auth/profile - Profil utilisateur
- GET /auth/user-info - Infos complètes utilisateur
- POST /auth/2fa/verify - Vérifier code 2FA
- GET /users/profile - Mon profil
- PUT /users/profile - Modifier mon profil
- DELETE /users/profile - Supprimer mon compte
- POST /users/validate-password - Valider mot de passe actuel
- GET /users/check-temporary/:email - Vérifier statut utilisateur temporaire
- GET /bookings/my-bookings - Mes réservations
- GET /bookings/:id - Détail ma réservation
- GET /bookings/:id/pdf - Télécharger PDF réservation
- PATCH /bookings/:id/cancel - Annuler ma réservation

**Admin seulement (JWT + AdminGuard)**
- GET /auth/admin/check - Vérifier accès admin
- GET /users - Liste tous les utilisateurs
- GET /users/:id - Détail utilisateur
- DELETE /users/:id - Supprimer utilisateur
- GET /users/admin/search-by-email - Rechercher par email
- GET /retreats/admin - Toutes les retraites
- GET /retreats/admin/:id - Détail retraite
- POST /retreats/admin - Créer retraite
- PATCH /retreats/admin/:id - Modifier retraite
- DELETE /retreats/admin/:id - Supprimer retraite
- PATCH /retreats/admin/:id/toggle-active - Activer/désactiver retraite
- GET /retreats/admin/:id/reserved-places - Places réservées
- GET /retreats/admin/search - Rechercher retraites
- GET /bookings/admin/all - Toutes les réservations
- GET /bookings/admin/:id - Détail réservation
- PATCH /bookings/admin/:id/confirm - Confirmer réservation
- POST /bookings/admin/cleanup - Nettoyer réservations expirées
- GET /bookings/admin/stats - Statistiques réservations
- GET /bookings/admin/payment-discrepancies - Incohérences paiement
- POST /bookings/admin/send-payment-alert - Envoyer alerte paiement
- PATCH /bookings/admin/:id/cancel - Annuler réservation (admin)
- POST /bookings/admin/create - Créer réservation manuellement
- GET /analytics/stats - Statistiques analytics
- GET /analytics/event-types - Types d'événements
- DELETE /analytics/clear-all - Vider base analytics

## Avant la mise en production

- Changer JWT_SECRET et JWT_REFRESH_SECRET par des clés fortes
- Vérifier que HTTPS est activé
- Vérifier que le rate limiting est actif
- Mettre debug: false dans security.config.ts
- Faire un npm audit pour vérifier les vulnérabilités
