import { Module, DynamicModule } from '@nestjs/common';

/**
 * Module factice pour AnalyticsModule en mode test
 * Remplace AnalyticsModule pour éviter les erreurs TypeORM
 */
@Module({})
export class AnalyticsModule {
  static forRoot(): DynamicModule {
    // En mode test, retourner un module vide
    return {
      module: AnalyticsModule,
      imports: [],
      controllers: [],
      providers: [],
      exports: [],
    };
  }
}

