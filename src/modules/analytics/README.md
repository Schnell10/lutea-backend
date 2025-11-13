# Module Analytics

Module pour le tracking et l'analyse des événements utilisateurs dans MySQL.

## Installation

Installer les dépendances nécessaires :

```bash
npm install @nestjs/typeorm typeorm mysql2
```

## Configuration

Ajouter les variables d'environnement dans votre `.env` :

```env
# MySQL Analytics
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=votre_mot_de_passe
MYSQL_DATABASE=lutea_analytics
```

## Structure

- **entities/** : Entités TypeORM (Session, UserEvent, EventType)
- **dto/** : DTOs pour la validation des données
- **analytics.service.ts** : Logique métier
- **analytics.controller.ts** : Endpoints API
- **analytics.module.ts** : Module NestJS

## Endpoints

### Public (sans authentification)
- `POST /analytics/session` - Créer une session
- `PATCH /analytics/session/:sessionId` - Mettre à jour une session
- `POST /analytics/event` - Créer un événement

### Admin (authentification requise)
- `GET /analytics/stats` - Récupérer les statistiques
- `GET /analytics/event-types` - Récupérer les types d'événements

## Utilisation

Le module est automatiquement importé dans `app.module.ts` et la connexion MySQL est configurée.

## 🔐 Gestion des sessions (RGPD-friendly)

### Pourquoi utiliser sessionStorage ?

Pour lier les événements (`UserEvent`) à une session (`Session`), il est **nécessaire** de stocker un `session_id` côté frontend. Sans cela, chaque événement créerait une nouvelle session, ce qui fausserait complètement les statistiques.

### Solution : sessionStorage (RGPD-friendly)

Le `session_id` est stocké dans **sessionStorage** (pas localStorage, pas cookies) :

- ✅ **RGPD-friendly** : Disparaît à la fermeture de l'onglet
- ✅ **Pas de persistance** : Pas de tracking entre sessions
- ✅ **Pas de données personnelles** : Juste un UUID anonyme
- ✅ **Pas de cookies** : Pas considéré comme cookie de tracking

### Fonctionnement

```javascript
// 1. Au chargement de la page
const sessionId = sessionStorage.getItem('analytics_session_id') || generateUUID();
sessionStorage.setItem('analytics_session_id', sessionId);

// 2. Créer la session au backend (une seule fois)
POST /analytics/session { session_id: sessionId, ... }

// 3. Pour chaque événement, utiliser ce même session_id
POST /analytics/event { session_id: sessionId, event_type_code: 'page_view', ... }
```

**Important** : Le `session_id` est unique par onglet et disparaît à la fermeture. Chaque nouvelle visite = nouvelle session (comportement normal et RGPD-friendly).

## 📊 Liste complète des événements trackés

### 📱 Informations de session (capturées automatiquement)
- **Device type** : `mobile`, `desktop`, `tablet` (détecté automatiquement)
- **Browser** : `Chrome`, `Firefox`, `Safari`, `Edge`, etc. (détecté automatiquement)
- **Is login** : `true`/`false` (si l'utilisateur est connecté lors de la session)

### 🧭 Navigation
- `page_view` - Vue de page (automatique sur chaque changement de route)
- `page_exit` - Sortie de page (quand l'utilisateur quitte)
- **Métriques calculées automatiquement :**
  - Temps passé sur chaque page
  - Nombre total de pages visitées par session

### 🏔️ Retraites
- `retreat_modal_opened` - Ouverture de la modale d'information d'une retraite
- `booking_funnel_started` - Clic sur "Réserver une retraite" (démarrage du tunnel)

### 📝 Tunnel de réservation
- `booking_step_1` - Arrivée étape 1 : Choix de la retraite
- `booking_step_2` - Arrivée étape 2 : Choix de la date
- `booking_step_3` - Arrivée étape 3 : Choix des participants
- `booking_step_4` - Arrivée étape 4 : Confirmation
- `booking_step_5` - Arrivée étape 5 : Paiement
- `booking_abandoned` - Abandon du tunnel (avec l'étape dans `event_data`)
- **Métriques calculées automatiquement :**
  - Temps passé sur chaque étape du tunnel

### 💳 Paiement
- `payment_button_clicked` - Clic sur le bouton "Payer"
- `payment_succeeded` - Paiement réussi
- `payment_failed` - Paiement échoué

## 📈 Métriques calculées par le backend

- **Taux de rebond** : % de sessions avec 1 seule page vue < 30 secondes
- **Taux de conversion** : % de `booking_funnel_started` → `payment_succeeded`
- **Funnel de conversion** : Taux de passage entre chaque étape du tunnel
- **Point d'abandon** : Étape où le plus d'utilisateurs abandonnent
- **Temps moyen par étape** : Temps passé sur chaque étape du tunnel
- **Répartition par device** : % mobile vs desktop vs tablet
- **Répartition par browser** : % Chrome vs Firefox vs Safari, etc.
- **Taux de conversion utilisateurs connectés** : Comparaison connectés vs non-connectés


## 📝 Script SQL complet

Copiez-collez ce script dans MySQL  pour créer la base de données et les tables :

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

**⚠️ Attention** : Le script contient `DROP TABLE IF EXISTS`, donc les tables existantes seront supprimées. Si vous avez des données importantes, commentez ces lignes avant d'exécuter.

## 🔍 Requêtes SQL utiles

### Vérifier les types d'événements
```sql
SELECT * FROM EventType;
```

### Voir toutes les tables et leur contenu
```sql
-- Voir toutes les sessions
SELECT * FROM Session;

-- Voir tous les événements
SELECT * FROM UserEvent;

-- Voir les types d'événements
SELECT * FROM EventType;
```

### Requêtes avec détails
```sql
-- Voir les événements avec leurs types
SELECT 
    ue.event_id,
    ue.event_ts,
    ue.page_path,
    et.label as event_type,
    et.category,
    s.session_id,
    s.browser,
    s.device_type
FROM UserEvent ue
JOIN EventType et ON ue.code_EventType = et.code
JOIN Session s ON ue.session_id_Session = s.session_id
ORDER BY ue.event_ts DESC
LIMIT 50;

-- Compter les événements par type
SELECT 
    et.label,
    et.category,
    COUNT(*) as nombre
FROM UserEvent ue
JOIN EventType et ON ue.code_EventType = et.code
GROUP BY et.code, et.label, et.category
ORDER BY nombre DESC;
```



