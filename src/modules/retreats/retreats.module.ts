import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RetreatsService } from './retreats.service';
import { RetreatsController } from './retreats.controller';
import { Retreat, RetreatSchema } from './retreats.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Retreat.name, schema: RetreatSchema }
    ])
  ],
  controllers: [RetreatsController],
  providers: [RetreatsService],
  exports: [RetreatsService] // Pour être utilisé dans d'autres modules
})
export class RetreatsModule {}
