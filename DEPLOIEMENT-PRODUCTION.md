# Guide de Déploiement en Production - Backend Lutea

## 📋 Checklist avant de commencer

- [x] Secrets Stripe TEST ajoutés dans GitHub (`STRIPE_SECRET_KEY_TEST`, `STRIPE_WEBHOOK_SECRET_TEST`)
- [ ] Secrets Docker Hub à ajouter (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`)
- [ ] Service Render (backend) à créer
- [ ] Base MySQL Aiven à créer (pour analytics)
- [ ] Tables MySQL à créer (script SQL via MySQL Workbench)
- [ ] Variables d'environnement Render à configurer
- [ ] Secret Render webhook à ajouter dans GitHub
- [ ] Tests locaux à valider

---

## Étape 1 : Ajouter les secrets Docker Hub dans GitHub

### 1.1 Créer un compte Docker Hub (si pas déjà fait)

1. Aller sur [hub.docker.com](https://hub.docker.com)
2. Créer un compte ou se connecter

### 1.2 Créer un Access Token Docker Hub

1. Dans Docker Hub : **Account Settings** → **Security** → **New Access Token**
2. Nom : `lutea-backend-ci` (ou autre nom)
3. Permissions : **Read & Write**
4. **Copier le token** (il ne sera plus visible après !)

### 1.3 Ajouter les secrets dans GitHub

1. Dans ton repo GitHub : **Settings** → **Secrets and variables** → **Actions**
2. Cliquer sur **"New repository secret"**

**Secret 1 : `DOCKERHUB_USERNAME`**
- Name : `DOCKERHUB_USERNAME`
- Secret : Ton nom d'utilisateur Docker Hub
- Cliquer sur **"Add secret"**

**Secret 2 : `DOCKERHUB_TOKEN`**
- Name : `DOCKERHUB_TOKEN`
- Secret : Le token que tu viens de créer
- Cliquer sur **"Add secret"**

✅ **Vérification** : Tu dois maintenant avoir 4 secrets dans GitHub :
- `STRIPE_SECRET_KEY_TEST`
- `STRIPE_WEBHOOK_SECRET_TEST`
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`

---

## Étape 2 : Créer le service Render

### 2.1 Créer un compte Render (si pas déjà fait)

1. Aller sur [render.com](https://render.com)
2. Créer un compte ou se connecter

### 2.2 Créer un nouveau Web Service

1. Dans Render : Cliquer sur **"New +"** → **"Web Service"**
2. **Connect Repository** : Connecter ton repo GitHub (optionnel si tu utilises Docker Hub)
3. **Configuration** :
   - **Name** : `lutea-backend` (ou autre nom)
   - **Language** : **Docker**
   - **Region** : Choisir la région la plus proche (ex: Frankfurt)
   - **Branch** : `main` (ou `develop` pour staging) - optionnel si tu utilises Docker Hub
   - **Root Directory** : Laisser vide (pas nécessaire avec Docker Hub)
   - **Instance Type** : **Starter** ($7/mois) - Recommandé pour production (pas Free qui se met en veille)
   - **Auto-Deploy** : **Yes** (déploiement automatique à chaque push)

4. **Avant de cliquer sur "Create Web Service"**, aller dans la section **"Docker"** (si visible) ou créer le service puis configurer après

### 2.2.1 Configurer Docker Hub sur Render

**Méthode 1 : Pendant la création (si l'option est visible)**
- Dans la section **"Docker"** du formulaire de création
- Cocher **"Use Docker image from registry"**
- **Docker Image** : `ton-username-dockerhub/lutea-backend:latest`
  - ⚠️ Remplacer `ton-username-dockerhub` par ton vrai username Docker Hub
- **Docker Registry Credentials** :
  - **Username** : Ton username Docker Hub
  - **Password** : Ton Access Token Docker Hub (le même que `DOCKERHUB_TOKEN` dans GitHub)

**Méthode 2 : Après la création du service**
1. Créer le service avec les paramètres de base
2. Une fois créé, aller dans **Settings** → **Docker**
3. Cocher **"Use Docker image from registry"**
4. **Docker Image** : `ton-username-dockerhub/lutea-backend:latest`
5. **Docker Registry Credentials** :
   - **Username** : Ton username Docker Hub
   - **Password** : Ton Access Token Docker Hub

4. Cliquer sur **"Save Changes"**

Note : Render utilisera l'image Docker Hub buildée par GitHub Actions. Plus rapide car Render n'a pas à builder l'image.

### 2.3 Récupérer le Webhook URL

1. Dans ton service Render : **Settings** → **Webhooks**
2. Copier l'**"Auto-Deploy Webhook URL"** (commence par `https://api.render.com/deploy/srv-...`)

---

## Étape 2.5 : Créer la base de données MySQL sur Aiven (Analytics)

### 2.5.1 Créer la base MySQL sur Aiven

1. Aller sur [console.aiven.io](https://console.aiven.io)
2. Créer un projet ou utiliser un projet existant
3. Dans le projet : Cliquer sur **"Create service"** → **"MySQL"**
4. **Configuration** :
   - **Service name** : `lutea-mysql` (ou autre nom)
   - **Plan** : Choisir un plan (gratuit disponible pour tester)
   - **Region** : Choisir une région proche
5. Cliquer sur **"Create service"**

### 2.5.2 Récupérer les informations de connexion

Une fois la base créée, Aiven affiche les informations de connexion :

1. Dans Aiven : Service → **Overview** → **Connection information**
2. **Copier ces informations** (tu en auras besoin pour les variables d'environnement) :
   - **Host** : `lutea-mysql-xxxxxx.c.aivencloud.com`
   - **Port** : `10091` (⚠️ important, pas 3306)
   - **User** : `avnadmin`
   - **Password** : Généré automatiquement par Aiven (⚠️ **Copier maintenant**, il ne sera plus visible !)
   - **Database** : `defaultdb` (par défaut) ou créer `lutea_analytics`
   - **SSL mode** : `REQUIRED`
   - **CA certificate** : Télécharger via "Download CA certificate"

### 2.5.3 Créer la base de données lutea_analytics

1. Dans Aiven : Service → **Databases** → **Create database**
2. Nom : `lutea_analytics`
3. Cliquer sur **"Create"**

### 2.5.4 Se connecter à Aiven via MySQL Workbench

1. **Télécharger MySQL Workbench** : [dev.mysql.com/downloads/workbench](https://dev.mysql.com/downloads/workbench/)
2. **Nouvelle connexion** dans MySQL Workbench :
   - **Hostname** : `lutea-mysql-xxxxxx.c.aivencloud.com`
   - **Port** : `10091` (⚠️ important, sinon Workbench utilise 3306 par défaut)
   - **Username** : `avnadmin`
   - **Password** : Mot de passe Aiven (stocker via "Store in Vault...")
   - **Default Schema** : `lutea_analytics` (ou `defaultdb`)
   - **SSL** :
     - **Use SSL** : Require
     - **SSL CA File** : Sélectionner le fichier `ca.pem` téléchargé depuis Aiven
     - **Client Key** et **Client Cert** : Laisser vides
3. **Tester la connexion** puis **Connect**

### 2.5.5 Exécuter le script SQL

Une fois connecté à Aiven via MySQL Workbench, exécuter le script SQL ci-dessous pour créer les tables.

### 📝 Script SQL à exécuter

Copie-colle ce script complet dans MySQL :

```sql
-- ============================================
-- Script de création de la base de données Analytics
-- Base de données : lutea_analytics
-- ============================================

-- Créer la base de données si elle n'existe pas
CREATE DATABASE IF NOT EXISTS lutea_analytics 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Utiliser la base de données
USE lutea_analytics;

-- ============================================
-- Supprimer les tables existantes (si besoin)
-- ============================================
DROP TABLE IF EXISTS UserEvent;
DROP TABLE IF EXISTS Session;
DROP TABLE IF EXISTS EventType;

-- ============================================
-- Table EventType
-- Définit les types d'événements trackés
-- ============================================
CREATE TABLE EventType(
    code VARCHAR(50) NOT NULL,
    label VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (code),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Table Session
-- Représente une session utilisateur
-- ============================================
CREATE TABLE Session(
    session_id VARCHAR(36) NOT NULL,
    started_at DATETIME NOT NULL,
    ended_at DATETIME NULL,
    browser VARCHAR(50) NULL,
    device_type ENUM('mobile', 'desktop', 'tablet') NULL,
    is_login BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (session_id),
    INDEX idx_started_at (started_at),
    INDEX idx_is_login (is_login)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Table UserEvent
-- Représente un événement utilisateur dans une session
-- ============================================
CREATE TABLE UserEvent(
    event_id INT AUTO_INCREMENT,
    event_ts DATETIME NOT NULL,
    page_path VARCHAR(500) NULL,
    event_data JSON NULL,
    session_id_Session VARCHAR(36) NOT NULL,
    code_EventType VARCHAR(50) NOT NULL,
    PRIMARY KEY (event_id),
    INDEX idx_session_id (session_id_Session),
    INDEX idx_event_type (code_EventType),
    INDEX idx_event_ts (event_ts),
    INDEX idx_page_path (page_path),
    CONSTRAINT FK_UserEvent_session_id_Session 
        FOREIGN KEY (session_id_Session) REFERENCES Session(session_id) 
        ON DELETE CASCADE,
    CONSTRAINT FK_UserEvent_code_EventType 
        FOREIGN KEY (code_EventType) REFERENCES EventType(code) 
        ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- Insertion des types d'événements
-- ============================================
INSERT INTO EventType (code, label, category, is_enabled) VALUES
-- Navigation
('page_view', 'Vue de page', 'navigation', TRUE),
('page_exit', 'Sortie de page', 'navigation', TRUE),

-- Retraites
('retreat_modal_opened', 'Modal retraite ouverte', 'retreats', TRUE),
('booking_funnel_started', 'Démarrage tunnel réservation', 'retreats', TRUE),

-- Tunnel de réservation
('booking_step_1', 'Étape 1 : Choix retraite', 'booking', TRUE),
('booking_step_2', 'Étape 2 : Choix date', 'booking', TRUE),
('booking_step_3', 'Étape 3 : Choix participants', 'booking', TRUE),
('booking_step_4', 'Étape 4 : Confirmation', 'booking', TRUE),
('booking_step_5', 'Étape 5 : Paiement', 'booking', TRUE),
('booking_abandoned', 'Réservation abandonnée', 'booking', TRUE),

-- Paiement
('payment_button_clicked', 'Clic sur bouton paiement', 'payment', TRUE),
('payment_succeeded', 'Paiement réussi', 'payment', TRUE),
('payment_failed', 'Paiement échoué', 'payment', TRUE);
```

⚠️ **Attention** : Le script contient `DROP TABLE IF EXISTS`, donc les tables existantes seront supprimées. Si tu as déjà des données, commente ces lignes avant d'exécuter.

### 2.5.4 Vérifier que les tables sont créées

Après avoir exécuté le script, vérifie que tout est OK :

```sql
-- Voir toutes les tables
SHOW TABLES;

-- Voir les types d'événements
SELECT * FROM EventType;

-- Devrait afficher 11 types d'événements
```

✅ **Vérification** : Tu dois avoir 3 tables créées :
- `EventType` (11 lignes)
- `Session` (vide pour l'instant)
- `UserEvent` (vide pour l'instant)

---

## Étape 3 : Ajouter le secret Render dans GitHub

1. Dans GitHub : **Settings** → **Secrets and variables** → **Actions**
2. Cliquer sur **"New repository secret"**
3. **Name** : `RENDER_DEPLOY_HOOK_URL`
4. **Secret** : Coller l'URL du webhook Render
5. Cliquer sur **"Add secret"**

✅ **Vérification** : Tu dois maintenant avoir 5 secrets dans GitHub

---

## Étape 4 : Configurer les variables d'environnement dans Render

Dans ton service Render : **Environment** → **Add Environment Variable**

### Variables obligatoires (à ajouter une par une) :

#### Base de données MongoDB
```
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/lutea?retryWrites=true&w=majority
```
⚠️ **Utilise ta base MongoDB de PRODUCTION** (pas celle de test !)

#### JWT (tokens d'authentification)
```
JWT_SECRET=ta_clé_jwt_très_longue_et_complexe_pour_production
JWT_REFRESH_SECRET=ta_clé_refresh_très_longue_et_complexe_pour_production
```
⚠️ **Génère des clés fortes et uniques** (pas les mêmes qu'en test !)

#### Stripe (PRODUCTION - clés LIVE)
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```
⚠️ **Utilise tes clés Stripe LIVE** (pas les clés TEST !)

#### Email (Resend)
```
RESEND_API_KEY=re_...
```
⚠️ **Utilise ta clé Resend de production**

#### reCAPTCHA
```
RECAPTCHA_SECRET_KEY=ta_clé_recaptcha_production
```

#### Frontend URL (CORS)
```
FRONTEND_URL=https://ton-frontend.vercel.app
```
⚠️ **URL exacte de ton frontend Vercel** (sans slash final)

#### Node Environment
```
NODE_ENV=production
```

#### Port (optionnel, Render le gère automatiquement)
```
PORT=3002
```

### Variables MySQL (Analytics) - Obligatoire si tu as créé MySQL sur Aiven

Si tu as créé la base MySQL sur Aiven, ajoute ces variables avec les informations de connexion Aiven :

```
MYSQL_HOST=lutea-mysql-xxxxxx.c.aivencloud.com
MYSQL_PORT=10091
MYSQL_USER=avnadmin
MYSQL_PASSWORD=le_password_généré_par_aiven
MYSQL_DATABASE=lutea_analytics
MYSQL_SSL=required
```

⚠️ **Important** : 
- Utilise les informations exactes de ton service MySQL Aiven (Service → Overview → Connection information)
- Le port est **10091** (pas 3306)
- SSL est obligatoire avec Aiven, donc `MYSQL_SSL=required` est nécessaire

✅ **Vérification** : Toutes les variables sont ajoutées dans Render

---

## 💰 Coûts estimés

### Backend (Render)
- **Plan Free** : Gratuit (mais peut se mettre en veille après inactivité)
- **Plan Starter** : $7/mois (512 MB RAM, toujours actif) - Recommandé pour production
- **Plan Standard** : $20/mois (1 GB RAM)

### MySQL (Aiven)
- **Plan Free** : Disponible pour tester
- **Plan payant** : À partir de quelques dollars/mois selon l'utilisation

💡 **Conseil** : Commence avec le plan **Starter** pour Render ($7/mois) et un plan gratuit ou basique pour Aiven. Tu peux upgrader plus tard si besoin.

---

## Étape 5 : Tester localement avant de push

### 5.1 Vérifier que les tests passent

```powershell
cd lutea-backend
.\run-all-tests.ps1
```

### 5.2 Vérifier avec Docker

```powershell
.\test-docker-compose.ps1
```

✅ **Si les deux passent**, tu peux push !

---

## Étape 6 : Push sur GitHub

### 6.1 Commiter les changements

```powershell
git add .
git commit -m "feat: préparation déploiement production"
```

### 6.2 Push sur la branche main

```powershell
git push origin main
```

⚠️ **Important** : Le workflow GitHub Actions se déclenche uniquement sur `main` ou `develop`

---

## Étape 7 : Vérifier le déploiement

### 7.1 Vérifier GitHub Actions

1. Dans GitHub : Onglet **"Actions"**
2. Vérifier que le workflow **"CI/CD Pipeline"** est en cours
3. Attendre que tous les jobs passent :
   - ✅ **Tests et Linter** (doit passer)
   - ✅ **Build et Push Docker** (doit passer)
   - ✅ **Déployer sur Render** (doit passer)

### 7.2 Vérifier Docker Hub

1. Aller sur [hub.docker.com](https://hub.docker.com)
2. Vérifier que l'image `ton-username/lutea-backend:latest` a été créée/mise à jour

### 7.3 Vérifier Render

1. Dans Render : Aller dans ton service
2. Onglet **"Events"** : Vérifier que le déploiement est en cours
3. Onglet **"Logs"** : Vérifier qu'il n'y a pas d'erreurs
4. Attendre que le statut passe à **"Live"**

---

## Étape 8 : Tester le backend en production

### 8.1 Récupérer l'URL du backend

Dans Render : L'URL est affichée en haut (ex: `https://lutea-backend.onrender.com`)

### 8.2 Tester un endpoint

```bash
curl https://ton-backend.onrender.com/health
```

Ou dans le navigateur : `https://ton-backend.onrender.com/health`

### 8.3 Vérifier les logs

Dans Render : Onglet **"Logs"** → Vérifier qu'il n'y a pas d'erreurs

---

## ⚠️ Problèmes courants et solutions

### Les tests échouent sur GitHub Actions

- Vérifier que les secrets `STRIPE_SECRET_KEY_TEST` et `STRIPE_WEBHOOK_SECRET_TEST` sont bien configurés
- Vérifier que `NODE_ENV=test` est bien défini (déjà fait ✅)

### Le build Docker échoue

- Vérifier que `DOCKERHUB_USERNAME` et `DOCKERHUB_TOKEN` sont corrects
- Vérifier que le Dockerfile est valide

### Render ne se déploie pas

- Vérifier que `RENDER_DEPLOY_HOOK_URL` est correct
- Vérifier les logs Render pour voir l'erreur
- Le webhook peut être déclenché manuellement dans Render : **Manual Deploy**

### Le backend ne démarre pas sur Render

- Vérifier toutes les variables d'environnement dans Render
- Vérifier les logs Render (onglet **"Logs"**)
- Vérifier que `MONGODB_URI` est correct
- Vérifier que `FRONTEND_URL` est correct (sans slash final)

### Erreur CORS

- Vérifier que `FRONTEND_URL` dans Render correspond exactement à l'URL de ton frontend Vercel
- Vérifier que le frontend utilise la bonne URL backend dans `NEXT_PUBLIC_API_BASE_URL`

### Erreur de connexion MySQL

- Vérifier que toutes les variables MySQL sont correctes dans Render :
  - `MYSQL_HOST` : Doit être `xxxxx.c.aivencloud.com` (Aiven, pas `localhost`)
  - `MYSQL_PORT` : `10091` (Aiven, pas 3306)
  - `MYSQL_USER` : `avnadmin` (Aiven)
  - `MYSQL_PASSWORD` : Le mot de passe généré par Aiven
  - `MYSQL_DATABASE` : `lutea_analytics` (ou `defaultdb` si tu utilises la base par défaut)
  - `MYSQL_SSL` : `required` (obligatoire pour Aiven)
- Vérifier que les tables sont créées (exécuter le script SQL via MySQL Workbench connecté à Aiven)
- Vérifier les logs Render : doit afficher "Base de données Analytics : MySQL (host/database)"
- Si erreur "Access denied" : Vérifier que le user/password sont corrects
- Si erreur "Unknown database" : Vérifier que `MYSQL_DATABASE` correspond au nom de la base créée dans Aiven
- Si erreur SSL : Vérifier que `MYSQL_SSL=required` est bien défini

---

## 📝 Checklist finale

- [ ] Tous les secrets GitHub sont configurés (5 secrets)
- [ ] Service Render (backend) créé et configuré
- [ ] Base MySQL Aiven créée
- [ ] Tables MySQL créées (script SQL exécuté via MySQL Workbench connecté à Aiven)
- [ ] Toutes les variables d'environnement Render sont configurées (y compris MySQL)
- [ ] Tests locaux passent
- [ ] Push sur GitHub effectué
- [ ] GitHub Actions passe (tous les jobs verts)
- [ ] Image Docker poussée sur Docker Hub
- [ ] Render déployé et "Live"
- [ ] Backend répond aux requêtes
- [ ] Logs Render sans erreurs
- [ ] Connexion MySQL vérifiée (logs doivent afficher "Base de données Analytics : MySQL")

---

## 🎉 Félicitations !

Ton backend est maintenant en production ! 

À chaque push sur `main`, le workflow :
1. Lance les tests
2. Build et push l'image Docker
3. Déclenche le déploiement Render automatiquement

---

## Prochaines étapes

1. **Configurer le frontend** pour utiliser l'URL du backend Render
2. **Tester l'intégration** frontend ↔ backend
3. **Monitorer les logs** Render régulièrement
4. **Configurer les alertes** si nécessaire

