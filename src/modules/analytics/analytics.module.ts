import { Module, DynamicModule } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({})
export class AnalyticsModule {
  static forRoot(): DynamicModule {
    // Vérifier si MySQL est configuré
    const isMySQLConfigured = process.env.NODE_ENV !== 'test' && 
                              process.env.MYSQL_HOST && 
                              process.env.MYSQL_USER && 
                              process.env.MYSQL_PASSWORD;

    if (!isMySQLConfigured) {
      // Retourner un module vide si MySQL n'est pas configuré
      return {
        module: AnalyticsModule,
        imports: [],
        controllers: [],
        providers: [],
        exports: [],
      };
    }

    // En production/local, charger TypeORM et les dépendances seulement si nécessaire
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const typeorm = require('@nestjs/typeorm');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const analyticsController = require('./analytics.controller');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const analyticsService = require('./analytics.service');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sessionEntity = require('./entities/session.entity');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const userEventEntity = require('./entities/user-event.entity');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const eventTypeEntity = require('./entities/event-type.entity');

    // Retourner le module complet avec TypeORM si configuré
    return {
      module: AnalyticsModule,
      imports: [
        typeorm.TypeOrmModule.forFeature([sessionEntity.Session, userEventEntity.UserEvent, eventTypeEntity.EventType]),
        AuthModule,
        UsersModule,
      ],
      controllers: [analyticsController.AnalyticsController],
      providers: [analyticsService.AnalyticsService],
      exports: [analyticsService.AnalyticsService],
    };
  }
}

