# Lutea Backend - API REST

## Vue d'ensemble

API REST sécurisée avec NestJS pour gérer une plateforme de réservation de retraites. Système complet d'authentification, gestion des utilisateurs, réservations et paiements via Stripe.

## Technologies

- Framework : NestJS (Node.js)
- Base de données : MongoDB (données principales) + MySQL (analytics)
- Authentification : JWT + Passport
- Paiements : Stripe
- Emails : Resend

## Structure


src/
├── main.ts                 # Point d'entrée
├── app.module.ts          # Module racine
├── config/                # Configuration centralisée
├── common/                # Modules partagés (guards, decorators, middleware)
└── modules/              # Modules métier
    ├── auth/            # Authentification
    ├── users/           # Gestion utilisateurs
    ├── retreats/        # Gestion retraites
    ├── bookings/        # Gestion réservations
    ├── stripe/          # Paiements Stripe
    ├── email/           # Service email
    └── analytics/        # Analytics (MySQL)


## Modules principaux

**Auth** : Inscription, connexion, JWT, 2FA pour admins, reset password

**Users** : CRUD utilisateurs, gestion rôles (CLIENT/ADMIN), comptes temporaires

**Retreats** : CRUD retraites, consultation publique, gestion places et dates

**Bookings** : Création réservations, vérification places, statuts, intégration Stripe

**Stripe** : PaymentIntent, webhooks, annulation paiements

**Email** : Emails de confirmation, formulaire contact, alertes admin, PDFs

**Analytics** : Tracking sessions et événements utilisateurs (MySQL)

## Installation


npm install
npm run start:dev


## Configuration

Fichiers de configuration :
- `config/lutea.config.ts` : Données entreprise et emails
- `config/security.config.ts` : Sécurité (JWT, 2FA, rate limiting, logging)

## Sécurité

- JWT : Access token 15min, Refresh token 7 jours
- 2FA pour admins : Code à 8 chiffres
- Rate limiting : 100 requêtes/minute par IP
- Guards : JwtAuthGuard, AdminGuard, ClientGuard, OwnerGuard
- Validation : DTOs avec class-validator
- CORS : Configuration restrictive (uniquement FRONTEND_URL en production)

## Base de données

**MongoDB** : Users, Retreats, Bookings

**MySQL** : Sessions analytics, UserEvent, EventType

## Endpoints principaux

**Public** : register, login, forgot-password, reset-password, retreats/public, bookings (création), stripe/webhook, analytics/session, analytics/event

**Authentifié (JWT)** : logout, profile, user-info, users/profile, bookings/my-bookings, bookings/:id

**Admin (JWT + AdminGuard)** : users (CRUD), retreats/admin (CRUD), bookings/admin (toutes), analytics/stats, analytics/event-types, analytics/clear-all

Voir `SECURITY.md` pour la liste complète.


## Documentation

- `SECURITY.md` : Sécurité et endpoints protégés
- `CICD-GUIDE.md` : Guide CI/CD
- `TESTER-EN-DOCKER.md` : Tests avec Docker
- `modules/analytics/README.md` : Documentation analytics
