# 🚀 Lancer les Tests - Guide Pratique

## ⚡ **DÉMARRAGE RAPIDE (3 ÉTAPES)**

### **1. Créez `.env.test`** (30 secondes)

```powershell
# Windows
Copy-Item env.test.example .env.test

# Mac/Linux
cp env.test.example .env.test
```

### **2. Ajoutez vos clés Stripe TEST** (1 minute)

Éditez `.env.test` et remplacez :

```env
STRIPE_SECRET_KEY=sk_test_VOTRE_CLE_ICI
STRIPE_WEBHOOK_SECRET=whsec_VOTRE_WEBHOOK_ICI
```

**Où les trouver ?** → https://dashboard.stripe.com/test/apikeys

⚠️ **IMPORTANT** : Utilisez les clés **TEST** (sk_test_...), pas LIVE !

### **3. Lancez les tests !** (10 secondes)

```powershell
# Windows
.\run-all-tests.ps1

# Mac/Linux
chmod +x run-all-tests.sh  # Première fois uniquement
./run-all-tests.sh
```

**C'EST TOUT ! 🎉**

---

## 📋 **COMMANDES DISPONIBLES**

### **Script automatique (Recommandé)** ✅

```powershell
# Windows - Tous les tests
.\run-all-tests.ps1

# Windows - Tests unitaires uniquement
.\run-all-tests.ps1 -Unit

# Windows - Tests E2E uniquement
.\run-all-tests.ps1 -E2E

# Windows - Avec coverage
.\run-all-tests.ps1 -Coverage
```

```bash
# Mac/Linux - Tous les tests
./run-all-tests.sh

# Mac/Linux - Tests unitaires uniquement
./run-all-tests.sh --unit

# Mac/Linux - Tests E2E uniquement
./run-all-tests.sh --e2e

# Mac/Linux - Avec coverage
./run-all-tests.sh --coverage
```

---

### **Commandes npm directes**

```bash
# Tests unitaires
npm test

# Tests E2E
npm run test:e2e

# Avec coverage
npm test -- --coverage

# Mode watch (relance automatiquement)
npm test -- --watch

# Un seul fichier
npm run test:e2e -- --testPathPattern=bookings
```

---

## 📊 **RÉSULTAT ATTENDU**

Quand vous lancez `.\run-all-tests.ps1`, vous devriez voir :

```
==========================================
🧪 TESTS BACKEND LUTEA
==========================================

📦 1/2 - Tests UNITAIRES...

 PASS  src/modules/auth/auth.service.spec.ts
  AuthService
    ✓ devrait valider un utilisateur (125 ms)
    ✓ devrait générer des tokens JWT (45 ms)
    ...

Test Suites: 1 passed
Tests:       20 passed
Time:        5.234 s

✅ Tests unitaires réussis !

==========================================

🌐 2/2 - Tests E2E...

 PASS  test/bookings.e2e-spec.ts
  Bookings
    ✓ devrait créer une réservation (234 ms)
    ✓ devrait créer un PaymentIntent Stripe (456 ms)
      ✅ PaymentIntent créé: pi_3ABC...
    ...

 PASS  test/retreats.e2e-spec.ts
 PASS  test/users.e2e-spec.ts

Test Suites: 4 passed
Tests:       49 passed
Time:        42.567 s

✅ Tests E2E réussis !

==========================================
📊 RÉSUMÉ DES TESTS
==========================================

✅ TOUS LES TESTS SONT PASSÉS ! 🎉

Prochaines étapes :
  1. Committez vos changements
  2. Poussez sur GitHub
  3. GitHub Actions lancera les tests automatiquement

==========================================
```

---

## 🚨 **ERREURS FRÉQUENTES**

### **1. `.env.test` n'existe pas**

```
❌ ERREUR : Le fichier .env.test n'existe pas !
```

**Solution** : Copiez `env.test.example` vers `.env.test`

```powershell
Copy-Item env.test.example .env.test
```

