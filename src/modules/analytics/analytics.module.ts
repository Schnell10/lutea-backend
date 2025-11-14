import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { Session } from './entities/session.entity';
import { UserEvent } from './entities/user-event.entity';
import { EventType } from './entities/event-type.entity';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    // Import des entités TypeORM pour MySQL
    TypeOrmModule.forFeature([Session, UserEvent, EventType]),
    AuthModule, // Pour utiliser les guards
    UsersModule, // Pour AdminGuard qui a besoin de UsersService
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService], // Export pour utilisation dans d'autres modules
})
export class AnalyticsModule {}

