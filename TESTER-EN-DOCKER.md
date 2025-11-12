# 🐳 Tester dans Docker en Local

Guide complet pour lancer tes tests Jest (unitaires + E2E) dans Docker en local, exactement comme en production.

## 🎯 Pourquoi tester dans Docker ?

- **Environnement identique** à la production
- **Détecter les problèmes** avant de push sur GitHub
- **Validation** que le Dockerfile fonctionne
- **Test des dépendances** système

---

## 📋 Prérequis

1. **Docker Desktop installé** (Windows/Mac) ou Docker Engine (Linux)
2. **Vérifier que Docker fonctionne** :
   ```bash
   docker --version
   docker ps
   ```

---

## 🎯 Méthode Simple avec Docker Compose (Recommandée - À UTILISER)

**C'est la méthode la plus simple - utilise celle-ci !**

### Utilisation ultra-simple :

```powershell
cd lutea-backend
.\test-docker-compose.ps1
```

**C'est tout !** Le script fait automatiquement :
1. Vérifie que Docker fonctionne
2. Crée `.env.docker` si nécessaire
3. **Build l'image Docker** (seulement si nécessaire grâce au cache)
4. **Lance MongoDB automatiquement** (dans Docker Compose)
5. **Lance tous les tests** (unitaires + E2E)
6. Nettoie tout après

**⚠️ Tu n'as PAS besoin de lancer MongoDB manuellement !** Docker Compose s'en charge.

### Ou manuellement avec Docker Compose :

```powershell
# Lancer tout d'un coup (build + MongoDB + tests)
docker-compose -f docker-compose.test.yml --profile test up --build --exit-code-from backend

# Nettoyer après
docker-compose -f docker-compose.test.yml down
```

**Explication :**
- `--profile test` : Active le service backend (pour les tests)
- `--build` : Build l'image avant de lancer (avec cache intelligent)
- `--exit-code-from backend` : Retourne le code de sortie des tests

