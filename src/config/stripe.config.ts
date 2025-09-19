// Configuration Stripe pour l'application Lutea
// Ce fichier regroupe tous les paramètres Stripe en un seul endroit

export const stripeConfig = {
  // Clés API Stripe
  api: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },

  // Configuration des paiements
  payment: {
    currency: 'eur', // Devise par défaut
    apiVersion: '2025-08-27.basil', // Version de l'API Stripe
  },

  // Configuration des webhooks
  webhook: {
    // Événements Stripe à écouter
    events: [
      'payment_intent.succeeded',
      'payment_intent.payment_failed',
      'payment_intent.canceled',
      'customer.created',
      'customer.updated',
    ],
  },

  // Configuration des clients Stripe
  customer: {
    // Métadonnées par défaut pour les clients
    defaultMetadata: {
      source: 'lutea-website',
    },
  },

  // Configuration des PaymentIntents
  paymentIntent: {
    // Méthodes de paiement automatiques activées
    automaticPaymentMethods: {
      enabled: true,
    },
    // Configuration des métadonnées
    metadata: {
      source: 'lutea-booking',
    },
  },
};
