/**
 * Logger personnalisé : je contrôle l'affichage des logs via la configuration.
 * Les erreurs et warnings sont toujours affichés, les autres logs uniquement si debug activé.
 */

import { securityConfig } from '../../config/security.config';

class Logger {
  private isEnabled(): boolean {
    return securityConfig.logging.debug;
  }

  log(...args: any[]): void {
    if (this.isEnabled()) {
      console.log(...args);
    }
  }

  // Toujours affiché même si logging désactivé
  error(...args: any[]): void {
    console.error(...args);
  }

  // Toujours affiché
  warn(...args: any[]): void {
    console.warn(...args);
  }

  info(...args: any[]): void {
    if (this.isEnabled()) {
      console.info(...args);
    }
  }

  debug(...args: any[]): void {
    if (this.isEnabled()) {
      console.debug(...args);
    }
  }
}

// Instance unique (singleton)
export const logger = new Logger();

