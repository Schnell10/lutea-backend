# Guide CI/CD - Lutea Backend

## 🎯 Vue d'ensemble

Ce guide explique comment mettre en place le pipeline CI/CD complet avec GitHub Actions, Docker Hub, Render et Vercel.

**Workflow recommandé :**
1. Modifier le code
2. Lancer les tests Node (lint + Jest) : `.\run-all-tests.ps1`
3. Valider l’environnement CI via Docker : `.\test-docker-compose.ps1`
4. Si tout est vert → Push sur GitHub
5. GitHub Actions rejoue les tests puis déploie

## 📋 Architecture du Pipeline

```
+-------------+
| Modif Code  |
+------+------+ 
       |
       v
+-------------------+
| Tests Node        | ← .\run-all-tests.ps1
| Lint + Jest       |
+-------------------+
       |
       v (si OK)
+-------------------+
| Tests Docker      | ← .\test-docker-compose.ps1
| Docker Compose    |
| ✅ Jest E2E       |
+-------------------+
       |
       v (si OK)
+-------------+
| Push GitHub |
+------+------+ 
       |
       v
+------------------+
| Tests (GitHub)   |
| ✅ ESLint        |
| ✅ Jest Unit     |
| ✅ Jest E2E      |
+------------------+
       |
       v (si OK)
+-------------------+
| Build Docker      |
| Push Docker Hub   |
+-------------------+
       |
       ├──────────────┬──────────────┐
       v              v              v
+-----------+  +-----------+  +-----------+
| Render    |  | Vercel    |  | Docker Hub|
| (Backend) |  | (Frontend)|  | (Images)  |
+-----------+  +-----------+  +-----------+
```

## 🔧 Configuration Requise

### 1. Secrets GitHub à Configurer

Dans GitHub : **Settings → Secrets and variables → Actions**

#### Secrets Docker Hub
- `DOCKERHUB_USERNAME` : Ton nom d'utilisateur Docker Hub
- `DOCKERHUB_TOKEN` : Token d'accès Docker Hub (pas le mot de passe)

#### Secrets Tests
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RECAPTCHA_SECRET_KEY`

#### Secrets Déploiement (Optionnels)
- `RENDER_DEPLOY_HOOK_URL` : URL du webhook Render (voir section Render)
- `VERCEL_TOKEN` : Token Vercel
- `VERCEL_ORG_ID` : ID de l'organisation Vercel
- `VERCEL_PROJECT_ID` : ID du projet Vercel

### 2. Docker Hub

1. Créer un compte sur [hub.docker.com](https://hub.docker.com)
2. Créer un **Access Token** :
   - Aller dans **Account Settings → Security**
   - Cliquer sur **New Access Token**
   - Copier le token et l'ajouter comme secret `DOCKERHUB_TOKEN`

### 3. Render (Backend)

1. Créer un compte sur [render.com](https://render.com)
2. Créer un **Web Service** :
   - **New → Web Service**
   - **Environment** : Docker
   - **Docker Image** : `ton-username/lutea-backend:latest`
3. Configurer les variables d'environnement dans Render
4. Obtenir l'**Auto-Deploy Webhook URL** :
   - Dans les settings du service → **Webhooks**
   - Copier l'URL et l'ajouter comme secret `RENDER_DEPLOY_HOOK_URL`

### 4. Vercel (Frontend)

1. Installer l'app Vercel GitHub
2. Connecter ton repo GitHub
3. Vercel détectera automatiquement Next.js
4. Récupérer les IDs depuis le dashboard Vercel

## 🚀 Comment ça fonctionne

### Workflow recommandé :

```
1. Tu modifies ton code
2. Tu passes les tests Node locaux : .\run-all-tests.ps1
3. Tu vérifies l’environnement CI avec Docker : .\test-docker-compose.ps1
4. Si tout est vert → Tu push sur GitHub
5. GitHub Actions rejoue les tests
6. Si tests OK → Build Docker → Déploiement
```

### Sur chaque Push :

1. **Tests automatiques** (GitHub Actions) :
   - **ESLint** : Vérifie la qualité du code (`npm run lint`)
   - **Jest - Tests unitaires** : Tests isolés (`npm test` ou `jest`)
   - **Jest - Tests E2E** : Tests end-to-end avec MongoDB dans Docker (`npm run test:e2e`)

2. **Si tests OK** :
   - Build de l'image Docker
   - Push vers Docker Hub avec tags :
     - `latest` (pour main)
     - `develop` (pour develop)
     - `main-<sha>` (pour traçabilité)

3. **Déploiement automatique** :
   - **Render** : Le webhook déclenche un redéploiement
   - **Vercel** : Déploiement automatique du frontend

### Sur Pull Request :

- Seulement les tests sont exécutés
- Pas de build Docker
- Pas de déploiement

## 🧪 Tests Locaux AVANT de Push (Important !)

**⚠️ Avant de push tes modifications, passe par les deux niveaux de tests !**

### 1. Tests rapides (Node local)

```powershell
# Depuis lutea-backend/
.\run-all-tests.ps1
```

Ce script enchaîne :
- `npm run lint`
- `npm test -- --coverage`
- `npm run test:e2e`

👉 Idéal pour vérifier rapidement que tout passe sans Docker (même commandes que GitHub Actions).

### 2. Tests complets dans Docker (miroir CI)

```powershell
# Depuis lutea-backend/
.\test-docker-compose.ps1
```

Ce que fait ce script :
- Vérifie que Docker Desktop est lancé
- Prépare `.env.docker` (copie de `.env.test` si besoin)
- Lance `docker-compose.test.yml` (Mongo + backend)
- Exécute `npm test` puis `npm run test:e2e` dans le conteneur
- Arrête et nettoie les conteneurs

✅ Si les deux scripts passent, tu peux push en toute confiance.

**Voir les détails :** `run-all-tests.ps1` et `TESTER-EN-DOCKER.md`

### Test de l'application Docker (optionnel)

```bash
# Build l'image
docker build -t lutea-backend:local .

# Lancer l'application
docker run -p 3002:3002 --env-file .env lutea-backend:local
```

### Push manuel vers Docker Hub (si besoin)

```bash
# Login
docker login -u ton-username

# Tag
docker tag lutea-backend:local ton-username/lutea-backend:latest

# Push
docker push ton-username/lutea-backend:latest
```

## ✅ Vérification

Après chaque push, vérifie :

1. **GitHub Actions** : Onglet "Actions" → Voir que les jobs passent
2. **Docker Hub** : Voir que l'image est bien poussée
3. **Render** : Voir que le déploiement est déclenché
4. **Vercel** : Voir que le frontend est déployé

## 🔍 Troubleshooting

### Tests échouent
- **Tester d'abord localement** : `.\test-docker-compose.ps1`
- **Jest** : Vérifier les tests unitaires (`npm test`)
- **Jest E2E** : Vérifier que MongoDB Docker fonctionne
- Vérifier les secrets GitHub
- Vérifier `.env.test` en local

### Docker Build échoue
- Vérifier `DOCKERHUB_USERNAME` et `DOCKERHUB_TOKEN`
- Vérifier que le Dockerfile est valide

### Render ne se déploie pas
- Vérifier `RENDER_DEPLOY_HOOK_URL`
- Vérifier les logs Render
- Le webhook peut être déclenché manuellement dans Render

### Vercel ne se déploie pas
- Vérifier les secrets Vercel
- Vérifier la configuration dans Vercel dashboard

## 📚 Ressources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Hub Documentation](https://docs.docker.com/docker-hub/)
- [Render Documentation](https://render.com/docs)
- [Vercel Documentation](https://vercel.com/docs)

