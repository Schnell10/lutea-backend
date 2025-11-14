# Tester dans Docker en Local

Avant de push sur GitHub, je lance les tests dans Docker pour être sûr que tout fonctionne comme en production.

## Comment faire

Docker Desktop doit être lancé, puis :

```
cd lutea-backend
.\test-docker-compose.ps1
```

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
- Vérifier que MongoDB tourne : `docker ps | grep mongo`
- Vérifier les variables dans `.env.docker`
- Voir les logs : `docker logs <container-id>`

## Commandes utiles si besoin

Voir les conteneurs qui tournent :
```
docker ps
```

Voir les logs d'un conteneur :
```
docker logs <container-id>
```

Nettoyer tout :
```
docker system prune -a
```
