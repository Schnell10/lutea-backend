# Tester dans Docker en Local

Avant de push sur GitHub, je lance les tests dans Docker pour être sûr que tout fonctionne comme en production.

## Comment faire

Docker Desktop doit être lancé, puis :

cd lutea-backend
.\test-docker-compose.ps1

C'est tout. Le script fait tout automatiquement :
- Vérifie que Docker fonctionne
- Build l'image Docker
- Lance MongoDB automatiquement
- Lance tous les tests (unitaires + E2E)
- Nettoie après

Je n'ai pas besoin de lancer MongoDB manuellement, Docker Compose s'en charge.

## Si ça plante

**Docker n'est pas lancé**
- Lancer Docker Desktop depuis le menu Démarrer
- Attendre que l'icône soit verte dans la barre des tâches

**Port 27017 déjà utilisé**
- J'ai probablement MongoDB installé directement sur mon PC
- Soit arrêter MongoDB local, soit utiliser un autre port dans docker-compose.test.yml

**Tests E2E échouent**
- Vérifier que MongoDB tourne : `docker ps`
- Vérifier les variables dans `.env.test`
- Voir les logs : `docker logs <container-id>`

## Commandes utiles si besoin

Voir les conteneurs qui tournent :
docker ps

Voir les logs d'un conteneur :
docker logs <container-id>

Nettoyer tout :
docker system prune -a

## Comment ça fonctionne

### Fichiers Docker

**Dockerfile**
- Build multi-stage pour optimiser la taille de l'image
- Stage 1 : Build de l'application NestJS
- Stage 2 : Image finale avec seulement les dépendances de production
- Utilisé pour créer l'image Docker qui sera poussée sur Docker Hub

**docker-compose.test.yml**
- Orchestre MongoDB + Backend pour les tests
- Service `mongo` : Lance MongoDB automatiquement
- Service `backend` : Build l'image et lance les tests
- Utilise le profile `test` pour ne lancer que les services de test
- Le backend attend que MongoDB soit "healthy" avant de démarrer

**test-docker-compose.ps1**
- Script PowerShell qui orchestre tout
- Vérifie Docker Desktop
- Vérifie que `.env.test` existe
- Lance `docker-compose` avec le bon fichier
- Nettoie après les tests

**`.env.test`**
- Variables d'environnement pour les tests (utilisé partout : local, Docker, GitHub Actions)
- Surchargé par `docker-compose.test.yml` pour MongoDB (utilise le service `mongo` au lieu de localhost)

### Processus

1. Le script vérifie Docker Desktop
2. Vérifie que `.env.test` existe
3. `docker-compose` lit `docker-compose.test.yml`
4. Lance MongoDB dans un conteneur
5. Build l'image backend depuis `Dockerfile`
6. Lance le conteneur backend qui exécute les tests
7. Le backend se connecte à MongoDB via le nom du service (`mongo:27017`)
8. Les tests s'exécutent
9. Tout s'arrête et se nettoie automatiquement
