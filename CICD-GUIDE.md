# Guide CI/CD - Backend

## Vue d'ensemble

Workflow complet : tests locaux → GitHub Actions → Docker Hub → Render.

## Workflow recommandé

1. Je modifie mon code
2. Je lance les tests Node : `.\run-all-tests.ps1`
3. Je valide avec Docker : `.\test-docker-compose.ps1`
4. Si tout est OK → Push sur GitHub
5. GitHub Actions lance les tests puis déploie

## Architecture


Modif Code
    ↓
Tests Node (.\run-all-tests.ps1)
    ↓
Tests Docker (.\test-docker-compose.ps1)
    ↓
Push GitHub
    ↓
GitHub Actions (Tests + Build Docker)
    ↓
Docker Hub (Image)
    ↓
Render (Déploiement)


## Configuration

### Secrets GitHub

Dans GitHub : Settings → Secrets and variables → Actions

**Docker Hub :**
- DOCKERHUB_USERNAME
- DOCKERHUB_TOKEN (Access Token, pas le mot de passe)
+ clef stripe
+ clef deploy render (voir tout ça dans .env)




### Docker Hub

1. Créer un compte sur hub.docker.com
2. Créer un Access Token : Account Settings → Security → New Access Token
3. Ajouter comme secret DOCKERHUB_TOKEN

### Render

1. Créer un Web Service : New → Web Service → Environment: Docker
2. Docker Image : `ton-username/lutea-backend:latest`
3. Configurer les variables d'environnement
4. Récupérer l'Auto-Deploy Webhook URL : Settings → Webhooks
5. Ajouter comme secret RENDER_DEPLOY_HOOK_URL

## Tests locaux avant push

Avant de push, je passe par deux niveaux de tests.

### Tests rapides (Node)


.\run-all-tests.ps1


Ce script lance :
- npm run lint
- npm test -- --coverage
- npm run test:e2e

### Tests complets (Docker)

powershell
.\test-docker-compose.ps1


Ce script :
- Vérifie Docker Desktop
- Lance MongoDB + backend dans Docker
- Exécute les tests
- Nettoie après

Si les deux scripts passent, je peux push.

## Sur chaque push

1. **Tests automatiques** (GitHub Actions) :
   - ESLint
   - Tests unitaires Jest
   - Tests E2E Jest (avec MongoDB Docker)

2. **Si tests OK** :
   - Build image Docker
   - Push sur Docker Hub (tags: latest, develop, main-<sha>)

3. **Déploiement** :
   - Render : webhook déclenche le redéploiement

## Sur Pull Request

- Seulement les tests
- Pas de build Docker
- Pas de déploiement

## Vérification

Après chaque push :
1. GitHub Actions : onglet Actions → vérifier que les jobs passent
2. Docker Hub : vérifier que l'image est poussée
3. Render : vérifier que le déploiement est déclenché

## Troubleshooting

**Tests échouent :**
- Tester d'abord localement : `.\test-docker-compose.ps1`
- Vérifier les secrets GitHub
- Vérifier `.env.test` en local

**Docker Build échoue :**
- Vérifier DOCKERHUB_USERNAME et DOCKERHUB_TOKEN
- Vérifier que le Dockerfile est valide

**Render ne se déploie pas :**
- Vérifier RENDER_DEPLOY_HOOK_URL
- Vérifier les logs Render
- Le webhook peut être déclenché manuellement dans Render

## Configuration MySQL (Analytics)

Le backend utilise MySQL pour stocker les données analytics (sessions, événements utilisateurs).

### Variables d'environnement

**À configurer dans Render :**
- MYSQL_HOST
- MYSQL_PORT (3306)
- MYSQL_USER
- MYSQL_PASSWORD
- MYSQL_DATABASE (`lutea_analytics`)


### Créer la base de données MySQL sur Render

1. Dans Render : New → MySQL
2. Créer la base de données
3. Récupérer les informations de connexion (host, port, user, password, database)
4. Configurer les variables d'environnement dans Render

### Créer les tables MySQL

Une fois la base créée, exécuter le script SQL pour créer les tables.

**Option 1 : Via l'interface Render**
- Aller dans la base de données MySQL
- Ouvrir l'onglet "Connect" ou "Query"
- Coller le script SQL complet (voir `lutea-backend/src/modules/analytics/README.md`)

**Option 2 : Via MySQL Workbench ou client MySQL**
- Se connecter à la base MySQL Render
- Exécuter le script SQL complet

Le script crée :
- Table `EventType` (types d'événements)
- Table `Session` (sessions utilisateurs)
- Table `UserEvent` (événements utilisateurs)
- Insère les types d'événements par défaut

**Important** : Le script contient `DROP TABLE IF EXISTS`, donc les tables existantes seront supprimées. Si on a des données importantes, on commente ces lignes avant d'exécuter.

### Vérification

Après création des tables, on vérifie que le backend se connecte correctement :
- Les logs au démarrage doivent afficher : `Base de données Analytics : MySQL (host/database)`
- On teste un endpoint analytics : `POST /analytics/session`
