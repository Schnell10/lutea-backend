import { Module, DynamicModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Session } from './entities/session.entity';
import { UserEvent } from './entities/user-event.entity';
import { EventType } from './entities/event-type.entity';
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

    // Retourner le module complet avec TypeORM si configuré
    return {
      module: AnalyticsModule,
      imports: [
        TypeOrmModule.forFeature([Session, UserEvent, EventType]),
        AuthModule,
        UsersModule,
      ],
      controllers: [AnalyticsController],
      providers: [AnalyticsService],
      exports: [AnalyticsService],
    };
  }
}

