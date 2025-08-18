# 🔐 Guide de Sécurité - Backend Lutea

## 🛡️ Mesures de Sécurité Implémentées

### 1. **Authentification JWT**
- **Tokens d'accès** : Expiration en 15 minutes
- **Refresh tokens** : Expiration en 7 jours
- **Signature sécurisée** : Utilisation d'une clé secrète forte
- **Validation en base** : Vérification systématique de l'existence de l'utilisateur

### 2. **Gestion des Mots de Passe**
- **Hachage bcrypt** : 12 rounds de salage
- **Longueur minimale** : 8 caractères
- **Validation des entrées** : Vérification de la force du mot de passe

### 3. **Protection contre les Attaques**
- **Verrouillage de compte** : Après 5 tentatives échouées
- **Durée de verrouillage** : 15 minutes
- **Rate limiting** : Limitation des requêtes par IP
- **Validation des entrées** : Protection contre l'injection

### 4. **Gestion des Rôles**
- **AdminGuard** : Protection des endpoints administrateur
- **ClientGuard** : Protection des endpoints client
- **OwnerGuard** : Vérification de la propriété des ressources
- **Vérification en base** : Contrôle systématique des rôles

### 5. **Double Authentification (2FA)**
- **Code à 6 chiffres** : Génération sécurisée
- **Expiration** : 10 minutes
- **Réservé aux admins** : Sécurité renforcée

## 🚨 Variables d'Environnement Requises

```bash
# Base de données
MONGODB_URI=mongodb://localhost:27017/lutea

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Application
NODE_ENV=production
FRONTEND_URL=https://votre-domaine.com

# Email (pour 2FA)
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

## 🔒 Endpoints Sécurisés

### **Public**
- `POST /auth/register` - Inscription
- `POST /auth/login` - Connexion

### **Authentifiés (JWT)**
- `GET /auth/profile` - Profil utilisateur
- `PUT /auth/profile` - Modification du profil
- `PUT /auth/profile/password` - Changement de mot de passe
- `POST /auth/refresh` - Renouvellement du token
- `POST /auth/logout` - Déconnexion

### **Admin Seulement**
- `GET /users` - Liste des utilisateurs
- `GET /users/:id` - Détails d'un utilisateur
- `POST /auth/2fa/generate` - Génération code 2FA
- `POST /auth/2fa/verify` - Vérification code 2FA

## 🚀 Déploiement en Production

1. **Changer la clé JWT_SECRET**
2. **Configurer HTTPS**
3. **Activer le rate limiting**
4. **Configurer les logs de sécurité**
5. **Mettre en place la surveillance**

## 📝 Logs de Sécurité

Le système enregistre automatiquement :
- Tentatives de connexion échouées
- Verrouillages de compte
- Changements de rôle
- Accès aux ressources sensibles

## 🔍 Tests de Sécurité

```bash
# Tests unitaires
npm run test

# Tests d'intégration
npm run test:e2e

# Vérification des vulnérabilités
npm audit
```