### **2. Clés Stripe invalides**

```
❌ Stripe Error: Invalid API Key provided
```

**Solution** :
1. Vérifiez que vous utilisez `sk_test_...` (pas `sk_live_...`)
2. Récupérez vos clés sur https://dashboard.stripe.com/test/apikeys

### **3. MongoDB non démarré**

```
❌ MongoError: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution** :

```bash
# Mac
brew services start mongodb-community

# Windows
net start MongoDB

# Linux
sudo systemctl start mongod
```

### **4. Port déjà utilisé**

```
❌ Error: listen EADDRINUSE: address already in use :::3002
```

**Solution** : Arrêtez le serveur qui tourne déjà ou changez le port dans `.env.test`

---

## 🎯 **WORKFLOW RECOMMANDÉ**

### **Pendant le développement** :

```bash
# Tests unitaires en mode watch (se relancent automatiquement)
npm test -- --watch
```

**Avantage** : Feedback instantané quand vous modifiez le code

### **Avant de commit** :

```bash
# Tous les tests
.\run-all-tests.ps1
```

**Avantage** : Garantit que tout fonctionne avant de push

### **Après le push** :

GitHub Actions lance automatiquement les tests ! Voir l'onglet "Actions" sur GitHub.

---

## 📝 **OPTIONS AVANCÉES**

### **Lancer un seul fichier de test** :

```bash
# E2E
npm run test:e2e -- --testPathPattern=bookings

# Unitaire
npm test -- --testPathPattern=auth.service
```

### **Mode debug** :

```bash
# Voir plus de détails
npm test -- --verbose

# Mode watch (relance automatiquement)
npm test -- --watch
```

### **Voir la couverture des tests** :

```bash
npm test -- --coverage
```

Puis ouvrez : `coverage/lcov-report/index.html`

---

## ✅ **CHECKLIST AVANT DE PUSH**

- [ ] `.env.test` créé avec clés Stripe TEST
- [ ] Tous les tests passent (`.\run-all-tests.ps1`)
- [ ] Pas de `console.log` de debug dans le code
- [ ] Pas d'erreur ESLint (`npm run lint`)
- [ ] Code formatté (si vous avez Prettier)

---

## 🔍 **SI UN TEST ÉCHOUE**

### **1. Lisez le message d'erreur**

```
 FAIL  test/bookings.e2e-spec.ts
  ● Bookings › POST /bookings › devrait créer une réservation

    Expected: 201
    Received: 400

    Body: { message: 'retreatId is required' }
```

### **2. Identifiez le problème**

- Route incorrecte ?
- Validation manquante ?
- Permission incorrecte ?

### **3. Corrigez le code**

### **4. Relancez**

```bash
.\run-all-tests.ps1
```

---

## 📚 **COMMANDES UTILES**

```bash
# Aide npm scripts
npm run

# Voir les tests disponibles
npm test -- --listTests

# Lancer avec plus de détails
npm test -- --verbose

# Lancer les tests d'un module spécifique
npm run test:e2e -- test/bookings.e2e-spec.ts
```

---

## 🎯 **RÉSUMÉ**

```
DÉMARRAGE RAPIDE :
1. Copy-Item env.test.example .env.test
2. Ajoutez vos clés Stripe TEST
3. .\run-all-tests.ps1

COMMANDES :
- npm test                 → Tests unitaires
- npm run test:e2e         → Tests E2E
- .\run-all-tests.ps1      → Tous les tests
- npm test -- --watch      → Mode watch
- npm test -- --coverage   → Avec coverage

ERREURS FRÉQUENTES :
- .env.test manquant       → Copy-Item env.test.example .env.test
- Clés Stripe invalides    → Utilisez sk_test_...
- MongoDB non démarré      → brew services start mongodb-community
```

---

**Pour comprendre les tests** → Consultez `COMPRENDRE-LES-TESTS.md`

**Pour GitHub Actions** → Consultez `SECRETS-GITHUB.md`

