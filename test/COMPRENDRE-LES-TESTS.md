# 🎓 Comprendre les Tests Backend

## 📚 **LES 2 TYPES DE TESTS**

### **Tests UNITAIRES** (`*.spec.ts`) 🧪

**Emplacement** : À côté du code source dans `src/`

```
src/modules/auth/
├── auth.service.ts       ← Code
└── auth.service.spec.ts  ← Test unitaire (à côté)
```

**Objectif** : Tester une fonction/classe **isolée**

**Exemple** :
```typescript
it('devrait valider un utilisateur', async () => {
  const result = await authService.validateUser('email', 'password');
  expect(result).toBeDefined();
});
```

**Caractéristiques** :
- ⚡ Ultra rapides (millisecondes)
- 🎭 Tout est mocké (pas de vraie DB, pas de serveur)
- 🎯 Précis - Si ça casse, vous savez exactement où

**Commande** : `npm test`

---

### **Tests E2E** (`*.e2e-spec.ts`) 🌐

**Emplacement** : Dossier `test/`

```
test/
├── auth.e2e-spec.ts       ← Test E2E Auth
├── bookings.e2e-spec.ts   ← Test E2E Bookings
├── retreats.e2e-spec.ts   ← Test E2E Retreats
└── users.e2e-spec.ts      ← Test E2E Users
```

**Objectif** : Tester l'application **complète** (comme un utilisateur réel)

**Exemple** :
```typescript
it('POST /auth/register', async () => {
  return request(app.getHttpServer())
    .post('/auth/register')
    .send({ email: 'test@example.com', password: 'Password123!' })
    .expect(201);
});
```

**Caractéristiques** :
- 🐌 Plus lents (secondes)
- 🔗 Réalistes - Teste le parcours utilisateur complet
- 🌐 Intégration - Vérifie que tous les modules fonctionnent ensemble
- 🚀 Jest démarre le serveur automatiquement

**Commande** : `npm run test:e2e`

---

## 📊 **ORGANISATION DES FICHIERS**

```
lutea-backend/
│
├── src/                           ← CODE SOURCE
│   └── modules/
│       └── auth/
│           ├── auth.service.ts       ← Code
│           └── auth.service.spec.ts  ← ✅ Test UNITAIRE (à côté)
│
└── test/                          ← TESTS E2E
    ├── auth.e2e-spec.ts          ← ✅ Test E2E Auth
    ├── bookings.e2e-spec.ts      ← ✅ Test E2E Bookings
    ├── retreats.e2e-spec.ts      ← ✅ Test E2E Retreats
    ├── users.e2e-spec.ts         ← ✅ Test E2E Users
    ├── jest-e2e.json             ← Config Jest E2E
    └── helpers/
        └── test-helpers.ts       ← Fonctions utilitaires
```

**Pourquoi cette organisation ?**
- C'est la **convention NestJS officielle**
- Les tests unitaires sont **à côté du code** qu'ils testent
- Les tests E2E sont **transverses** (testent plusieurs modules ensemble)

---

## 🎯 **CE QUI EST TESTÉ**

### **Tests créés pour vous** :

| Module | Type | Fichier | Tests |
|--------|------|---------|-------|
| Auth | Unitaire | `src/modules/auth/auth.service.spec.ts` | 20 |
| Auth | E2E | `test/auth.e2e-spec.ts` | Tests E2E |
| Bookings | E2E | `test/bookings.e2e-spec.ts` | 18 |
| Retreats | E2E | `test/retreats.e2e-spec.ts` | 15 |
| Users | E2E | `test/users.e2e-spec.ts` | 16 |

**TOTAL** : ~69 tests

---

## 🔧 **COMMENT ÇA MARCHE ?**

### **1. Fichier `.env.test`**

Les tests E2E utilisent un fichier `.env.test` séparé :

```
.env         ← Développement/Production
.env.test    ← Tests (base de données séparée)
```

**Pourquoi ?**
- Pour ne pas polluer votre vraie base de données
- Pour utiliser les clés Stripe TEST (pas de vrais paiements)

### **2. Base de données séparée**

```
PRODUCTION : mongodb://localhost:27017/lutea       ← Vos vraies données
TESTS      : mongodb://localhost:27017/lutea_test  ← Données de test
```

MongoDB crée automatiquement `lutea_test` lors des tests.

### **3. Clés Stripe TEST**

```env
# .env (prod)
STRIPE_SECRET_KEY=sk_live_...   ← Vrais paiements

# .env.test (tests)
STRIPE_SECRET_KEY=sk_test_...   ← Paiements fictifs
```

---

## 🚀 **WORKFLOW**

### **Développement quotidien** :

```bash
# Tests unitaires en mode watch (se relancent auto)
npm test -- --watch
```

### **Avant de commit** :

```bash
# Tous les tests
.\run-all-tests.ps1  # Windows
./run-all-tests.sh   # Mac/Linux
```

### **Après le push** :

GitHub Actions lance automatiquement tous les tests !

---

## 🔍 **EXEMPLE CONCRET**

### **Test unitaire** :

```typescript
// src/modules/auth/auth.service.spec.ts
it('devrait valider un utilisateur', async () => {
  // ARRANGE - Mock
  jest.spyOn(usersService, 'findByEmail').mockResolvedValue(mockUser);
  
  // ACT - Exécuter
  const result = await authService.validateUser('email', 'password');
  
  // ASSERT - Vérifier
  expect(result).toBeDefined();
});
```

**Pas de serveur, pas de DB, tout est mocké** → **Très rapide** ⚡

### **Test E2E** :

```typescript
// test/auth.e2e-spec.ts
it('POST /auth/register', async () => {
  return request(app.getHttpServer())
    .post('/auth/register')
    .send({ email: 'test@example.com', password: 'Password123!' })
    .expect(201);
});
```

**Serveur démarré, vraie DB (test), vraie requête HTTP** → **Plus lent mais réaliste** 🌐

---

## 📝 **POURQUOI LES DEUX ?**

**Analogie : Construction d'une maison**

- **Tests unitaires** 🧪 = Tester chaque brique individuellement
  - "Cette brique est-elle solide ?"

- **Tests E2E** 🌐 = Habiter dans la maison complète
  - "Quand j'ouvre le robinet, l'eau coule-t-elle ?"

**Les 2 sont nécessaires** :
- Les unitaires trouvent les bugs **rapidement** pendant le dev
- Les E2E garantissent que tout **fonctionne ensemble** avant la prod

---

## 🎯 **RÉSUMÉ**

```
Tests UNITAIRES (*.spec.ts)
├── Emplacement : src/ (à côté du code)
├── Vitesse : ⚡⚡⚡ (millisecondes)
├── Objectif : Tester une fonction isolée
└── Commande : npm test

Tests E2E (*.e2e-spec.ts)
├── Emplacement : test/ (transverses)
├── Vitesse : 🐌 (secondes)
├── Objectif : Tester l'app complète
└── Commande : npm run test:e2e
```

---

**Pour lancer les tests** → Consultez `LANCER-LES-TESTS.md`

**Pour GitHub Actions** → Consultez `SECRETS-GITHUB.md`

