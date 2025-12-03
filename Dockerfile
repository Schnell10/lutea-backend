# Dockerfile pour Lutea Backend
# Multi-stage build pour optimiser la taille de l'image

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Je copie les fichiers de dépendances
COPY package*.json ./

# J'installe les dépendances (production + dev pour build)
RUN npm ci

# Je copie le code source
COPY . .

# Je build l'application NestJS
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Je crée un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Je copie les fichiers de dépendances
COPY package*.json ./

# J'installe uniquement les dépendances de production
RUN npm ci --only=production && \
    npm cache clean --force

# Je copie le code depuis le stage builder
COPY --from=builder --chown=nestjs:nodejs /app ./

# Je passe à l'utilisateur non-root
USER nestjs

# J'expose le port de l'application
EXPOSE 3002

# Variables d'environnement par défaut (seront surchargées par Render)
ENV NODE_ENV=production
ENV PORT=3002

# Commande de démarrage
CMD ["node", "dist/main.js"]

