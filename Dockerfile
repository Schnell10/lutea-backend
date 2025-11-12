# Dockerfile pour Lutea Backend
# Multi-stage build pour optimiser la taille de l'image

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances (production + dev pour build)
RUN npm ci

# Copier le code source
COPY . .

# Build de l'application NestJS
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer uniquement les dépendances de production
RUN npm ci --only=production && \
    npm cache clean --force

# Copier le code depuis le stage builder
COPY --from=builder --chown=nestjs:nodejs /app ./

# Passer à l'utilisateur non-root
USER nestjs

# Exposer le port de l'application
EXPOSE 3002

# Variables d'environnement par défaut (seront surchargées par Render)
ENV NODE_ENV=production
ENV PORT=3002

# Commande de démarrage
CMD ["node", "dist/main.js"]

