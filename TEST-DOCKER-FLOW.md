# Comment fonctionnent les tests Docker

## Vue d'ensemble

Quand tu lances `.\test-docker-compose.ps1`, plusieurs fichiers travaillent ensemble pour créer un environnement de test isolé dans Docker.

## Les fichiers impliqués

```
lutea-backend/
├── test-docker-compose.ps1    # Script PowerShell (point d'entrée)
├── docker-compose.test.yml    # Configuration Docker Compose
├── Dockerfile                  # Image Docker du backend
├── test-env-setup.js          # Script de configuration des variables
└── .env.test                  # Variables pour tests (utilisé partout)
```

## Flux d'exécution

### Étape 1 : Script PowerShell (`test-docker-compose.ps1`)

```
┌─────────────────────────────────────┐
│  test-docker-compose.ps1            │
│                                      │
│  1. Vérifie Docker Desktop          │
│  2. Vérifie .env.test existe        │
│  3. Lance docker-compose             │
└──────────────┬──────────────────────┘
               │
               ▼
```

### Étape 2 : Docker Compose (`docker-compose.test.yml`)

```
┌─────────────────────────────────────┐
│  docker-compose.test.yml            │
│                                      │
│  Services :                         │
│  ┌─────────────┐  ┌──────────────┐ │
│  │   mongo      │  │   backend    │ │
│  │              │  │              │ │
│  │ MongoDB:6    │  │ Build depuis │ │
│  │ Port: 27017  │  │ Dockerfile   │ │
│  └─────────────┘  └──────┬───────┘ │
│                           │         │
│  Variables injectées :    │         │
│  - env_file: .env.test    │         │
│  - environment:           │         │
│    NODE_ENV=test   │         │
│    RUNNING_IN_DOCKER=true │         │
│    MONGODB_URI=           │         │
│      mongo:27017/...      │         │
└───────────────────────────┼─────────┘
                            │
                            ▼
```

### Étape 3 : Build Docker (`Dockerfile`)

```
┌─────────────────────────────────────┐
│  Dockerfile                         │
│                                      │
│  Stage 1: Build                     │
│  - Installe dépendances             │
│  - Build NestJS (npm run build)     │
│                                      │
│  Stage 2: Production                │
│  - Copie code compilé               │
│  - Installe dépendances prod        │
│  - CMD: node dist/main.js           │
└──────────────┬──────────────────────┘
               │
               ▼
```

### Étape 4 : Tests dans le conteneur

```
┌─────────────────────────────────────┐
│  Conteneur backend                  │
│                                      │
│  Variables disponibles :            │
│  ┌──────────────────────────────┐   │
│  │ Depuis .env.test :          │   │
│  │ - JWT_SECRET                │   │
│  │ - STRIPE_SECRET_KEY         │   │
│  │ - RESEND_API_KEY            │   │
│  │ - etc.                      │   │
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │ Surchargées par docker-      │   │
│  │ compose (environment:) :     │   │
│  │ - NODE_ENV=development       │   │
│  │ - RUNNING_IN_DOCKER=true     │   │
│  │ - MONGODB_URI=mongo:27017/...│   │
│  └──────────────────────────────┘   │
│                                      │
│  Commande exécutée :                │
│  npm test && npm run test:e2e      │
│                                      │
│  ┌──────────────────────────────┐   │
│  │ Avant les tests E2E :        │   │
│  │ test-env-setup.js s'exécute  │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Étape 5 : Configuration des variables (`test-env-setup.js`)

```
┌─────────────────────────────────────┐
│  test-env-setup.js                  │
│                                      │
│  Détection :                        │
│  ┌──────────────────────────────┐   │
│  │ RUNNING_IN_DOCKER === 'true' │   │
│  │ &&                            │   │
│  │ MONGODB_URI.includes('mongo') │   │
│  └──────────────┬─────────────────┘   │
│                 │                       │
│        ┌────────┴────────┐            │
│        │                  │            │
│     OUI                NON             │
│        │                  │            │
│        ▼                  ▼            │
│  ┌──────────┐      ┌──────────────┐   │
│  │ Docker   │      │ Local        │   │
│  │          │      │              │   │
│  │ Variables│      │ Cherche      │   │
│  │ déjà là  │      │ .env.test    │   │
│  │          │      │              │   │
│  │ Ne fait  │      │ Charge les   │   │
│  │ rien     │      │ variables    │   │
│  └──────────┘      └──────────────┘   │
└─────────────────────────────────────┘
```

## Schéma complet du flux

```
┌─────────────────────────────────────────────────────────────┐
│  TU LANCES : .\test-docker-compose.ps1                     │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │ 1. Vérifie Docker Desktop    │
        │ 2. Vérifie .env.test          │
        └───────────────┬───────────────┘
                        │
                        ▼
        ┌───────────────────────────────┐
        │ docker-compose up             │
        │ -f docker-compose.test.yml     │
        └───────────────┬───────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────┐              ┌───────────────┐
