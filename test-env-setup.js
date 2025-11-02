/**
 * Configuration d'environnement pour les tests E2E
 * 
 * Ce fichier est exécuté AVANT tous les tests E2E pour charger
 * les variables d'environnement depuis .env.test
 * 
 * ⚠️ IMPORTANT : Cela garantit que les tests n'utilisent PAS la base de production !
 */

const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Chemin vers le fichier .env.test
const envTestPath = path.resolve(__dirname, '.env.test');

// Vérifier si .env.test existe
if (fs.existsSync(envTestPath)) {
  console.log('✅ Chargement de la configuration de test depuis .env.test');
  
  // Charger les variables d'environnement depuis .env.test
  const result = dotenv.config({ path: envTestPath });
  
  if (result.error) {
    console.error('❌ Erreur lors du chargement de .env.test:', result.error);
    process.exit(1);
  }
  
  // Afficher la base de données utilisée (pour vérification)
  console.log(`📊 Base de données de test : ${process.env.MONGODB_URI || 'NON DÉFINIE'}`);
  
  // Vérification de sécurité : empêcher l'utilisation de la base de prod
  if (process.env.MONGODB_URI && process.env.MONGODB_URI.includes('/lutea') && !process.env.MONGODB_URI.includes('/lutea_test')) {
    console.error('');
    console.error('🚨🚨🚨 DANGER ! 🚨🚨🚨');
    console.error('Vous êtes sur le point d\'utiliser la base de données de PRODUCTION pour les tests !');
    console.error(`Base détectée : ${process.env.MONGODB_URI}`);
    console.error('');
    console.error('Solutions :');
    console.error('1. Modifiez .env.test pour utiliser : MONGODB_URI=mongodb://localhost:27017/lutea_test');
    console.error('2. Lisez CONFIG-DB-TEST.md pour plus d\'informations');
    console.error('');
    process.exit(1);
  }
  
} else {
  console.warn('');
  console.warn('⚠️  ATTENTION : Le fichier .env.test n\'existe pas !');
  console.warn('');
  console.warn('Les tests E2E vont utiliser les variables d\'environnement par défaut,');
  console.warn('ce qui peut potentiellement utiliser votre base de données de PRODUCTION !');
  console.warn('');
  console.warn('Solutions :');
  console.warn('1. Créez un fichier .env.test à la racine de lutea-backend/');
  console.warn('2. Ajoutez : MONGODB_URI=mongodb://localhost:27017/lutea_test');
  console.warn('3. Lisez CONFIG-DB-TEST.md pour plus d\'informations');
  console.warn('');
  console.warn('Appuyez sur Ctrl+C pour arrêter les tests si nécessaire.');
  console.warn('');
  
  // Attendre 5 secondes pour laisser le temps de lire le message
  const waitTime = 5000;
  console.warn(`⏳ Attente de ${waitTime/1000} secondes avant de continuer...`);
  
  // Utiliser une boucle synchrone pour bloquer l'exécution
  const start = Date.now();
  while (Date.now() - start < waitTime) {
    // Attente active
  }
  
  console.warn('⚠️  Poursuite des tests avec la configuration par défaut...');
  console.warn('');
}

