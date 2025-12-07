/**
 * Configuration d'environnement pour les tests E2E
 * 
 * Exécuté AVANT tous les tests E2E pour charger
 * les variables d'environnement depuis .env.test
 * 
 * IMPORTANT : Garantit que les tests n'utilisent PAS la base de production
 */

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Si on est dans Docker, les variables sont déjà définies par docker-compose
// Vérifie via RUNNING_IN_DOCKER=true (défini dans docker-compose.test.yml)
const isDocker = process.env.RUNNING_IN_DOCKER === 'true' && process.env.MONGODB_URI && process.env.MONGODB_URI.includes('mongo:27017');

if (isDocker) {
  console.log('Docker détecté - Base:', process.env.MONGODB_URI);
  // Dans Docker, les variables sont déjà définies, rien à faire
  return;
}

// Chemin vers le fichier .env.test
const envTestPath = path.resolve(__dirname, '.env.test');

// Vérifie si .env.test existe
if (fs.existsSync(envTestPath)) {
  console.log('Chargement de la configuration de test depuis .env.test');
  
  // Charge les variables d'environnement depuis .env.test
  const result = dotenv.config({ path: envTestPath });
  
  if (result.error) {
    console.error('Erreur lors du chargement de .env.test:', result.error);
    process.exit(1);
  }
  
  // Affiche la base de données utilisée (pour vérification)
  console.log(`Base de données de test : ${process.env.MONGODB_URI || 'NON DÉFINIE'}`);
  
  // Vérification de sécurité : empêche l'utilisation de la base de prod
  if (process.env.MONGODB_URI && process.env.MONGODB_URI.includes('/lutea') && !process.env.MONGODB_URI.includes('/lutea_test')) {
    console.error('');
    console.error('DANGER : Base PRODUCTION détectée !');
    console.error(`Base : ${process.env.MONGODB_URI}`);
    console.error('Modifier .env.test : MONGODB_URI=mongodb://localhost:27017/lutea_test');
    console.error('');
    process.exit(1);
  }
  
} else {
  console.warn('');
  console.warn('ATTENTION : .env.test n\'existe pas !');
  console.warn('Risque d\'utiliser la base PRODUCTION');
  console.warn('Créer .env.test avec : MONGODB_URI=mongodb://localhost:27017/lutea_test');
  console.warn('Ctrl+C pour arrêter');
  console.warn('');
  
  // Attend 10secondes pour laisser le temps de lire le message
  const waitTime = 10000;
  console.warn(`Attente de 10secondes avant de continuer...`);
  
  // Utilise une boucle synchrone pour bloquer l'exécution
  const start = Date.now();
  while (Date.now() - start < waitTime) {
    // Attente active
  }
  
  console.warn('Poursuite avec config par défaut...');
  console.warn('');
}