│ Service mongo │              │ Service       │
│               │              │ backend       │
│ - Lance       │              │               │
│   MongoDB     │              │ - Build       │
│ - Port 27017  │              │   Dockerfile  │
└───────┬───────┘              │ - Injecte     │
        │                      │   variables   │
        │                      │ - Lance tests │
        │                      └───────┬───────┘
        │                              │
        └──────────┬───────────────────┘
                   │
                   ▼
        ┌───────────────────────────────┐
        │ Conteneur backend            │
        │                               │
        │ Variables disponibles :      │
        │ - Depuis .env.test            │
        │ - Surchargées par docker-    │
        │   compose                    │
        │                               │
        │ test-env-setup.js détecte :  │
        │ RUNNING_IN_DOCKER=true       │
        │ → Ne charge pas .env.test     │
        │                               │
        │ npm test                      │
        │ npm run test:e2e             │
        └───────────────────────────────┘
```

## Pourquoi deux fichiers .env ?

### `.env.test` (local)
```
Utilisé quand tu lances : npm run test:e2e
MONGODB_URI=mongodb://localhost:27017/lutea_test
```
- MongoDB tourne sur ton PC
- Utilise `localhost`

### `.env.test` dans Docker
```
Utilisé par docker-compose.test.yml
MONGODB_URI=mongodb://localhost:27017/lutea_test  (dans .env.test)
→ Surchargé par docker-compose : mongodb://mongo:27017/lutea_test
```
- Le même fichier `.env.test` est utilisé
- Docker Compose surcharge juste `MONGODB_URI` pour utiliser `mongo` (nom du service Docker)

## Ordre de chargement des variables dans Docker

```
1. .env.test (env_file)
   ↓
   Charge : JWT_SECRET, STRIPE_SECRET_KEY, MONGODB_URI, etc.
   
2. environment: (docker-compose.test.yml)
   ↓
   Surcharge : NODE_ENV, RUNNING_IN_DOCKER, MONGODB_URI (mongo au lieu de localhost)
   
3. Variables finales dans le conteneur
   ↓
   Utilisées par test-env-setup.js et les tests
```

## Détection Docker dans test-env-setup.js

```javascript
const isDocker = 
  process.env.RUNNING_IN_DOCKER === 'true' &&  // Défini par docker-compose
  process.env.MONGODB_URI &&                   // Existe
  process.env.MONGODB_URI.includes('mongo:27017'); // Nom du service Docker

if (isDocker) {
  // On est dans Docker, les variables sont déjà là
  return; // Ne rien faire
} else {
  // On est en local, charger .env.test
  // ...
}
```

## Résumé

1. **Script PowerShell** : Vérifie que `.env.test` existe
2. **Docker Compose** : Lance MongoDB + Backend avec les bonnes variables
3. **Dockerfile** : Build l'image du backend
4. **test-env-setup.js** : Détecte Docker et ne charge pas `.env.test`
5. **Tests** : S'exécutent avec les variables injectées par Docker Compose

Tout est isolé dans Docker, pas de risque d'utiliser la base de production !

