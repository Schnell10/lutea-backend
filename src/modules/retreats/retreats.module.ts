import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RetreatsService } from './retreats.service';
import { RetreatsController } from './retreats.controller';
import { Retreat, RetreatSchema } from './retreats.schema';
import { Booking, BookingSchema } from '../bookings/bookings.schema';
import { AdminGuard } from '../../common/guards/admin.guard';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Retreat.name, schema: RetreatSchema },
      { name: Booking.name, schema: BookingSchema }
    ]),
    UsersModule
  ],
  controllers: [RetreatsController],
  providers: [RetreatsService, AdminGuard],
  exports: [RetreatsService]
})
export class RetreatsModule {}
