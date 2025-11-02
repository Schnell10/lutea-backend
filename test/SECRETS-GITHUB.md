# 🔐 Secrets GitHub pour CI/CD

## 🎯 **OBJECTIF**

Faire en sorte que GitHub Actions lance automatiquement vos tests à chaque push, **sans avoir besoin de `.env.test`** sur GitHub.

---

## 📊 **COMMENT ÇA MARCHE ?**

### **Le problème** :

`.env.test` contient des secrets (clés Stripe, etc.) → Il est dans `.gitignore` → **PAS sur GitHub**

### **La solution** :

Les secrets sont stockés dans **GitHub Secrets** (chiffrés) → Le workflow les utilise pour créer `.env.test` automatiquement

```
Local (votre machine)
├── .env.test (fichier)              ← Vous créez manuellement
└── Clés dedans

GitHub Actions (cloud)
├── .env.test (créé à la volée)      ← Workflow le crée automatiquement
└── Clés viennent des GitHub Secrets ← Vous les ajoutez dans Settings
```

---

## 🔑 **SECRETS À CRÉER**

### **Minimum requis** (2 secrets) :

| Nom du secret | Valeur | Où trouver |
|---------------|--------|------------|
| `STRIPE_SECRET_KEY_TEST` | `sk_test_51Abc...` | https://dashboard.stripe.com/test/apikeys |
| `STRIPE_WEBHOOK_SECRET_TEST` | `whsec_test_123...` | https://dashboard.stripe.com/test/webhooks |

**Pourquoi juste 2 ?**
- Les autres variables (JWT, MongoDB, etc.) ne sont pas sensibles
- Elles sont en dur dans le workflow avec des valeurs factices

---

## 🚀 **AJOUTER LES SECRETS (5 MINUTES)**

### **1. Allez sur votre repo GitHub**

### **2. Cliquez sur Settings (⚙️)**

### **3. Dans le menu de gauche : Secrets and variables → Actions**

### **4. Cliquez sur "New repository secret"**

### **5. Ajoutez le premier secret** :

```
Name: STRIPE_SECRET_KEY_TEST
Secret: sk_test_51Abc...XyZ
```

**IMPORTANT** : Collez votre **vraie clé** Stripe de TEST !

### **6. Cliquez sur "Add secret"**

### **7. Répétez pour le deuxième secret** :

```
Name: STRIPE_WEBHOOK_SECRET_TEST
Secret: whsec_test_123...
```

### **8. C'est tout !** 🎉

---

## ⚙️ **LE WORKFLOW FAIT LE RESTE**

Le fichier `.github/workflows/tests.yml` contient :

```yaml
- name: Create .env.test
  run: |
    cat > .env.test << EOF
    MONGODB_URI=mongodb://localhost:27017/lutea_test
    
    JWT_SECRET=test_jwt_secret_for_testing_only
    JWT_REFRESH_SECRET=test_refresh_secret_for_testing_only
    
    # Stripe
    STRIPE_SECRET_KEY=${{ secrets.STRIPE_SECRET_KEY_TEST }}
    STRIPE_WEBHOOK_SECRET=${{ secrets.STRIPE_WEBHOOK_SECRET_TEST }}
    
    RESEND_API_KEY=re_test_fake_key
    
    RECAPTCHA_SECRET_KEY=6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe
    
    PORT=3002
    EOF
```

**Ce qui se passe** :
1. GitHub Actions démarre
2. Lit les secrets `STRIPE_SECRET_KEY_TEST` et `STRIPE_WEBHOOK_SECRET_TEST`
3. Crée `.env.test` avec ces valeurs
4. Lance les tests
5. Supprime `.env.test` après les tests

---

## 🔍 **VÉRIFIER QUE ÇA MARCHE**

### **1. Poussez votre code**

```bash
git add .
git commit -m "Add tests"
git push
```

### **2. Allez sur GitHub → Onglet "Actions"**

Vous verrez le workflow "Tests Backend" en cours d'exécution.

### **3. Cliquez dessus pour voir les détails**

Vous verrez :
- ✅ Checkout code
- ✅ Setup Node.js
- ✅ Install dependencies
- ✅ **Create .env.test** ← Les secrets sont utilisés ici
- ✅ Run unit tests
- ✅ Run E2E tests

### **4. Si tout est vert ✅**

Les tests sont passés ! GitHub Actions fonctionne correctement.

### **5. Si c'est rouge ❌**

Cliquez sur l'étape qui a échoué pour voir l'erreur.

---

## 📋 **WORKFLOW COMPLET**

Le fichier `.github/workflows/tests.yml` fait automatiquement :

