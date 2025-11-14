# Tests Backend

## Démarrage rapide

1. Je crée `.env.test`
2. J'ajoute mes clés Stripe TEST dans `.env.test`
3. Je lance : `.\run-all-tests.ps1`

## Les deux types de tests

### Tests unitaires (`*.spec.ts`)



src/modules/
├── auth/
│   ├── auth.service.ts
│   └── auth.service.spec.ts       ← Tests unitaires Auth
├── users/
│   ├── users.service.ts
│   └── users.service.spec.ts      ← Tests unitaires Users
├── retreats/
│   ├── retreats.service.ts
│   └── retreats.service.spec.ts   ← Tests unitaires Retreats
└── bookings/
    ├── bookings.service.ts
    └── bookings.service.spec.ts   ← Tests unitaires Bookings


Objectif : tester une fonction isolée, tout est mocké (pas de DB, pas de serveur)

Commande : `npm test`

### Tests E2E (`*.e2e-spec.ts`)



test/
├── auth.e2e-spec.ts         ← Tests E2E Auth
├── bookings.e2e-spec.ts     ← Tests E2E Bookings
├── retreats.e2e-spec.ts     ← Tests E2E Retreats
├── users.e2e-spec.ts        ← Tests E2E Users
├── jest-e2e.json            ← Config Jest E2E
└── helpers/
    └── test-helpers.ts      ← Fonctions utilitaires


Objectif : tester l'application complète (serveur démarré, vraie DB de test)

Commande : `npm run test:e2e`

## Ce qui est testé

- 38 tests unitaires (Auth, Users, Retreats, Bookings)
- 54 tests E2E (Auth, Bookings, Retreats, Users)
- Total : ~92 tests

## Configuration

### Fichier `.env.test` (local)

Je crée un fichier `.env.test` en local avec ces variables :

```
MONGODB_URI=mongodb://localhost:27017/lutea_test
JWT_SECRET=test_jwt_secret_for_testing_only
JWT_REFRESH_SECRET=test_refresh_secret_for_testing_only
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
RESEND_API_KEY=re_test_fake_key
RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe
PORT=3002
```

**Important** : Ce fichier est dans `.gitignore`, je ne le push pas sur GitHub. Je le crée manuellement en local.

Les tests utilisent ce fichier pour ne pas polluer ma vraie base de données et utiliser les clés Stripe TEST.


.env         ← Développement/Production
.env.test    ← Tests (base de données séparée)


Base de données :
- Production : `mongodb://localhost:27017/lutea`
- Tests : `mongodb://localhost:27017/lutea_test`

Clés Stripe :
- Production : `sk_live_...`
- Tests : `sk_test_...`

## Commandes

### Script automatique (recommandé)

powershell
.\run-all-tests.ps1              # Tous les tests
.\run-all-tests.ps1 -Unit        # Tests unitaires uniquement
.\run-all-tests.ps1 -E2E         # Tests E2E uniquement
.\run-all-tests.ps1 -Coverage    # Avec coverage


### Commandes npm

bash
npm test                         # Tests unitaires
npm run test:e2e                 # Tests E2E
npm test -- --coverage           # Avec coverage
npm test -- --watch              # Mode watch (relance auto)
npm run test:e2e -- --testPathPattern=bookings  # Un seul fichier


## Workflow

Pendant le développement :
- `npm test -- --watch` pour feedback instantané

Avant de commit :
- `.\run-all-tests.ps1` pour vérifier que tout fonctionne

Après le push :
- GitHub Actions lance automatiquement les tests

## Tests avec Docker

Pour tester dans un environnement identique à la production :

.\test-docker-compose.ps1


Ce script :
- Vérifie que Docker Desktop est lancé
- Build l'image Docker
- Lance MongoDB automatiquement
- Exécute tous les tests (unitaires + E2E)
- Nettoie tout après

Je n'ai pas besoin de lancer MongoDB manuellement, Docker Compose s'en charge.

## GitHub Actions (CI/CD)

### Secrets à créer

Dans GitHub : Settings → Secrets and variables → Actions

Secrets minimum (2) :
- `STRIPE_SECRET_KEY_TEST` : `sk_test_51Abc...` (clé Stripe TEST)
- `STRIPE_WEBHOOK_SECRET_TEST` : `whsec_test_123...` (webhook secret Stripe TEST)

### Comment ça marche

Le workflow `.github/workflows/tests.yml` :
1. Crée `.env.test` automatiquement avec :
   - `MONGODB_URI=mongodb://localhost:27017/lutea_test` (MongoDB service GitHub Actions)
   - Les secrets Stripe depuis GitHub Secrets
   - Les autres variables avec des valeurs de test
2. Lance les tests
3. Me notifie du résultat

Je n'ai rien à faire manuellement, juste ajouter les secrets Stripe une fois.

### Vérifier que ça marche

1. Je push mon code
2. Je vais sur GitHub → onglet "Actions"
3. Je vois le workflow en cours d'exécution
4. Si tout est vert, les tests passent

## Checklist avant push

- [ ] `.env.test` créé avec clés Stripe TEST
- [ ] Tous les tests passent (`.\run-all-tests.ps1`)
- [ ] Pas de `console.log` de debug
- [ ] Pas d'erreur ESLint (`npm run lint`)
