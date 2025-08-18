// Fichier d'index pour centraliser l'export de tous les guards
// Ce fichier permet d'importer tous les guards depuis un seul endroit
// Exemple d'utilisation : import { AdminGuard, ClientGuard } from '../common/guards';

// Export du guard administrateur - Protège les routes admin uniquement
export { AdminGuard } from './admin.guard';

// Export du guard client - Protège les routes client (clients + admins)
export { ClientGuard } from './client.guard';

// Export du guard propriétaire - Vérifie que l'utilisateur est propriétaire de la ressource
export { OwnerGuard } from './owner.guard';