```yaml
1. Clone votre code
2. Installe Node.js et dépendances
3. Démarre MongoDB (service Docker)
4. Crée .env.test avec les secrets GitHub
5. Lance les tests unitaires
6. Lance les tests E2E
7. Vous notifie du résultat
```

**Vous n'avez rien à faire manuellement !**

---

## 🔐 **SÉCURITÉ**

### **Les secrets GitHub sont sûrs ?**

✅ **OUI !**
- Chiffrés au repos
- Masqués dans les logs (affichés comme `***`)
- Accessibles uniquement par les workflows
- Pas visibles dans les Pull Requests de forks

### **Exemple dans les logs** :

```
STRIPE_SECRET_KEY=***
```

Au lieu de :
```
STRIPE_SECRET_KEY=sk_test_51Abc...XyZ
```

---

## 🎯 **CE QUI SE PASSE À CHAQUE PUSH**

```
git push
    ↓
GitHub détecte le push
    ↓
Lit .github/workflows/tests.yml
    ↓
Démarre un conteneur Ubuntu
    ↓
Installe Node.js
    ↓
Démarre MongoDB (service)
    ↓
Crée .env.test avec :
  - JWT_SECRET=test_jwt_secret (en dur)
  - STRIPE_SECRET_KEY=${{ secrets.STRIPE_SECRET_KEY_TEST }} (depuis GitHub)
    ↓
Lance npm test
    ↓
Lance npm run test:e2e
    ↓
✅ Tests passés → Badge vert
❌ Tests échoués → Badge rouge + notification
```

---

## 🆕 **AJOUTER D'AUTRES ENVIRONNEMENTS (OPTIONNEL)**

Vous pouvez créer d'autres secrets pour staging/prod :

```
STRIPE_SECRET_KEY_TEST       ← Pour les tests
STRIPE_SECRET_KEY_STAGING    ← Pour le staging
STRIPE_SECRET_KEY_PROD       ← Pour la production
```

Et créer d'autres workflows :

```
.github/workflows/
├── tests.yml           ← Utilise *_TEST
├── deploy-staging.yml  ← Utilise *_STAGING
└── deploy-prod.yml     ← Utilise *_PROD
```

---

## ❓ **FAQ**

### **Q : Je dois créer combien de secrets ?**

**R :** **2 minimum** : `STRIPE_SECRET_KEY_TEST` et `STRIPE_WEBHOOK_SECRET_TEST`

Les autres (JWT, MongoDB, etc.) sont en dur dans le workflow.

### **Q : Si je change une clé Stripe, je dois la changer où ?**

**R :** **2 endroits** :
1. Localement : Dans votre `.env.test` local
2. GitHub : Dans Settings → Secrets → Actions

### **Q : Les secrets sont partagés entre branches ?**

**R :** **OUI**, les secrets sont au niveau du **repo**, pas de la branche.

### **Q : Quelqu'un qui fork mon repo voit les secrets ?**

**R :** **NON**, les secrets ne sont PAS copiés dans les forks.

### **Q : C'est gratuit ?**

**R :** **OUI** pour les repos publics (illimité). Pour les repos privés : 2000 minutes/mois gratuites.

### **Q : Je peux tester sans push ?**

**R :** **OUI**, avec l'outil `act` (simule GitHub Actions localement) :

```bash
npm install -g act
act -j test
```

---

## ✅ **CHECKLIST**

Configuration GitHub Actions :

- [ ] Secrets ajoutés dans GitHub (Settings → Secrets)
  - [ ] `STRIPE_SECRET_KEY_TEST`
  - [ ] `STRIPE_WEBHOOK_SECRET_TEST`
- [ ] Fichier `.github/workflows/tests.yml` dans le repo
- [ ] Code poussé sur GitHub (`git push`)
- [ ] Onglet "Actions" affiche le workflow
- [ ] Tests passent ✅

---

## 🎯 **RÉSUMÉ**

```
SECRETS À CRÉER (2 minimum) :
├── STRIPE_SECRET_KEY_TEST      → sk_test_51Abc...
└── STRIPE_WEBHOOK_SECRET_TEST  → whsec_test_123...

OÙ LES AJOUTER :
GitHub → Settings → Secrets and variables → Actions → New repository secret

CE QUI SE PASSE AUTOMATIQUEMENT :
1. git push
2. GitHub Actions démarre
3. Crée .env.test avec les secrets
4. Lance les tests
5. Vous notifie du résultat

VÉRIFIER :
GitHub → Onglet "Actions" → Voir les runs
```

---

**Pour comprendre les tests** → Consultez `COMPRENDRE-LES-TESTS.md`

**Pour lancer les tests localement** → Consultez `LANCER-LES-TESTS.md`