**Avantages Docker Compose :**
- ✅ **Une seule commande** au lieu de 5-6
- ✅ **MongoDB lancé automatiquement** (pas besoin de l'étape 3)
- ✅ **Réseau géré automatiquement** (pas besoin de `host.docker.internal`)
- ✅ **Dépendances gérées** (MongoDB démarre avant les tests)
- ✅ **Cache intelligent** (rebuild seulement si nécessaire)

---

## 💡 Pourquoi MongoDB dans Docker ?

**Explication simple :**
- Tes tests E2E ont besoin d'une **vraie base MongoDB**
- Tu ne veux pas utiliser ta base de production
- **Avec Docker Compose** : MongoDB est lancé automatiquement (tu n'as rien à faire !)
- **Sans Docker Compose** : Tu dois le lancer manuellement (méthode manuelle ci-dessous)

---

## 📚 Méthode Manuelle (Optionnel - Pour comprendre)

**⚠️ Note :** Ces étapes sont UNIQUEMENT si tu veux comprendre comment ça marche en détail. Si tu utilises Docker Compose (recommandé ci-dessus), **tu n'as pas besoin de cette section** !

### Étape 1 : Build l'image Docker

```bash
cd lutea-backend
docker build -t lutea-backend:test .
```

**Ce que ça fait :**
- Lit le `Dockerfile`
- Installe Node.js, dépendances
- Build l'application NestJS
- Crée une image nommée `lutea-backend:test`

### Étape 2 : Lancer MongoDB dans Docker

**Dans un terminal séparé** (c'est pourquoi Docker Compose est mieux - il fait ça automatiquement) :

```bash
docker run -d -p 27017:27017 --name mongo-test mongo:6
```

**Ce que ça fait :**
- Lance MongoDB dans un conteneur
- Expose le port 27017
- Nom du conteneur : `mongo-test`

### Étape 3 : Créer `.env.docker`

Crée `lutea-backend/.env.docker` avec tes variables de test.

### Étape 4 : Lancer les tests

```bash
# Tests unitaires
docker run --rm --env-file .env.docker lutea-backend:test npm test

# Tests E2E (Windows)
docker run --rm --env-file .env.docker -e MONGODB_URI=mongodb://host.docker.internal:27017/lutea_test lutea-backend:test npm run test:e2e
```

**Pourquoi c'est compliqué ?**
- Il faut lancer MongoDB manuellement
- Il faut gérer le réseau Docker
- Il faut plusieurs commandes

**C'est pourquoi Docker Compose est mieux !** ✅

## 📝 Commandes Utiles

### Voir les images Docker
```bash
docker images
```

### Voir les conteneurs qui tournent
```bash
docker ps
```

### Voir tous les conteneurs (arrêtés aussi)
```bash
docker ps -a
```

### Arrêter MongoDB
```bash
docker stop mongo-test
```

### Supprimer le conteneur MongoDB
```bash
docker rm mongo-test
```

### Supprimer l'image de test
```bash
docker rmi lutea-backend:test
```

### Voir les logs d'un conteneur
```bash
docker logs <container-id>
```

### Entrer dans le conteneur (pour debug)
```bash
docker run -it --rm --env-file .env.docker lutea-backend:test sh
```

### Nettoyer tout (images + conteneurs arrêtés)
```bash
docker system prune -a
```

---

## 🔍 Troubleshooting

### "Docker n'est pas lancé"
- Lance **Docker Desktop** depuis le menu Démarrer
- Attends que l'icône dans la barre des tâches soit verte

### "Cannot connect to MongoDB"
- Vérifie que MongoDB tourne : `docker ps | grep mongo`
- Si pas là, lance : `docker run -d -p 27017:27017 --name mongo-test mongo:6`
- Sur Windows, utilise `host.docker.internal` dans l'URI

### "Port 27017 already in use"
- Tu as probablement MongoDB installé directement sur ton PC
- Soit arrête MongoDB local, soit utilise un autre port :
  ```bash
  docker run -d -p 27018:27017 --name mongo-test mongo:6
  ```
  Puis dans `.env.docker` : `MONGODB_URI=mongodb://host.docker.internal:27018/lutea_test`

### "Cannot find module"
- L'image n'a peut-être pas été build correctement
- Rebuild : `docker build -t lutea-backend:test .`

### Tests E2E échouent
- Vérifie que MongoDB est accessible depuis le conteneur
- Vérifie les variables d'environnement dans `.env.docker`
- Vérifie les logs : `docker logs <container-id>`

---

## ✅ Checklist

Avant de tester dans Docker :

- [ ] Docker Desktop lancé
- [ ] Image build : `docker build -t lutea-backend:test .`
- [ ] MongoDB lancé : `docker run -d -p 27017:27017 --name mongo-test mongo:6`
- [ ] Fichier `.env.docker` créé avec les bonnes variables
- [ ] Tests unitaires : `docker run --rm --env-file .env.docker lutea-backend:test npm test`
- [ ] Tests E2E : `docker run --rm --env-file .env.docker -e MONGODB_URI=... lutea-backend:test npm run test:e2e`

---

## 🎓 Comparaison : Local vs Docker

| Aspect | Local (sans Docker) | Docker |
|--------|---------------------|--------|
| **MongoDB** | Installé sur PC ou Atlas | MongoDB dans conteneur |
| **Node.js** | Version locale | Version de l'image Docker |
| **OS** | Windows/Mac/Linux | Linux (comme prod) |
| **Variables env** | `.env` ou `.env.test` | `.env.docker` |
| **Vitesse** | ⚡ Rapide | 🐌 Plus lent (Docker overhead) |
| **Ressemble à prod** | ❌ Non | ✅ Oui |

---

## 💡 Astuce

Pour tester rapidement avant chaque push :

```powershell
# Méthode simple avec Docker Compose
.\test-docker-compose.ps1
```

Si ça passe, tu peux push en toute confiance ! 🚀

---

## 📊 Comparaison des méthodes

| Méthode | Commandes | Complexité | Recommandé |
|---------|-----------|------------|------------|
| **Docker Compose** | 1 commande | ⭐ Simple | ✅ **OUI** |
| **Manuelle** | 5-6 commandes | ⭐⭐⭐ Complexe | ❌ Pour apprendre |

