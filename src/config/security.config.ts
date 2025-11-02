// Configuration centralisée de la sécurité pour l'application Lutea
// Ce fichier regroupe tous les paramètres de sécurité en un seul endroit

export const securityConfig = {
  // Configuration des JWT (JSON Web Tokens)
  jwt: {
    accessTokenExpiry: '15m', // Token d'accès : 15 minutes
    refreshTokenExpiry: '7d', // Token de renouvellement : 7 jours
    secret: process.env.JWT_SECRET,
  },

  // Configuration de la sécurité des mots de passe
  password: {
    minLength: 8,        // Longueur minimale
    saltRounds: 12,      // Rounds de salage bcrypt
  },

  // Configuration de la sécurité des connexions
  login: {
    maxFailedAttempts: 5,    // Maximum de tentatives échouées
    lockDuration: 15,        // Durée de verrouillage en minutes
    lockThreshold: 4,        // Tentatives avant verrouillage
  },

  // Configuration de la double authentification (2FA)
  twoFactor: {
    codeLength: 8,       // Longueur du code de vérification (8 chiffres)
    codeExpiry: 10,      // Durée de validité en minutes
    maxAttempts: 5,      // Nombre max d'essais avant invalidation du code
  },

  // Configuration du rate limiting pour réinitialisation de mot de passe
  passwordReset: {
    maxAttempts: 3,      // Maximum de tentatives par heure
    windowMs: 60 * 60 * 1000, // Fenêtre de temps : 1 heure
    lockDuration: 24 * 60 * 60 * 1000, // Durée de verrouillage : 24 heures
  },

  // Configuration de la limitation de débit (rate limiting)
  rateLimit: {
    windowMs: 15 * 60 * 1000, // Fenêtre de temps : 15 minutes
    max: 100,                  // Maximum de requêtes par IP
    message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard',
  },

  // Configuration CORS (Cross-Origin Resource Sharing)
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,    // Permet l'envoi de cookies et d'en-têtes d'authentification
  },

  // Configuration de la sécurité des sessions
  session: {
    secure: process.env.NODE_ENV === 'production', // Cookies sécurisés en production
    httpOnly: true,       // Protection XSS
    sameSite: 'strict' as const, // Protection CSRF
  },

  // Configuration du logging (console.log)
  // debug: true = Voir tous les logs | debug: false = Masquer les logs
  logging: {
    debug: false, 
  },
};
