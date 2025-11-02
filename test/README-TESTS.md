# 🧪 Tests Backend Lutea - Documentation

## 📚 **3 GUIDES ESSENTIELS**

### **1. 🎓 COMPRENDRE-LES-TESTS.md**
→ **Comprendre comment fonctionnent les tests**
- Différence entre tests unitaires et E2E
- Organisation des fichiers
- Pourquoi les 2 types de tests ?

### **2. 🚀 LANCER-LES-TESTS.md**
→ **Guide pratique pour lancer les tests**
- Démarrage rapide (3 étapes)
- Toutes les commandes disponibles
- Résolution des erreurs fréquentes

### **3. 🔐 SECRETS-GITHUB.md**
→ **Configurer GitHub Actions (CI/CD)**
- Secrets à créer sur GitHub
- Configuration automatique
- Vérification que ça fonctionne

---

## ⚡ **DÉMARRAGE ULTRA-RAPIDE**

```powershell
# 1. Créez .env.test
Copy-Item env.test.example .env.test

# 2. Ajoutez vos clés Stripe TEST dans .env.test

# 3. Lancez !
.\run-all-tests.ps1
```

---

## 📊 **RÉSUMÉ**

### **Tests créés** :
- ✅ 20 tests unitaires (Auth)
- ✅ 49 tests E2E (Auth, Bookings, Retreats, Users)
- ✅ **TOTAL : ~69 tests**

### **Fichiers** :
```
src/modules/auth/
└── auth.service.spec.ts     ← Test UNITAIRE

test/
├── auth.e2e-spec.ts         ← Tests E2E
├── bookings.e2e-spec.ts     ← Tests E2E + Stripe
├── retreats.e2e-spec.ts     ← Tests E2E
└── users.e2e-spec.ts        ← Tests E2E
```

### **Scripts** :
- ✅ `run-all-tests.ps1` (Windows)
- ✅ `run-all-tests.sh` (Mac/Linux)

---

## 🎯 **ORGANISATION**

### **Pourquoi un test dans `src/` et les autres dans `test/` ?**

C'est la **convention NestJS** :
- **Tests UNITAIRES** (`*.spec.ts`) → Dans `src/` à côté du code
- **Tests E2E** (`*.e2e-spec.ts`) → Dans `test/` (tests transverses)

Voir `COMPRENDRE-LES-TESTS.md` pour plus de détails.

---

## 📝 **COMMANDES**

```bash
# Tous les tests
.\run-all-tests.ps1

# Tests unitaires uniquement
npm test

# Tests E2E uniquement
npm run test:e2e

# Avec coverage
npm test -- --coverage
```

---

## 🎉 **PRÊT À COMMENCER ?**

1. Lisez **`LANCER-LES-TESTS.md`** pour démarrer
2. Consultez **`COMPRENDRE-LES-TESTS.md`** pour comprendre
3. Configurez **`SECRETS-GITHUB.md`** pour le CI/CD

**Bon coding ! 🚀**

