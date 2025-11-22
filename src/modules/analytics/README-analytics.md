# Module Analytics

Module pour le tracking et l'analyse des événements utilisateurs dans MySQL.


## Configuration

MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=mon_mot_de_passe
MYSQL_DATABASE=lutea_analytics


En production (Render), j'utilise les valeurs Aiven avec `MYSQL_SSL=required`.

## Endpoints

- POST /analytics/session - Créer une session
- PATCH /analytics/session/:sessionId - Mettre à jour une session
- POST /analytics/event - Créer un événement
- GET /analytics/stats - Statistiques (admin)
- GET /analytics/event-types - Types d'événements (admin)

## Gestion des sessions

Le session_id est stocké dans sessionStorage (RGPD-friendly, disparaît à la fermeture de l'onglet).

## Configuration MySQL

### En développement (local)

1. Je crée une base `lutea_analytics` en local
2. Je configure mon `.env` avec les variables MySQL locales
3. Je me connecte avec MySQL Workbench (connexion locale, pas de SSL)
4. J'exécute le script SQL ci-dessous

### En production (Aiven)

1. Dans Aiven : Service → Overview → Connection information, je récupère :
   - Host, Port (10091), User (avnadmin), Password, SSL mode (REQUIRED)
   - Je télécharge le CA certificate

2. Je configure MySQL Workbench pour Aiven :
   - New Connection
   - Hostname : lutea-mysql-xxxxxx.c.aivencloud.com
   - Port : 10091 (important, pas 3306)
   - Username : avnadmin
   - Password : mot de passe Aiven
   - Default Schema : lutea_analytics
   - SSL : Require
   - SSL CA File : ca.pem téléchargé depuis Aiven

3. Je crée la base `lutea_analytics` dans Aiven (Service → Databases)

4. Je me connecte à Aiven via MySQL Workbench et j'exécute le script SQL

5. Je configure les variables dans Render :

   MYSQL_HOST=lutea-mysql-xxxxxx.c.aivencloud.com
   MYSQL_PORT=10091
   MYSQL_USER=avnadmin
   MYSQL_PASSWORD=le_password_aiven
   MYSQL_DATABASE=lutea_analytics
   MYSQL_SSL=required


## Script SQL

```sql
CREATE DATABASE IF NOT EXISTS lutea_analytics 
CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE lutea_analytics;

DROP TABLE IF EXISTS UserEvent;
DROP TABLE IF EXISTS Session;
DROP TABLE IF EXISTS EventType;

CREATE TABLE EventType(
    code VARCHAR(50) NOT NULL,
    label VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL,
    is_enabled BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (code),
    INDEX idx_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

INSERT INTO EventType (code, label, category, is_enabled) VALUES
('page_view', 'Vue de page', 'navigation', TRUE),
('page_exit', 'Sortie de page', 'navigation', TRUE),
('retreat_modal_opened', 'Modal retraite ouverte', 'retreats', TRUE),
('booking_funnel_started', 'Démarrage tunnel réservation', 'retreats', TRUE),
('booking_step_1', 'Étape 1 : Choix retraite', 'booking', TRUE),
('booking_step_2', 'Étape 2 : Choix date', 'booking', TRUE),
('booking_step_3', 'Étape 3 : Choix participants', 'booking', TRUE),
('booking_step_4', 'Étape 4 : Confirmation', 'booking', TRUE),
('booking_step_5', 'Étape 5 : Paiement', 'booking', TRUE),
('booking_abandoned', 'Réservation abandonnée', 'booking', TRUE),
('payment_button_clicked', 'Clic sur bouton paiement', 'payment', TRUE),
('payment_succeeded', 'Paiement réussi', 'payment', TRUE),
('payment_failed', 'Paiement échoué', 'payment', TRUE);
```

Attention : Le script contient DROP TABLE IF EXISTS. Si j'ai des données importantes, je commente ces lignes avant d'exécuter.
