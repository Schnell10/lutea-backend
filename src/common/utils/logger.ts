/**
 * Logger personnalisé pour Lutea
 * 
 * Permet de contrôler l'affichage des logs via la configuration
 */

import { securityConfig } from '../../config/security.config';

class Logger {
  private isEnabled(): boolean {
    return securityConfig.logging.debug;
  }

  /**
   * Log normal 
   */
  log(...args: any[]): void {
    if (this.isEnabled()) {
      console.log(...args);
    }
  }

  /**
   * Log d'erreur (toujours affiché même si logging désactivé)
   */
  error(...args: any[]): void {
    console.error(...args);
  }

  /**
   * Log d'avertissement (toujours affiché)
   */
  warn(...args: any[]): void {
    console.warn(...args);
  }

  /**
   * Log d'information
   */
  info(...args: any[]): void {
    if (this.isEnabled()) {
      console.info(...args);
    }
  }

  /**
   * Log de debug (uniquement si enabled)
   */
  debug(...args: any[]): void {
    if (this.isEnabled()) {
      console.debug(...args);
    }
  }
}

// Export une instance unique (singleton)
export const logger = new Logger();

