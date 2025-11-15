import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../src/app.module';

/**
 * Helper pour diagnostiquer les erreurs de compilation de module
 * Capture l'erreur avec plus de détails
 */
export async function createTestingModuleWithDiagnostics() {
  console.log('=== DIAGNOSTIC: Début de la création du module ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('MYSQL_HOST:', process.env.MYSQL_HOST || 'NON DÉFINI');
  console.log('MYSQL_USER:', process.env.MYSQL_USER || 'NON DÉFINI');
  console.log('MYSQL_PASSWORD:', process.env.MYSQL_PASSWORD ? '***' : 'NON DÉFINI');
  console.log('MONGODB_URI:', process.env.MONGODB_URI || 'NON DÉFINI');
  
  try {
    console.log('=== DIAGNOSTIC: Création du TestingModuleBuilder ===');
    const moduleBuilder: TestingModuleBuilder = Test.createTestingModule({
      imports: [AppModule],
    });
    
    console.log('=== DIAGNOSTIC: Compilation du module ===');
    const moduleFixture = await moduleBuilder.compile();
    
    console.log('=== DIAGNOSTIC: Module compilé avec succès ===');
    return moduleFixture;
  } catch (error) {
    console.error('=== DIAGNOSTIC: ERREUR DÉTECTÉE ===');
    console.error('Type d\'erreur:', error?.constructor?.name);
    console.error('Message:', error?.message);
    console.error('Stack:', error?.stack);
    
    // Essayer d'obtenir plus d'informations si c'est une erreur NestJS
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      if ((error as any).cause) {
        console.error('Error cause:', (error as any).cause);
      }
    }
    
    // Afficher toutes les propriétés de l'erreur
    console.error('Toutes les propriétés de l\'erreur:');
    if (error && typeof error === 'object') {
      Object.keys(error).forEach(key => {
        console.error(`  ${key}:`, (error as any)[key]);
      });
    }
    
    throw error;
  }
}

