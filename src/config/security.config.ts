// Configuration centralisée de la sécurité : je regroupe tous les paramètres ici

// Je configure sameSite : 'none' en production (cross-domain), 'strict' en dev
const sameSiteValue = process.env.NODE_ENV === 'production' ? ('none' as const) : ('strict' as const);

export const securityConfig = {
  jwt: {
    accessTokenExpiry: '15m',
    refreshTokenExpiry: '7d', // Pour les clients
    refreshTokenExpiryAdmin: '4h', // Pour les admins (sécurité renforcée)
    secret: process.env.JWT_SECRET,
  },

  password: {
    minLength: 8,
    saltRounds: 12,
  },

  login: {
    maxFailedAttempts: 5,
    lockDuration: 15, // minutes
    lockThreshold: 4,
  },

  twoFactor: {
    codeLength: 8,
    codeExpiry: 10, // minutes
    maxAttempts: 5,
  },

  passwordReset: {
    maxAttempts: 3, // par heure
    windowMs: 60 * 60 * 1000,
    lockDuration: 24 * 60 * 60 * 1000,
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000,
    max: 100, // requêtes par IP
    message: 'Trop de requêtes depuis cette IP, veuillez réessayer plus tard',
  },

  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },

  session: {
    secure: process.env.NODE_ENV === 'production', // HTTPS obligatoire avec sameSite: 'none'
    httpOnly: true, // Protection XSS
    sameSite: sameSiteValue, // Cross-domain en prod (Vercel ↔ Render)
  },

  logging: {
    debug: false, // true = voir tous les logs, false = masquer
  },
};
